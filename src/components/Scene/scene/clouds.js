import { Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping } from "three";
import { makeCloudTexture } from "./textures";

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
 * clear day. `gain` is how much scroll adds. The frontmost band carries most of
 * the recession because it is the only one in front of every painting layer,
 * and it rests at almost nothing so it never fogs the hero itself.
 */
const BANDS = [
  { depth: 8, yFrac: -0.1, heightFrac: 1.5, base: 0.0, gain: 0.62, speed: 0.0125 },
  { depth: 11, yFrac: -0.42, heightFrac: 0.85, base: 0.16, gain: 0.3, speed: 0.009 },
  { depth: 16, yFrac: -0.3, heightFrac: 0.8, base: 0.2, gain: 0.26, speed: 0.0062 },
  { depth: 22, yFrac: -0.16, heightFrac: 0.75, base: 0.22, gain: 0.2, speed: 0.0043 },
  { depth: 30, yFrac: 0.02, heightFrac: 0.7, base: 0.24, gain: 0.16, speed: 0.0028 },
];

/**
 * Drift is applied to the TEXTURE offset, not to the mesh position.
 *
 * Moving the geometry would eventually run a band's own end into frame, which
 * is why the old mist planes had to be built absurdly wide. Scrolling a
 * horizontally-tiling texture across a fixed plane drifts forever at no cost,
 * and the cloud texture is authored to wrap seamlessly for exactly this.
 */
export const createClouds = (tanHalfFov) => {
  const texture = makeCloudTexture();
  texture.wrapS = RepeatWrapping;

  const bands = BANDS.map(({ depth, yFrac, heightFrac, base, gain, speed }) => {
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
    // A cloned texture shares the image but keeps its own offset, so each band
    // can drift at its own rate off one decode.
    material.map.wrapS = RepeatWrapping;
    material.map.needsUpdate = true;

    const mesh = new Mesh(
      new PlaneGeometry(depth * 3.4, halfHeight * heightFrac),
      material
    );
    mesh.position.set(0, halfHeight * yFrac, -depth);
    // Just in front of the painting layer at this depth, so it veils it.
    mesh.renderOrder = -Math.round(depth);

    return { mesh, material, base, gain, speed };
  });

  return {
    objects: bands.map((band) => band.mesh),

    /** @param {number} elapsed Seconds since the scene started. */
    update(elapsed) {
      bands.forEach((band) => {
        band.material.map.offset.x = (elapsed * band.speed) % 1;
      });
    },

    /**
     * @param {number} t 0 at the top of the document, 1 once the scene should
     *                   have fully receded behind the page content.
     */
    setThicken(t) {
      bands.forEach((band) => {
        band.material.opacity = band.base + band.gain * t;
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
