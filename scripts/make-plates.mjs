/**
 * Turns raw generated ink-wash plates into the WebP layers the hero ships.
 *
 * Two jobs:
 *
 * 1. Force the background to true white. These composite with
 *    `mix-blend-mode: multiply`, which darkens the page by whatever the source
 *    is, so a cream "rice paper" background (a common generator result) becomes
 *    a grey box over the beige. A per-image white-point stretch fixes it
 *    without touching the ink, which sits far below the background level.
 *
 * 2. Encode to WebP under the size budget.
 *
 * Run: node scripts/make-plates.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src/assets/plates");
// Sources live in the repo, not in ~/Downloads. They were read straight out of
// the download folder while the plates were being generated, which made the
// build unreproducible on any other machine — and unrunnable on this one once
// the Bash sandbox stopped granting access to that folder.
const IN = join(root, "src/assets/plates-src");

/**
 * Source file (as generated) → shipped name.
 *
 * `punch` deepens the ink without touching the white background. Plates that
 * land on the mid-grey ridges need it: multiply darkens by the source, so soft
 * grey brushwork over an already-grey slope has almost no tonal room and reads
 * as haze rather than as strokes. 1 leaves the plate as drawn.
 */
const PLATES = [
  { src: "plate-pine.png", name: "pine", punch: 1.25 },
  { src: "plate-reeds.png", name: "reeds", punch: 1.9 },
  { src: "plate-rock.png", name: "rock", punch: 1.7 },
];

/**
 * The painted mountain ranges, which replace the procedural sine ridges.
 *
 * These take a different path from the plates above. A plate is a DOM element
 * composited with `mix-blend-mode: multiply`, so white background is free —
 * multiplying by white is the identity. A range is a TEXTURE inside the WebGL
 * scene, where there is no multiply blend and fog has to be able to eat the
 * layer from behind, so the background has to become real transparency.
 *
 * `gain` scales the recovered alpha. The far range came back extremely faint
 * (its darkest pixel is 192 of 255, so it keys to a maximum alpha of 0.29),
 * which is fainter than atmospheric perspective wants even for the back layer.
 * Gain lifts it without a levels stretch on the source — stretching 64 levels
 * across a wider range banded the wet-on-wet gradients, which is exactly where
 * that image spends its detail.
 */
const RANGES = [
  { src: "mountain-far.png", name: "range-far", gain: 2.0 },
  { src: "mountain-mid.png", name: "range-mid", gain: 1.0 },
  { src: "mountain-near.png", name: "range-near", gain: 1.0 },
];

const BUDGET_BYTES = 120 * 1024;

/**
 * The ranges get a larger ceiling than the plates, and earn it: three textures
 * replace five meshes' worth of geometry, and they carry the composition.
 *
 * Full source width is kept deliberately. The camera pans laterally across
 * these layers, so a texture narrower than the source is magnified exactly
 * where the pan is looking. The size comes out of `alphaQuality` instead —
 * every bit of detail in these textures is in the alpha channel, so it is the
 * only dial that matters: 90 → 70 costs nothing visible through fog and takes
 * the near range from 424 KB to 176 KB.
 */
const RANGE_BUDGET_BYTES = 180 * 1024;
const RANGE_ALPHA_QUALITY = 70;

/** Straight from tailwind.config.js — the ink these washes are painted in. */
const INK = { r: 0x2c, g: 0x28, b: 0x25 };

/**
 * Background level, taken as the most common bright luminance in the image.
 *
 * Sampling the corners seemed obvious and was wrong: the pine branch enters
 * through the upper-left corner, so a corner patch measured ink and reported a
 * white point of 234 for an image whose background is a clean 255 — which
 * would have blown out its light washes by 9%. The background is always the
 * dominant tone (80%+ of these plates), so its histogram mode finds it
 * regardless of where the composition puts the ink.
 */
const measureWhitePoint = async (image) => {
  const { data, info } = await image.clone().raw().toBuffer({ resolveWithObject: true });
  const step = info.channels;

  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += step) {
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    histogram[lum] += 1;
  }

  // Only the bright end can be background; ink never dominates a plate.
  let mode = 255;
  let best = -1;
  for (let level = 200; level < 256; level += 1) {
    if (histogram[level] > best) {
      best = histogram[level];
      mode = level;
    }
  }

  // Already clean — pass through untouched rather than lifting for no reason.
  if (mode >= 253) return 255;

  // Drop below the mode so the background's own spread (a few levels either
  // side) all clips to white rather than stopping just short of it.
  return mode - 6;
};

