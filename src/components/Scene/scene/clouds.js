import { Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping } from "three";
import { CLOUD_LANES, makeCloudTexture } from "./textures";

/**
 * Drifting cloud banks, interleaved between the painting's depth planes.
 *
 * These do two jobs that used to be done badly by two different things.
 *
 * As ATMOSPHERE they replace the mist bands that sat between the old ridge
 * layers. Slipping haze between depth planes is what sells them as being at
 * different distances, and it is also what the source painting does — its
 * depth planes are separated by exactly these bands of empty mist.
 *
 * As RECESSION they replace `.backdrop-veil`, a single beige rectangle whose
 * opacity was raised on scroll to push the scene behind the page content. That
 * was the wrong mechanism: dimming a picture flattens it, because every depth
 * cue fades at the same rate. Cloud thickening in FRONT of the layers instead
 * takes the landscape away the way weather does, and the layers keep their
 * separation the whole way down.
 */

/**
 * Bands, front to back, interleaved with the painting depths (13/19/26/34).
 *
 * `base` is the resting opacity — barely there, since the hero has to read as a
 * clear day. `gain` is how much the first viewport of scroll adds. The frontmost
 * band carries most of the recession because it is the only one in front of
 * every painting layer, and it rests at almost nothing so it never fogs the hero
 * itself.
 *
 * `deep` is a second, later thickening that only arrives at the very bottom of
 * the document. `gain` is spent within the first viewport and then holds flat
 * for the remaining eleven, which was fine until the footer: by then the pan has
 * carried the painting's dense village to the middle of the frame, directly
 * under the contact details, and the cover that was enough over the timeline is
 * not enough over small text. Only the frontmost band takes it, so the layers
 * behind keep their separation instead of the whole scene going flat.
 */
const BANDS = [
  { depth: 8, yFrac: -0.1, heightFrac: 1.5, base: 0.0, gain: 0.8, deep: 0.3 },
  { depth: 11, yFrac: -0.42, heightFrac: 1.05, base: 0.3, gain: 0.4 },
  { depth: 16, yFrac: -0.3, heightFrac: 1.0, base: 0.34, gain: 0.36 },
  { depth: 22, yFrac: -0.16, heightFrac: 0.95, base: 0.34, gain: 0.26 },
  { depth: 30, yFrac: 0.02, heightFrac: 0.9, base: 0.34, gain: 0.2 },
];

/**
 * The cloud field does not animate.
 *
 * It used to drift sideways on the texture offset, with a slow vertical wander
 * layered on to stop that reading as a conveyor. Neither was right: a constant
 * sideways crawl is the wrong kind of motion for a still painting, and the
 * wander only made it harder to place. The banks now sit where they are and the
 * only thing that moves them is the camera, which is the motion the scene is
 * actually about.
 */
export const createClouds = (tanHalfFov) => {
  const texture = makeCloudTexture();
  texture.wrapS = RepeatWrapping;

  const bands = BANDS.map(({ depth, yFrac, heightFrac, base, gain, deep }, index) => {
    const halfHeight = tanHalfFov * depth;

    const material = new MeshBasicMaterial({
      map: texture.clone(),
      transparent: true,
      opacity: base,
      depthWrite: false,
      // These ARE the haze. Letting distance fog dissolve them would be
      // dissolving the atmosphere into itself.
      fog: false,
    });
    /**
     * A cloned texture shares the image but keeps its own offset, so each band
     * drifts at its own rate off a single decode — and, more importantly, reads
     * a DIFFERENT lane of the texture. Every band used to sample the same one,
     * so all five drew identical shapes stacked on each other: that adds
     * opacity but no volume, which is why the field looked flat however dense
     * it got.
     */
    material.map.wrapS = RepeatWrapping;
    material.map.repeat.set(1, 1 / CLOUD_LANES);
    material.map.offset.y = (index % CLOUD_LANES) / CLOUD_LANES;
    material.map.needsUpdate = true;

    const mesh = new Mesh(
      // 2.6 rather than 3.4: a wider plane stretches the texture horizontally,
      // which is half of what made the shapes read as streaks. Still clears the
      // frame at full pan and full dolly.
      new PlaneGeometry(depth * 2.6, halfHeight * heightFrac),
      material
    );
    const baseY = halfHeight * yFrac;
    mesh.position.set(0, baseY, -depth);
    // Just in front of the painting layer at this depth, so it veils it.
    mesh.renderOrder = -Math.round(depth);

    return { mesh, material, base, gain, deep, baseY };
  });

  return {
    objects: bands.map((band) => band.mesh),

    /**
     * Keeps the cloud banks with the camera as it descends.
     *
     * They are weather, not scenery: they belong to the viewer's position
     * rather than to a place in the landscape. Left at fixed world heights they
     * simply scrolled up out of frame over the document's three units of
     * descent, so by the footer the front bank spanned y -2.6 to +2.0 while the
     * visible frame was -4.69 to -1.31. The scene was not under-covered down
     * there, it was uncovered, and raising their opacity did nothing at all
     * because they were no longer on screen.
     *
     * @param {number} cameraY
     */
    follow(cameraY) {
      bands.forEach((band) => {
        band.mesh.position.y = band.baseY + cameraY;
      });
    },

    /**
     * @param {number} t    0 at the top of the document, 1 once the scene should
     *                      have receded behind the page content.
     * @param {number} deep 0 until near the end of the document, 1 at the very
     *                      bottom, where the footer needs more cover than the
     *                      sections above it.
     */
    setThicken(t, deep = 0) {
      bands.forEach((band) => {
        band.material.opacity = band.base + band.gain * t + (band.deep || 0) * deep;
      });
    },

    dispose() {
      bands.forEach(({ mesh, material }) => {
        mesh.geometry.dispose();
        material.map.dispose();
        material.dispose();
      });
      texture.dispose();
    },
  };
};
