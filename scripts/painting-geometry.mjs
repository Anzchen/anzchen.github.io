/**
 * The one place the hero painting's geometry is defined.
 *
 * These numbers were measured off the source scroll and off the camera rig, and
 * they were previously duplicated across make-painting-layers.mjs and
 * export-painting-cuts.mjs with "must match X" comments as the only
 * enforcement. 2483 appeared three ways (as a literal, as CROP_RIGHT minus
 * CROP_LEFT, and in the emitted manifest); the visible rows, the pan distance,
 * the field of view and the four layer depths each appeared two or three times.
 * A comment cannot fail a build, so any retune had to be applied by hand in
 * every copy or the two scripts would silently disagree about where a layer is.
 */

/**
 * The blank mount around the painted field, measured off the source: the
 * painting occupies x 39-2521 and ends at row 4562, with paper-toned margin
 * outside that. It has to be cropped, because the layers are right-aligned and
 * each one otherwise carries its own 38px margin to the frame edge, where
 * parallax slides them against each other as a drifting pale strip.
 */
export const CROP_LEFT = 39;
export const CROP_RIGHT = 2522;
export const CROP_BOTTOM = 4562;

/** Width of the painted field. What gets aligned to the frame's right edge. */
export const ORIGINAL_WIDTH = CROP_RIGHT - CROP_LEFT;

/**
 * The rows the desktop hero actually shows, derived from the original CSS
 * (`bg-cover bg-center` in a right-58% container at 16:10). Everything outside
 * is bleed for the camera move.
 */
export const VISIBLE_TOP = 921;
export const VISIBLE_BOTTOM = 3679;
export const VISIBLE_ROWS = VISIBLE_BOTTOM - VISIBLE_TOP;

/** Straight from scene/createInkScene.js and scene/cameraPath.js. */
export const FOV = 42;
export const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));
export const PAN_DISTANCE = 3.5;
export const RISE = 3.0;
export const DOLLY = 3.6;

/** Rows over which a layer dissolves once the layer in front takes over. */
export const BOTTOM_FADE = 300;

/**
 * The four depth bands.
 *
 * `srcTop` is the painting row each source begins at, `seam` the nominal row
 * the layer starts being visible, `depth` its place in the scene, and `base`
 * the output width the ORIGINAL region is rendered at.
 */
export const LAYERS = [
  { name: "far", srcTop: 921, seam: 921, carve: false, base: 1100, depth: 34 },
  { name: "mid", srcTop: 1210, seam: 1380, carve: true, base: 1300, depth: 26 },
  { name: "near", srcTop: 1970, seam: 2140, carve: true, base: 1500, depth: 19 },
  { name: "front", srcTop: 2590, seam: 2760, carve: true, base: 1500, depth: 13 },
];

/** World units per source pixel at a given depth. */
export const worldPerPixel = (depth) => (2 * TAN_HALF_FOV * depth) / VISIBLE_ROWS;

/** On-screen rise of a layer at full scroll, in source rows. */
export const riseRows = (depth) => (RISE / (TAN_HALF_FOV * (depth - DOLLY)) / 2) * VISIBLE_ROWS;

/**
 * Where a layer stops carrying content, once the layer in front covers it.
 * Null for the frontmost, which runs to the bottom of the painting.
 */
export const fadeFromFor = (index) => {
  const next = LAYERS[index + 1];
  // The hold has to clear the next layer's feather, or the crossfade opens
  // onto bare paper.
  return next ? next.seam + 260 : null;
};