const build = async ({ src, name, punch = 1 }) => {
  const source = sharp(join(IN, src)).flatten({ background: "#ffffff" });

  const whitePoint = await measureWhitePoint(source);
  // Never darken, only lift. An already-clean plate passes through untouched.
  const multiplier = Math.max(1, 255 / whitePoint);

  /**
   * One levels pass doing both jobs, because a second `.linear()` would
   * replace the first rather than compose with it.
   *
   *   lift:  out = m·in
   *   punch: out = 255 - k·(255 - in)   (deepens ink, pins white AT white)
   *
   * Substituting gives a single slope/intercept pair. Pinning white matters:
   * any transform that dims the background reintroduces the grey-box problem
   * the white-point lift exists to remove.
   */
  const slope = punch * multiplier;
  const intercept = 255 * (1 - punch);

  let quality = 82;
  let output;

  // Step the quality down until it fits. These are soft-edged wash images, so
  // WebP handles them well and this rarely needs more than one pass.
  for (; quality >= 50; quality -= 6) {
    output = await source
      .clone()
      .linear(slope, intercept)
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (output.length <= BUDGET_BYTES) break;
  }

  const file = join(OUT, `${name}.webp`);
  await sharp(output).toFile(file);

  console.log(
    `[make-plates] ${name}: white point ${whitePoint.toFixed(1)} → lift x${multiplier.toFixed(3)}, ` +
      `punch x${punch}, q${quality}, ${(output.length / 1024).toFixed(1)} KB`
  );
};

/**
 * Un-composites ink-on-white back into ink-with-alpha.
 *
 * The generator hands back an opaque image: ink laid on a white page. What the
 * scene needs is the ink alone, with the page removed, so that fog and the beige
 * background show through the wash the way paper does. Since every pixel is a
 * blend of one known ink colour over one known white, the blend is invertible:
 *
 *   observed = a·ink + (1 - a)·255   ⇒   a = (255 - observed) / (255 - ink)
 *
 * RGB is then written as flat ink everywhere and all the modelling lives in the
 * alpha channel. Keeping the source's own RGB instead would carry the white
 * background into every semi-transparent texel and fringe the strokes with pale
 * halos wherever the wash thins — which is most of a sumi-e painting.
 */
const buildRange = async ({ src, name, gain = 1 }) => {
  const source = sharp(join(IN, src)).flatten({ background: "#ffffff" });
  const { data, info } = await source.clone().greyscale().raw().toBuffer({ resolveWithObject: true });

  const inkLum = INK.r * 0.299 + INK.g * 0.587 + INK.b * 0.114;
  const range = 255 - inkLum;

  const rgba = Buffer.alloc(info.width * info.height * 4);
  let covered = 0;

  for (let i = 0; i < data.length; i += 1) {
    // Clamped, because the near range does reach true black, which solves to
    // slightly over 1 — ink darker than the ink colour is still just opaque.
    const alpha = Math.min(1, Math.max(0, ((255 - data[i]) / range) * gain));
    const o = i * 4;
    rgba[o] = INK.r;
    rgba[o + 1] = INK.g;
    rgba[o + 2] = INK.b;
    rgba[o + 3] = Math.round(alpha * 255);
    if (alpha > 0.02) covered += 1;
  }

  let output;
  let used = 82;

  for (let quality = 82; quality >= 46; quality -= 6) {
    used = quality;
    output = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality, effort: 6, alphaQuality: RANGE_ALPHA_QUALITY })
      .toBuffer();
    if (output.length <= RANGE_BUDGET_BYTES) break;
  }

  await sharp(output).toFile(join(OUT, `${name}.webp`));

  console.log(
    `[make-plates] ${name}: gain x${gain}, coverage ${((100 * covered) / (info.width * info.height)).toFixed(1)}%, ` +
      `q${used}, ${(output.length / 1024).toFixed(1)} KB`
  );
};

await mkdir(OUT, { recursive: true });
for (const plate of PLATES) await build(plate);
for (const layer of RANGES) await buildRange(layer);
