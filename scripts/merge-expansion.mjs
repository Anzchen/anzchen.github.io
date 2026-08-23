/**
 * Merges an AI-expanded band back onto its original, and matches its tone.
 *
 * Generative expansion misbehaves in three ways that are all cheaper to fix
 * here than by re-prompting:
 *
 * 1. It re-renders the whole frame rather than only the new canvas, so the
 *    original pixels come back subtly different. That breaks registration
 *    between layers, which only stack because they are the same painting.
 *
 * 2. It paints the new area in its own register, here consistently heavier
 *    than a source whose entire range is luminance 166 to 224.
 *
 * 3. It ignores the requested canvas size. One of the four came back at 24%
 *    off the requested aspect, having quietly skipped the downward expansion.
 *
 * So nothing is taken on trust: the position of the original inside the
 * generated frame is MEASURED, not assumed from the spec.
 *
 * Run: node scripts/merge-expansion.mjs <name> <path-to-generated>
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CUTS = join(homedir(), "Documents/painting-cuts");
const OUT = join(root, "src/assets/painting-src");

const [, , name, generatedPath] = process.argv;
if (!name || !generatedPath) {
  console.error("usage: node scripts/merge-expansion.mjs <name> <path-to-generated>");
  process.exit(1);
}
// Interpolated into read and write paths below, so keep it to a bare layer name.
if (!/^[a-z]+$/.test(name)) {
  console.error(`[merge] invalid layer name "${name}" — expected one of far/mid/near/front`);
  process.exit(1);
}

const originalPath = join(CUTS, `${name}.png`);
const oMeta = await sharp(originalPath).metadata();
const gMeta = await sharp(generatedPath).metadata();

/**
 * Find what fraction of the generated frame the original occupies.
 *
 * The expansion is anchored top-left, so the original always sits at (0,0) and
 * only its extent is unknown. Both axes are searched independently against a
 * coarse greyscale of each image, scoring mean absolute difference. This is
 * what lets a layer that skipped its vertical expansion still merge correctly.
 */
const PROBE = 160;
const oProbe = await sharp(originalPath).greyscale().resize(PROBE, PROBE, { fit: "fill" }).raw().toBuffer();

const GW = 480;
const GH = 480;
const gProbe = await sharp(generatedPath).greyscale().resize(GW, GH, { fit: "fill" }).raw().toBuffer();

const score = (fx, fy) => {
  let sum = 0;
  for (let y = 0; y < PROBE; y += 2) {
    const gy = Math.min(GH - 1, Math.round((y / PROBE) * fy * GH));
    for (let x = 0; x < PROBE; x += 2) {
      const gx = Math.min(GW - 1, Math.round((x / PROBE) * fx * GW));
      sum += Math.abs(oProbe[y * PROBE + x] - gProbe[gy * GW + gx]);
    }
  }
  return sum;
};

let best = { fx: 1, fy: 1, s: Infinity };
for (let fx = 0.4; fx <= 1.0001; fx += 0.01) {
  for (let fy = 0.4; fy <= 1.0001; fy += 0.01) {
    const s = score(fx, fy);
    if (s < best.s) best = { fx, fy, s };
  }
}

/**
 * How good the best alignment actually was.
 *
 * The search always returns SOME (fx, fy), so without a threshold a wrong layer
 * name, a wrong file, or an unrelated image produces a confident-looking
 * "measured original occupies 73% x 61%" and writes a silently corrupt merge.
 * The score was previously computed and thrown away.
 */
const SAMPLES = Math.ceil(PROBE / 2) ** 2;
const meanAbsDiff = best.s / SAMPLES;
console.log(`[merge] ${name}: alignment confidence ${meanAbsDiff.toFixed(1)}/255 mean abs diff`);
if (meanAbsDiff > 12) {
  console.error(
    "[merge] alignment failed — is the generated file really an expansion of this layer?",
    { name, generatedPath, meanAbsDiff: Number(meanAbsDiff.toFixed(1)) }
  );
  process.exit(1);
}

// Scale the generated up so its measured original-region matches native size.
const finalWidth = Math.round(oMeta.width / best.fx);
const finalHeight = Math.round(oMeta.height / best.fy);

console.log(`[merge] ${name}`);
console.log(`  original ${oMeta.width}x${oMeta.height}, generated ${gMeta.width}x${gMeta.height}`);
console.log(
  `  measured original occupies ${(best.fx * 100).toFixed(0)}% x ${(best.fy * 100).toFixed(0)}% of the generated frame`
);
console.log(`  new canvas ${finalWidth}x${finalHeight}  (right +${finalWidth - oMeta.width}, down +${finalHeight - oMeta.height})`);

const original = sharp(originalPath).removeAlpha();
const generated = sharp(generatedPath).removeAlpha().resize(finalWidth, finalHeight, { fit: "fill" });

