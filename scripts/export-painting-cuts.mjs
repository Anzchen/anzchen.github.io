/**
 * Exports each depth band as a flat image, for extending with AI.
 *
 * Two things constrain the numbers below, and they come from opposite ends.
 *
 * RIGHT: the painting has a finite right edge and the camera pans 3.5 units
 * sideways, which walks that edge into frame. The scene currently pins the
 * painting to the pan to hide it, at the cost of all lateral parallax; new
 * painting on the right buys that back.
 *
 * DOWN: each layer is now a band that dissolves once the layer in front takes
 * over, which is what stopped the page compositing the landscape against
 * displaced copies of itself. The cost is that a band is short, and its lower
 * edge dissolves into bare paper. Real painting below it means the dissolve can
 * be pushed out of frame instead.
 *
 * The down amounts are each band's own measured separation from the layer in
 * front of it, plus the dissolve, plus margin — so the invented ground stays
 * behind the nearer layer even at full scroll.
 *
 * Run: node scripts/export-painting-cuts.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOTTOM_FADE,
  CROP_BOTTOM,
  CROP_LEFT,
  LAYERS,
  ORIGINAL_WIDTH,
  PAN_DISTANCE,
  fadeFromFor,
  riseRows,
  worldPerPixel,
} from "./painting-geometry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src/assets/images/background2560.webp");
const OUT = join(homedir(), "Documents/painting-cuts");

/** Breathing room, since the eased camera overshoots its target slightly. */
const SAFETY = 1.15;

await mkdir(OUT, { recursive: true });

const spec = [];

for (let i = 0; i < LAYERS.length; i += 1) {
  const { name, srcTop: top, depth } = LAYERS[i];
  // Where this band stops carrying content, from the shared geometry.
  const fadeFrom = fadeFromFor(i);
  const bottom = Math.min(CROP_BOTTOM, fadeFrom ? fadeFrom + BOTTOM_FADE : CROP_BOTTOM);
  const height = bottom - top;

  await sharp(SRC)
    .extract({ left: CROP_LEFT, top, width: ORIGINAL_WIDTH, height })
    .png()
    .toFile(join(OUT, `${name}.png`));

  /**
   * World units per source pixel scale with depth, so the same 3.5-unit pan
   * costs the nearest band nearly three times the pixels of the farthest.
   */
  const expandRight = Math.ceil((PAN_DISTANCE / worldPerPixel(depth)) * SAFETY);

  // How far this band separates from the layer in front of it. The backmost
  // has nothing in front, so it has no separation to cover.
  const inFront = i > 0 ? LAYERS[i - 1] : null;
  const separation = inFront ? Math.abs(riseRows(depth) - riseRows(inFront.depth)) : 0;
  const expandDown =
    name === "front" ? 0 : Math.ceil((separation + BOTTOM_FADE) * SAFETY + 300);

  spec.push({ name, width: ORIGINAL_WIDTH, height, expandRight, expandDown });

  console.log(
    `[cuts] ${name}.png  ${ORIGINAL_WIDTH}x${height}  →  right +${expandRight}  down +${expandDown}  ` +
      `(final ${ORIGINAL_WIDTH + expandRight}x${height + expandDown})`
  );
  if (expandDown && inFront) {
    console.log(
      `        separates ${Math.round(separation)} rows from ${inFront.name}, dissolve ${BOTTOM_FADE}`
    );
  }
}

await writeFile(join(OUT, "expand-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`\n[cuts] written to ${OUT}`);
