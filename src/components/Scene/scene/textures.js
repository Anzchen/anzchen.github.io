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
 * A drifting cloud bank: soft page-beige masses, dense through the middle of
 * the band and thinning to nothing at both edges.
 *
 * Built from overlapping radial blobs rather than a linear gradient. A pure
 * gradient is what the old mist bands used, and it reads as a uniform strip of
 * haze — fine when its only job was softening a silhouette, wrong now that
 * clouds are a visible element that has to look like weather. Irregular masses
 * also break up the horizontal banding that four stacked gradients produced.
 *
 * TILES HORIZONTALLY. Every blob is drawn a second time one width away, so a
 * blob crossing the right edge reappears at the left, and the texture can be
 * scrolled forever with `offset.x` without a visible seam.
 */
export const makeCloudTexture = () => {
  const width = 1024;
  const height = 256;
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

  const blob = (x, y, rx, ry, alpha) => {
    // Vertical falloff on top of the radial one, so the band always thins to
    // nothing at its top and bottom edges no matter where a blob landed.
    const edge = 1 - Math.abs(y / height - 0.5) * 2;
    const a = alpha * Math.max(0, edge);
    if (a <= 0.001) return;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gradient.addColorStop(0, `rgba(226,215,187,${a})`);
    gradient.addColorStop(0.45, `rgba(226,215,187,${a * 0.5})`);
    gradient.addColorStop(1, "rgba(226,215,187,0)");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / Math.max(rx, ry));
    ctx.translate(-x, -y);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  for (let i = 0; i < 26; i += 1) {
    const x = random() * width;
    const y = height * (0.18 + random() * 0.64);
    // Wide and flat: clouds at this scale are stratus, not cumulus, and a
    // circular blob reads as smoke.
    const rx = width * (0.05 + random() * 0.1);
    const ry = height * (0.09 + random() * 0.16);
    const alpha = 0.16 + random() * 0.26;

    blob(x, y, rx, ry, alpha);
    // The wrap copy, so the tile is seamless under horizontal scrolling.
    blob(x - width, y, rx, ry, alpha);
    blob(x + width, y, rx, ry, alpha);
  }

  return finish(canvas);
};
