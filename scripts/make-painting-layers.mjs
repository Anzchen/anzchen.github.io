/**
 * Cuts the hero painting into parallax depth layers.
 *
 * Sources are the AI-expanded bands in src/assets/painting-src, produced by
 * merge-expansion.mjs. Each one is a band of the original painting at native
 * scale with new painting extending it right and down, so one source pixel is
 * still one pixel of the original scroll and the layers stay in register.
 *
 * Two decisions shape everything here:
 *
 * 1. Each layer is its own BAND: it fades in at its seam and dissolves again
 *    once the next layer forward takes over. The first version ran every layer
 *    to the bottom of the painting, on the reasoning that overlapping layers
 *    can never tear open a gap. That was true and still wrong, because it left
 *    all four layers holding the same village, so once the camera separated
 *    them the page composited the scene against displaced copies of itself.
 *    Gaps are prevented by the crossfade instead, which reads as mist.
 *
 * 2. The seams are the painting's own mist bands, carved per column. The
 *    feather is the only place two layers are visible at once, so it is the
 *    only place doubling can appear at all, and it must land in haze.
 *
 * Run: node scripts/make-painting-layers.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOTTOM_FADE,
  LAYERS,
  ORIGINAL_WIDTH,
  PAN_DISTANCE,
  VISIBLE_BOTTOM,
  VISIBLE_TOP,
  fadeFromFor,
  worldPerPixel,
} from "./painting-geometry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src/assets/painting-src");
const OUT = join(root, "src/assets/painting");

/**
 * Margin past the strict pan requirement when trimming, so a layer's own edge
 * is never the binding case. A generative expansion does not respect the size
 * it was asked for, and everything past the camera's reach renders at zero
 * alpha forever while stealing resolution from the part that is visible.
 */
const PAN_MARGIN = 1.6;

const CARVE_WINDOW = 170;
const CARVE_PROBE = 12;
const CARVE_SMOOTH = 121;

/**
 * Narrow on purpose. Against a measured front-to-near separation of 447 rows, a
 * 260-row feather showed as clearly doubled roofs and trees; 90 is roughly the
 * thickness of the painting's own mist bands.
 */
const FEATHER_ROWS = 90;

/**
 * Left dissolve, relative to the ORIGINAL width.
 *
 * This is what keeps the hero's text column on open beige. It used to be a CSS
 * mask on a DOM element; a mask cannot follow onto a texture, so it is baked in
 * here and that utility is gone.
 */
const MASK_FROM = 0.42;
/** Right dissolve, so a layer never ends on a hard line if its edge is reached. */
const MASK_TO = 0.97;

const BUDGET_BYTES = 240 * 1024;

const smoothstep = (t) => t * t * (3 - 2 * t);

/** Per-column seam row, taking the least-inked neighbourhood near the nominal. */
const carveSeam = (grey, w, h, nominal) => {
  const lo = Math.max(CARVE_PROBE, nominal - CARVE_WINDOW);
  const hi = Math.min(h - CARVE_PROBE - 1, nominal + CARVE_WINDOW);
  const raw = new Float32Array(w);

  for (let x = 0; x < w; x += 1) {
    let bestRow = nominal;
    let bestCost = Infinity;
    for (let y = lo; y <= hi; y += 1) {
      let cost = 0;
      for (let dy = -CARVE_PROBE; dy <= CARVE_PROBE; dy += 1) {
        cost += Math.max(0, 214 - grey[(y + dy) * w + x]);
      }
      cost += Math.abs(y - nominal) * 0.35;
      if (cost < bestCost) {
        bestCost = cost;
        bestRow = y;
      }
    }
    raw[x] = bestRow;
  }

  const seam = new Float32Array(w);
  const half = (CARVE_SMOOTH - 1) / 2;
  for (let x = 0; x < w; x += 1) {
    let sum = 0;
    let n = 0;
    for (let k = -half; k <= half; k += 1) {
      const xx = x + k;
      if (xx < 0 || xx >= w) continue;
      sum += raw[xx];
      n += 1;
    }
    seam[x] = sum / n;
  }
  return seam;
};

