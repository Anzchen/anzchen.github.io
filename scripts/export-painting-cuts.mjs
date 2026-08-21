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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src/assets/images/background2560.webp");
const OUT = join(homedir(), "Documents/painting-cuts");

/** Must match make-painting-layers.mjs. */
const CROP_LEFT = 39;
const CROP_RIGHT = 2522;
const CROP_BOTTOM = 4562;
const SOURCE_WIDTH = CROP_RIGHT - CROP_LEFT;
const VISIBLE_ROWS = 3679 - 921;
const BOTTOM_FADE = 300;

/** Bands as the cutter currently produces them, with their scene depths. */
const LAYERS = [
  { name: "far", top: 921, bottom: 1940, depth: 34 },
  { name: "mid", top: 1210, bottom: 2700, depth: 26 },
  { name: "near", top: 1970, bottom: 3320, depth: 19 },
  { name: "front", top: 2590, bottom: CROP_BOTTOM, depth: 13 },
];

/** Straight from cameraPath.js. */
const PAN_DISTANCE = 3.5;
const RISE = 3.0;
const DOLLY = 3.6;
const FOV = 42;
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));

/** Breathing room, since the eased camera overshoots its target slightly. */
const SAFETY = 1.15;

/** On-screen rise of a layer at full scroll, in source rows. */
const riseRows = (depth) => (RISE / (TAN_HALF_FOV * (depth - DOLLY)) / 2) * VISIBLE_ROWS;

await mkdir(OUT, { recursive: true });

const spec = [];

for (let i = 0; i < LAYERS.length; i += 1) {
  const { name, top, bottom, depth } = LAYERS[i];
  const height = bottom - top;

  await sharp(SRC)
    .extract({ left: CROP_LEFT, top, width: SOURCE_WIDTH, height })
    .png()
    .toFile(join(OUT, `${name}.png`));

  /**
   * World units per source pixel scale with depth, so the same 3.5-unit pan
   * costs the nearest band nearly three times the pixels of the farthest.
   */
  const worldPerPixel = (2 * TAN_HALF_FOV * depth) / VISIBLE_ROWS;
  const expandRight = Math.ceil((PAN_DISTANCE / worldPerPixel) * SAFETY);

  // How far this band separates from the layer in front of it.
  const inFront = LAYERS[i - 1 >= 0 ? i - 1 : 0];
  const separation = i === 0 ? 0 : Math.abs(riseRows(depth) - riseRows(LAYERS[i - 1].depth));
  const expandDown =
    name === "front" ? 0 : Math.ceil((separation + BOTTOM_FADE) * SAFETY + 300);

  spec.push({ name, width: SOURCE_WIDTH, height, expandRight, expandDown });

  console.log(
    `[cuts] ${name}.png  ${SOURCE_WIDTH}x${height}  →  right +${expandRight}  down +${expandDown}  ` +
      `(final ${SOURCE_WIDTH + expandRight}x${height + expandDown})`
  );
  if (expandDown) {
    console.log(
      `        separates ${Math.round(separation)} rows from ${inFront.name}, dissolve ${BOTTOM_FADE}`
    );
  }
}

await writeFile(join(OUT, "expand-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`\n[cuts] written to ${OUT}`);
