import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import farUrl from "../../../assets/painting/far.webp";
import frontUrl from "../../../assets/painting/front.webp";
import midUrl from "../../../assets/painting/mid.webp";
import nearUrl from "../../../assets/painting/near.webp";
import manifest from "../../../assets/painting/layers.json";
import { PAN_DISTANCE } from "./cameraPath";

/**
 * The hero painting, as parallax depth planes.
 *
 * The scroll painting used to be one flat DOM element pinned to the right 58%
 * of the hero. It is now four planes cut along the painting's own mist bands
 * (see scripts/make-painting-layers.mjs) sitting at four depths, so the camera
 * move produces genuine parallax and occlusion instead of sliding a picture.
 *
 * The composition it restores is the one that worked: mass on the RIGHT, the
 * left 42% left as open beige for the text column. An earlier attempt with
 * generated ink ranges spanning the FULL width is what made the hero read as
 * cluttered — the type had nothing to sit on.
 */

const SOURCES = { far: farUrl, mid: midUrl, near: nearUrl, front: frontUrl };

/**
 * Source geometry, read from the manifest the cutting script emits rather than
 * copied here.
 *
 * These numbers are measured off the painting — where its mount ends, and which
 * row each layer's carved seam actually reached — so they move whenever a seam
 * is retuned. Hand-copying them would silently mis-place every layer the next
 * time the script runs.
 */
const { originalWidth: ORIGINAL_WIDTH, visibleTop: VISIBLE_TOP, visibleBottom: VISIBLE_BOTTOM } = manifest;
const VISIBLE_ROWS = VISIBLE_BOTTOM - VISIBLE_TOP;

/**
 * Depths, front to back. The spread is what the parallax is made of: over the
 * camera's 3.6-unit dolly the front layer closes by 28% while the far layer
 * closes by 11%, so they separate as you travel.
 *
 * `top` is the source row each layer starts at, and must match the cutting
 * script — it places the layer vertically.
 */
/**
 * Depths come from the manifest, which the cutting script emits.
 *
 * They used to be a hand-maintained table here, duplicating the one in
 * make-painting-layers.mjs. Renaming or adding a layer there resolved to
 * undefined here and propagated as NaN into scale and renderOrder, with a
 * request for "/undefined" for the texture — no error, just a broken scene.
 * Failing loudly is better: the throw reaches InkScene's catch, which shows the
 * flat painting AND fires scene:ready.
 */
const LAYERS = manifest.layers.map((layer) => {
  if (!SOURCES[layer.name] || typeof layer.depth !== "number") {
    throw new Error(
      `[createPainting] layers.json has no source or depth for "${layer.name}" — regenerate with scripts/make-painting-layers.mjs`
    );
  }
  return layer;
});