const oRaw = await original.clone().raw().toBuffer({ resolveWithObject: true });
const gRaw = await generated.clone().raw().toBuffer({ resolveWithObject: true });
const oData = oRaw.data;
const gData = gRaw.data;
const oC = oRaw.info.channels;
const gC = gRaw.info.channels;
const width = oRaw.info.width;
const height = oRaw.info.height;

const histogram = (data, w, channels, pixels) => {
  const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (const [x, y] of pixels) {
    const i = (y * w + x) * channels;
    for (let c = 0; c < 3; c += 1) h[c][data[i + c]] += 1;
  }
  return h;
};

const percentile = (hist, p) => {
  const total = hist.reduce((a, b) => a + b, 0);
  const target = total * p;
  let run = 0;
  for (let v = 0; v < 256; v += 1) {
    run += hist[v];
    if (run >= target) return v;
  }
  return 255;
};

/**
 * The correction is measured on the NEW area only.
 *
 * Fitting it on the region the two images share would report almost no
 * correction needed: the model keeps the copied part close to the source and
 * renders only the new painting heavier.
 */
const newPixels = [];
for (let y = 0; y < finalHeight; y += 3) {
  for (let x = 0; x < finalWidth; x += 3) if (x >= width || y >= height) newPixels.push([x, y]);
}
const oldPixels = [];
for (let y = 0; y < height; y += 3) for (let x = 0; x < width; x += 3) oldPixels.push([x, y]);

const corrected = Buffer.alloc(finalWidth * finalHeight * 3);

if (newPixels.length > 0) {
  const gHist = histogram(gData, finalWidth, gC, newPixels);
  const oHist = histogram(oData, width, oC, oldPixels);

  /**
   * Percentile matching rather than mean and standard deviation: the fault is
   * specifically at the dark end, and a mean fit spreads that error across the
   * whole range and leaves the darkest values still too dark.
   */
  const ANCHORS = [0.01, 0.05, 0.2, 0.5, 0.8, 0.95, 0.99];
  const luts = [0, 1, 2].map((c) => {
    const from = ANCHORS.map((p) => percentile(gHist[c], p));
    const to = ANCHORS.map((p) => percentile(oHist[c], p));
    console.log(
      `  ${"RGB"[c]}: new-area p1/p50/p99 ${from[0]}/${from[3]}/${from[6]}  →  original ${to[0]}/${to[3]}/${to[6]}`
    );
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v += 1) {
      let out;
      if (v <= from[0]) out = to[0] + (v - from[0]);
      else if (v >= from[from.length - 1]) out = to[to.length - 1] + (v - from[from.length - 1]);
      else {
        let k = 0;
        while (k < from.length - 2 && v > from[k + 1]) k += 1;
        const span = Math.max(1, from[k + 1] - from[k]);
        const t = (v - from[k]) / span;
        out = to[k] + t * (to[k + 1] - to[k]);
      }
      lut[v] = Math.min(255, Math.max(0, Math.round(out)));
    }
    return lut;
  });

  for (let y = 0; y < finalHeight; y += 1)
    for (let x = 0; x < finalWidth; x += 1) {
      const gi = (y * finalWidth + x) * gC;
      const ci = (y * finalWidth + x) * 3;
      for (let c = 0; c < 3; c += 1) corrected[ci + c] = luts[c][gData[gi + c]];
    }
} else {
  for (let y = 0; y < finalHeight; y += 1)
    for (let x = 0; x < finalWidth; x += 1) {
      const gi = (y * finalWidth + x) * gC;
      const ci = (y * finalWidth + x) * 3;
      for (let c = 0; c < 3; c += 1) corrected[ci + c] = gData[gi + c];
    }
}

/**
 * Making the new painting's paper match the original's, locally.
 *
 * The global percentile match above fixes the new area's overall distribution,
 * which is what pulled its ink back into range. It cannot fix the paper: aged
 * silk is not one tone, it drifts across the sheet, so a single global match
 * leaves the generated paper a shade off from the original paper AT THE JOIN,
 * and that shows as a faint line even when everything else agrees.
 *
 * So the base tone is matched where it actually has to agree. A per-row offset
 * is measured in a strip just inside the join and applied to the new area,
 * which makes the paper continuous across the boundary by construction rather
 * than on average.
 *
 * This also replaces a wide low-frequency crossfade that was here before and
 * was quietly wrong: its ramp faded the ORIGINAL out over its last 620px, so
 * real painting was being replaced by generated painting on the approach to the
 * join. Now the original is kept at full strength all the way to its edge, and
 * only detail hands over, across a narrow band.
 */
const STRIP = 160;
const DETAIL_BLEND = 56;
const BASE_SIGMA = 34;
const SMOOTH = 90;
const MAX_DELTA = 40;

