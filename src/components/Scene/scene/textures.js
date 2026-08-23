import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

/**
 * Canvas-generated textures.
 *
 * Every soft edge in this scene comes from here rather than from an image
 * file: no network request, no asset to optimise, and the gradients stay
 * exactly on-palette because they are written from the same hex values the
 * rest of the site uses.
 */

const makeCanvas = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const finish = (canvas) => {
  const texture = new CanvasTexture(canvas);
  // These are smooth gradients with no detail to preserve, so mipmaps would
  // only cost memory and introduce shimmer at grazing sizes.
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  // REQUIRED. Canvas gradients are authored in sRGB, but three defaults a
  // CanvasTexture to no colour space and therefore treats these bytes as
  // linear, re-encoding them on output and washing every colour out. Without
  // this the vermillion sun renders as pale pink: #C23B3B measured as
  // [224,139,137] instead of [197,72,69], which is exactly linear-to-sRGB
  // applied one time too many.
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

/**
 * Soft round dot, white so a material's own colour can tint it.
 * Used as the sprite for the drifting motes.
 */
export const makeMoteTexture = () => {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const r = size / 2;

  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finish(canvas);
};

/**
 * Number of independent cloud lanes stacked in the texture.
 *
 * Each band in the scene samples a DIFFERENT one. Every band used to clone the
 * same texture at the same offset, so all five drew the same shapes on top of
 * each other: stacking them added opacity but no volume, and the eye read one
 * flat layer however dense it got. Different shapes at different depths is what
 * makes overlapping cloud look thick.
 */
export const CLOUD_LANES = 3;

/**
 * A drifting bank of cloud.
 *
 * Four things decide whether this reads as weather or as a bar sliding across
 * the screen, and earlier versions got each of them wrong in turn.
 *
 * COLOUR must be LIGHTER than the landscape. The first version painted these in
 * the page beige (226,215,187), about eight levels off the painting's own
 * paper, so even at full opacity a cloud shifted what it covered by roughly
 * three levels. Measured against a build with clouds off, the whole system was
 * moving the image by half a level.
 *
 * PROPORTION matters because the texture maps onto a plane far wider than it is
 * tall. At 4:1 against a plane nearer 6:1 every shape arrived stretched half
 * again wider than drawn, which is what turned them into streaks.
 *
 * EVENNESS: a field of similar blobs along one row averages into a bar however
 * irregular each blob is. So each lane is built from a few large masses, widely
 * spaced and jittered off any grid, then smaller wisps over them.
 *
 * VARIETY between lanes, per the note above.
 *
 * TILES HORIZONTALLY. Every shape is drawn again one width to each side, so the
 * texture can scroll forever with `offset.x` without a seam.
 */
export const makeCloudTexture = () => {
  const width = 1024;
  const laneHeight = 384;
  const height = laneHeight * CLOUD_LANES;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");

  /**
   * Deterministic: the cloud field is part of the composition, so it must be
   * identical on every load rather than reshuffling on each visit.
   */
  let seed = 20260812;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  /** @param {number} laneTop Y of the lane this blob belongs to. */
  const blob = (laneTop, x, y, rx, ry, alpha) => {
    /**
     * Falloff is measured WITHIN the lane, eased rather than linear. Linear
     * gives the bank a straight soft top and bottom, which is exactly the pair
     * of horizontal lines this is trying not to be.
     */
    const local = (y - laneTop) / laneHeight;
    const e = Math.max(0, 1 - Math.abs(local - 0.5) * 2);
    const a = alpha * e * e * (3 - 2 * e);
    if (a <= 0.001) return;

    const r = Math.max(rx, ry);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(240,232,213,${a})`);
    gradient.addColorStop(0.45, `rgba(240,232,213,${a * 0.55})`);
    gradient.addColorStop(1, "rgba(240,232,213,0)");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / r, ry / r);
    ctx.translate(-x, -y);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  for (let lane = 0; lane < CLOUD_LANES; lane += 1) {
    const laneTop = lane * laneHeight;

    const MASSES = 9;
    for (let i = 0; i < MASSES; i += 1) {
      const x = ((i + 0.5) / MASSES + (random() - 0.5) * 0.75) * width;
      const y = laneTop + laneHeight * (0.28 + random() * 0.44);
      const rx = width * (0.05 + random() * 0.06);
      const ry = laneHeight * (0.2 + random() * 0.22);
      const alpha = 0.68 + random() * 0.32;

      blob(laneTop, x, y, rx, ry, alpha);
      blob(laneTop, x - width, y, rx, ry, alpha);
      blob(laneTop, x + width, y, rx, ry, alpha);
    }

    for (let i = 0; i < 18; i += 1) {
      const x = random() * width;
      const y = laneTop + laneHeight * (0.22 + random() * 0.56);
      const rx = width * (0.018 + random() * 0.032);
      const ry = laneHeight * (0.08 + random() * 0.12);
      const alpha = 0.3 + random() * 0.34;

      blob(laneTop, x, y, rx, ry, alpha);
      blob(laneTop, x - width, y, rx, ry, alpha);
      blob(laneTop, x + width, y, rx, ry, alpha);
    }
  }

  return finish(canvas);
};