const createLayer = (layer, tanHalfFov, loader, onLoad) => {
  const { name, top, rows, width: sourceWidth, depth } = layer;

  const halfHeight = tanHalfFov * depth;

  /**
   * onError matters as much as onLoad here. Without it a 404 or a decode
   * failure never calls settle(), so `pending` never reaches zero and
   * scene:ready is never dispatched — silently. The preloader's own timeout
   * still reveals the page, so the visitor gets a landscape missing a depth
   * plane and nothing is logged anywhere.
   */
  const texture = loader.load(SOURCES[name], onLoad, undefined, (error) => {
    console.error("[createLayer] painting layer failed to load:", {
      name,
      url: SOURCES[name],
      error,
    });
    // Settle anyway: a missing layer is degradation, a scene that never
    // announces is a page that never reveals.
    onLoad();
  });
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  /**
   * Mipmaps ON here, unlike the ink plates. This painting is fine-lined
   * gongbi detail — foliage, roof tiles, figures — being minified by roughly
   * 2x, and unmipmapped minification of detail that dense aliases into
   * shimmer the moment the camera moves.
   */
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    // Off, so the feathered top edges blend into the layer behind instead of
    // punching a hole in it. Order comes from renderOrder below.
    depthWrite: false,
    fog: true,
  });

  /**
   * Geometry is authored in SOURCE PIXELS and scaled at layout time, so that
   * changing viewport is a scale change rather than a geometry rebuild.
   */
  const mesh = new Mesh(new PlaneGeometry(sourceWidth, rows), material);
  mesh.renderOrder = -Math.round(depth); // farthest first

  let baseX = 0;
  let pan = 0;
  /** 1 = fully locked to the pan, 0 = full lateral parallax. */
  let follow = 1;

  return {
    mesh,
    /**
     * Placement depends on the ACTUAL aspect, not the reference one.
     *
     * Pinning the right edge to the reference frustum instead put the painting
     * mostly off-screen on a portrait phone: the visible window landed on the
     * painting's empty left margin, inside the baked left fade, so the hero
     * showed a blank sliver. Anything positioned against frustum WIDTH has to
     * be re-laid-out whenever the aspect changes.
     */
    layout(aspect) {
      const halfWidth = halfHeight * aspect;

      /**
       * One scale at every viewport: the rows the original CSS showed, spanning
       * the frame height. Width then follows from the painting's own aspect and
       * is allowed to overflow.
       *
       * Fitting the width instead was tried and is wrong. It shrinks the
       * painting on a phone until it occupies only the bottom corner, leaving
       * two thirds of the screen empty — whereas the flat version used
       * `bg-cover`, which crops the overflow and keeps the landscape filling
       * the frame. Overflow is the correct behaviour: the plane is
       * right-aligned, so what a narrow frame crops away is the painting's
       * empty left margin, and the mountain and village stay in view.
       */
      const scale = (2 * halfHeight) / VISIBLE_ROWS;

      mesh.scale.set(scale, scale, 1);

      /**
       * The ORIGINAL painting's right edge meets the frame's right edge, not
       * the expanded source's. Everything the AI added extends past it and sits
       * off screen as headroom for the lateral pan, rather than shoving the
       * composition left.
       */
      baseX = halfWidth + (sourceWidth * scale) / 2 - ORIGINAL_WIDTH * scale;

      /**
       * How much lateral parallax this layer can afford, derived from how far
       * its painting extends past the composition rather than chosen by hand.
       *
       * Parallax moves a plane LEFT relative to the frame, by (1 - follow)
       * times the pan, so a layer can only give up as much follow as it has
       * painting to spare on the right. Layers that were expanded generously
       * come out at 0 and parallax freely; one that came back without its
       * rightward expansion stays locked, and starts moving on its own the
       * moment a wider source is dropped in.
       */
      const headroom = (sourceWidth - ORIGINAL_WIDTH) * scale;
      follow = Math.min(1, Math.max(0, 1 - headroom / PAN_DISTANCE));

      mesh.position.x = baseX + pan * follow;
      /**
       * Anchored from the BOTTOM of the visible band rather than the top.
       * Both are equivalent at the authored aspect, but only bottom-anchoring
       * degrades sensibly when the scale shrinks: the landscape keeps sitting
       * on the foot of the frame instead of floating up it and leaving the
       * lower half of a phone screen empty.
       */
      mesh.position.y = -halfHeight + (VISIBLE_BOTTOM - top) * scale - (rows * scale) / 2;
      mesh.position.z = -depth;
    },

    /**
     * Tracks the camera's lateral pan one-for-one.
     *
     * The painting is only as wide as it is, so any lateral parallax walks its
     * right edge into frame: the pinned section pans the camera 3.5 units and
     * each layer's edge projects to a different screen x (offset ∝ pan/depth),
     * which showed up as a staircase of hard vertical edges migrating across
     * the right of the screen as you scrolled.
     *
     * Locking is the only fix that cannot expose it. Parallax in the correct
     * direction — nearer layers sliding further against the background —
     * necessarily moves the plane LEFT relative to the frame, so there is no
     * follow factor that both parallaxes and stays covered. Widening the
     * geometry is no better, since the painting has no more content to show
     * and the extra would have to be mirrored or smeared.
     *
     * Nothing much is lost: the depth in this scene comes from the vertical
     * descent and the dolly, which are untouched, and the clouds still drift
     * laterally across the layers during the pan.
     */
    setPan(cameraX) {
      pan = cameraX;
      mesh.position.x = baseX + pan * follow;
    },
  };
};

/**
 * @param {number} tanHalfFov
 * @param {() => void} onReady Fired once every layer has decoded.
 */
export const createPainting = (tanHalfFov, onReady) => {
  let pending = LAYERS.length;

  const settle = () => {
    pending -= 1;
    if (pending === 0) onReady();
  };

  const loader = new TextureLoader();
  const layers = LAYERS.map((layer) => createLayer(layer, tanHalfFov, loader, settle));

  return {
    objects: layers.map((layer) => layer.mesh),
    /** Must be called on every resize — placement depends on aspect. */
    layout(aspect) {
      layers.forEach((layer) => layer.layout(aspect));
    },
    /** Must be called before every render — see setPan on the layer. */
    setPan(cameraX) {
      layers.forEach((layer) => layer.setPan(cameraX));
    },
    dispose() {
      layers.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.map?.dispose();
        mesh.material.dispose();
      });
    },
  };
};
