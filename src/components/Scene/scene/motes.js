import { BufferAttribute, BufferGeometry, NormalBlending, Points, PointsMaterial } from "three";
import { makeMoteTexture } from "./textures";

/**
 * Drifting ink motes.
 *
 * A single Points object, so the whole field is one draw call regardless of
 * count. Positions are advanced on the CPU because 300 particles is nothing
 * and it keeps the whole scene on stock materials — no custom shader to
 * maintain for an effect this small.
 */

const COUNT = 300;
const COUNT_MOBILE = 110;

/** The slab the motes occupy, in front of the nearest ridge. */
const SPREAD_X = 20;
const TOP = 8;
const BOTTOM = -7;
const NEAR_Z = -3;
const FAR_Z = -20;

/**
 * A deterministic pseudo-random source. The composition should be identical
 * on every load — the same reason the ridgelines use summed sines — so this
 * cannot use Math.random().
 */
const seeded = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

export const createMotes = (color, { mobile = false } = {}) => {
  const count = mobile ? COUNT_MOBILE : COUNT;
  const random = seeded(20260809);

  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count); // fall speed
  const sway = new Float32Array(count); // lateral amplitude
  const phase = new Float32Array(count); // sway offset

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * SPREAD_X * 2;
    positions[i * 3 + 1] = BOTTOM + random() * (TOP - BOTTOM);
    positions[i * 3 + 2] = NEAR_Z + random() * (FAR_Z - NEAR_Z);

    drift[i] = 0.055 + random() * 0.13;
    sway[i] = 0.12 + random() * 0.36;
    phase[i] = random() * Math.PI * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color,
    map: makeMoteTexture(),
    // Deliberately small and faint. Larger or darker than this and they stop
    // reading as motes suspended in air and start reading as sensor dust on
    // the open beige sky.
    size: 0.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    // Normal blending, stated explicitly. Additive lightens toward white,
    // which on a light beige page would make the motes glow instead of
    // reading as ink settling through the air.
    blending: NormalBlending,
  });

  const points = new Points(geometry, material);
  points.renderOrder = 10; // in front of every ridge

  const attribute = geometry.getAttribute("position");

  return {
    object: points,
    /**
     * @param {number} delta   Seconds since the last frame.
     * @param {number} elapsed Seconds since the scene started.
     */
    update(delta, elapsed) {
      const array = attribute.array;

      for (let i = 0; i < count; i += 1) {
        const y = i * 3 + 1;
        array[y] -= drift[i] * delta;

        if (array[y] < BOTTOM) {
          array[y] = TOP;
        }

        // Lateral sway is derived from elapsed time rather than accumulated,
        // so it never drifts out of its lane over a long session.
        array[i * 3] += Math.sin(elapsed * 0.35 + phase[i]) * sway[i] * delta;
      }

      attribute.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.map.dispose();
      material.dispose();
    },
  };
};