const growsRight = finalWidth > width + 4;
const growsDown = finalHeight > height + 4;

const originalFull = Buffer.alloc(finalWidth * finalHeight * 3);
for (let y = 0; y < finalHeight; y += 1) {
  const sy = Math.min(height - 1, y);
  for (let x = 0; x < finalWidth; x += 1) {
    const sx = Math.min(width - 1, x);
    const si = (sy * width + sx) * oC;
    const di = (y * finalWidth + x) * 3;
    originalFull[di] = oData[si];
    originalFull[di + 1] = oData[si + 1];
    originalFull[di + 2] = oData[si + 2];
  }
}

const blur = async (buf) =>
  sharp(buf, { raw: { width: finalWidth, height: finalHeight, channels: 3 } })
    .blur(BASE_SIGMA)
    .raw()
    .toBuffer();

const [origBase, genBase] = await Promise.all([blur(originalFull), blur(corrected)]);

const smooth1d = (arr, radius) => {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i += 1) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = i + k;
      if (j < 0 || j >= arr.length) continue;
      sum += arr[j];
      n += 1;
    }
    out[i] = sum / n;
  }
  return out;
};

const clamp = (v) => Math.max(-MAX_DELTA, Math.min(MAX_DELTA, v));

/** Per-row offset for the right join, per-column for the bottom one. */
const dRight = [0, 1, 2].map(() => new Float32Array(finalHeight));
const dDown = [0, 1, 2].map(() => new Float32Array(finalWidth));

if (growsRight) {
  for (let c = 0; c < 3; c += 1) {
    const raw = new Float32Array(finalHeight);
    for (let y = 0; y < finalHeight; y += 1) {
      let sum = 0;
      let n = 0;
      for (let x = Math.max(0, width - STRIP); x < width; x += 1) {
        const i = (y * finalWidth + x) * 3 + c;
        sum += origBase[i] - genBase[i];
        n += 1;
      }
      raw[y] = n ? sum / n : 0;
    }
    dRight[c] = smooth1d(raw, SMOOTH);
  }
}

if (growsDown) {
  for (let c = 0; c < 3; c += 1) {
    const raw = new Float32Array(finalWidth);
    for (let x = 0; x < finalWidth; x += 1) {
      let sum = 0;
      let n = 0;
      for (let y = Math.max(0, height - STRIP); y < height; y += 1) {
        const i = (y * finalWidth + x) * 3 + c;
        sum += origBase[i] - genBase[i];
        n += 1;
      }
      raw[x] = n ? sum / n : 0;
    }
    dDown[c] = smooth1d(raw, SMOOTH);
  }
}

const smoothstep2 = (t) => t * t * (3 - 2 * t);

const out = Buffer.alloc(finalWidth * finalHeight * 3);
for (let y = 0; y < finalHeight; y += 1) {
  for (let x = 0; x < finalWidth; x += 1) {
    const i = (y * finalWidth + x) * 3;
    const inside = x < width && y < height;

    // Which offset applies out here, and how much of each at the corner.
    const useR = growsRight && x >= width;
    const useD = growsDown && y >= height;

    for (let c = 0; c < 3; c += 1) {
      let delta = 0;
      if (useR && useD) delta = (clamp(dRight[c][y]) + clamp(dDown[c][x])) / 2;
      else if (useR) delta = clamp(dRight[c][y]);
      else if (useD) delta = clamp(dDown[c][x]);

      if (!inside) {
        out[i + c] = Math.min(255, Math.max(0, Math.round(corrected[i + c] + delta)));
        continue;
      }

      /**
       * Inside the original: keep its base untouched, and hand the DETAIL over
       * to the generated image across a narrow band so no hard edge of texture
       * forms at the boundary.
       */
      const dR = growsRight ? (width - x) / DETAIL_BLEND : Infinity;
      const dB = growsDown ? (height - y) / DETAIL_BLEND : Infinity;
      const w = smoothstep2(Math.min(1, Math.max(0, Math.min(dR, dB))));

      const detail =
        (originalFull[i + c] - origBase[i + c]) * w +
        (corrected[i + c] - genBase[i + c]) * (1 - w);

      out[i + c] = Math.min(255, Math.max(0, Math.round(origBase[i + c] + detail)));
    }
  }
}

// Gitignored, so it does not exist on a fresh clone.
await mkdir(OUT, { recursive: true });
const outPath = join(OUT, `${name}.png`);
await sharp(out, { raw: { width: finalWidth, height: finalHeight, channels: 3 } })
  .png()
  .toFile(outPath);

console.log(`  paper matched per row at the join, detail handed over across ${DETAIL_BLEND}px`);
console.log(`  wrote ${outPath}`);