const build = async ({ name, srcTop, seam: seamRow, carve, fadeFrom, base, depth }) => {
  const file = join(SRC, `${name}.png`);
  if (!existsSync(file)) throw new Error(`missing expanded source: ${file}`);

  const meta = await sharp(file).metadata();

  // World units per source pixel at this layer's depth.
  const maxCols = Math.min(
    meta.width,
    ORIGINAL_WIDTH + Math.ceil((PAN_DISTANCE / worldPerPixel(depth)) * PAN_MARGIN)
  );
  const maxRows = Math.min(meta.height, fadeFrom ? fadeFrom + BOTTOM_FADE - srcTop : meta.height);

  const trimmed = maxCols < meta.width || maxRows < meta.height;
  const source = sharp(file)
    .removeAlpha()
    .extract({ left: 0, top: 0, width: maxCols, height: maxRows });

  if (trimmed) {
    console.log(
      `[painting] ${name}: trimmed ${meta.width}x${meta.height} → ${maxCols}x${maxRows} (rest never reaches screen)`
    );
  }
  const { data, info } = await source.clone().raw().toBuffer({ resolveWithObject: true });
  /**
   * removeAlpha() strips alpha but does not promise three channels: a greyscale
   * source yields one, and every +1/+2 read below would then cross into the
   * next pixel. No crash, just silently wrong output.
   */
  if (info.channels !== 3) {
    throw new Error(`[painting] ${name}: expected 3 channels, got ${info.channels} — is the source greyscale?`);
  }
  const grey = await source.clone().greyscale().raw().toBuffer();

  const w = info.width;
  const h = info.height;

  const nominal = seamRow - srcTop;
  const seam = carve ? carveSeam(grey, w, h, nominal) : null;

  const rgba = Buffer.alloc(w * h * 4);
  let covered = 0;

  for (let x = 0; x < w; x += 1) {
    const start = seam ? seam[x] : nominal;
    /**
     * Both dissolves are measured against the ORIGINAL width, not the expanded
     * one. The left ramp exists to clear the hero's text column, which sits at
     * a fixed place in the composition, so widening the source must not drag it
     * sideways.
     */
    const u = x / ORIGINAL_WIDTH;
    const mask = Math.min(1, u / MASK_FROM) * Math.min(1, Math.max(0, (w / ORIGINAL_WIDTH - u) / (1 - MASK_TO)));

    for (let y = 0; y < h; y += 1) {
      const edge = smoothstep(Math.min(1, Math.max(0, (y - start) / FEATHER_ROWS)));
      const tail = fadeFrom
        ? smoothstep(Math.min(1, Math.max(0, (srcTop + y - fadeFrom) / BOTTOM_FADE)))
        : 0;
      const alpha = edge * Math.min(1, mask) * (1 - tail);

      const i = (y * w + x) * info.channels;
      const o = (y * w + x) * 4;
      rgba[o] = data[i];
      rgba[o + 1] = data[i + 1];
      rgba[o + 2] = data[i + 2];
      rgba[o + 3] = Math.round(alpha * 255);
      if (alpha > 0.5) covered += 1;
    }
  }

  // Keep the ORIGINAL region at the resolution it had before expansion.
  const outWidth = Math.round((base * w) / ORIGINAL_WIDTH);
  const scaled = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).resize(outWidth);

  let output;
  let used = 82;
  for (let quality = 82; quality >= 40; quality -= 6) {
    used = quality;
    output = await scaled.clone().webp({ quality, effort: 6, alphaQuality: 88 }).toBuffer();
    if (output.length <= BUDGET_BYTES) break;
  }

  if (output.length > BUDGET_BYTES) {
    console.warn(
      `[painting] ${name}: OVER BUDGET at the lowest quality — ${(output.length / 1024).toFixed(1)} KB ` +
        `vs ${(BUDGET_BYTES / 1024).toFixed(0)} KB. Lower its \`base\` width in painting-geometry.mjs.`
    );
  }

  await sharp(output).toFile(join(OUT, `${name}.webp`));

  // reduce, not Math.min(...seam): the spread is a per-argument call and this
  // array is as wide as the source, so it grows toward the argument limit as
  // depths or PAN_MARGIN change.
  const lo = seam ? Math.round(seam.reduce((a, b) => Math.min(a, b), Infinity)) + srcTop : seamRow;
  const hi = seam ? Math.round(seam.reduce((a, b) => Math.max(a, b), -Infinity)) + srcTop : seamRow;
  console.log(
    `[painting] ${name}: source ${w}x${h} (rows ${srcTop}-${srcTop + h}), ` +
      `seam ${carve ? `${lo}-${hi} carved` : `${seamRow} ruled`}, ` +
      `opaque ${((100 * covered) / (w * h)).toFixed(1)}%, q${used}, ${(output.length / 1024).toFixed(1)} KB`
  );

  return { name, top: srcTop, rows: h, width: w, depth };
};

await mkdir(OUT, { recursive: true });

const manifest = [];
for (let i = 0; i < LAYERS.length; i += 1) {
  // Each layer dissolves once the next one has taken over; the frontmost runs
  // to the bottom of the painting, since nothing is in front of it.
  manifest.push(await build({ ...LAYERS[i], fadeFrom: fadeFromFor(i) }));
}

await writeFile(
  join(OUT, "layers.json"),
  `${JSON.stringify(
    { originalWidth: ORIGINAL_WIDTH, visibleTop: VISIBLE_TOP, visibleBottom: VISIBLE_BOTTOM, layers: manifest },
    null,
    2
  )}\n`
);
console.log("[painting] wrote layers.json");
