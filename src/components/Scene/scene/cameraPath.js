/**
 * Scroll-driven camera.
 *
 * The camera is deliberately NOT bound 1:1 to scroll. Scroll sets a target;
 * the camera eases toward it every frame. That lag between input and response
 * is the whole reason this reads as a camera move rather than a parallax
 * trick — the scene keeps drifting for a beat after the wheel stops. It
 * matters more over a long journey, not less.
 *
 * Two independent inputs, from src/lib/sceneScroll.js:
 *
 *   descend — vertical travel across the document, pinned span excluded
 *   pan     — 0..1 through the pinned Experience section, which scrolls
 *             sideways rather than down
 */

/** Per-frame approach rate toward the target. Lower drifts longer. */
const LERP = 0.055;

/** Rest pose. */
const BASE_Y = 0;
const BASE_Z = 0;

/**
 * Vertical journey, across the whole document rather than one viewport.
 *
 * RISE is negative — the camera settles downward, which lifts the range up the
 * frame. That direction matters: the canvas is fixed while sections scroll up
 * over it, so a camera that rose would push the ridges down into the incoming
 * content and they would simply vanish. Descending makes the range climb ahead
 * of the fold instead, and because near ridges shift far more than distant
 * ones, the climb reads as parallax.
 *
 * Sized against measured geometry, not guessed: the pinned Experience section
 * eats 8515 of the page's 10315 scrollable pixels, so `descend` actually spans
 * only ~1800px — about two viewports. The hero is the first HALF of it. These
 * totals are therefore ~2x the old one-viewport values, which keeps the hero
 * moving at the rate it already does.
 *
 * DOLLY is capped well short of the nearest ridge (depth 9). At 3.6 the camera
 * closes to 5.4 units at most; the obvious-looking larger value flew the camera
 * straight through the foreground silhouette.
 */
const RISE = -3.0;
const DOLLY = 3.6;
const TILT = 0.05; // radians; the horizon settles as the camera drops

/**
 * Lateral travel through the pinned section.
 *
 * Sign matters and is easy to get backwards. The card track translates by
 * `-scrollWidth * progress`, i.e. content moves LEFT as progress rises, which
 * reads as the viewer moving RIGHT. So the camera moves +x to travel with the
 * cards. Moving it -x would slide the world against them and feel subtly wrong
 * without being obviously broken.
 *
 * Kept modest on purpose. Every unit of pan has to be paid for in range width
 * (see PAN_DISTANCE in ranges.js), and a wider plane spreads the same painting
 * over more world, magnifying the brushwork. 3.5 reads clearly as travel across
 * 8515px of scroll while staying inside the existing geometry budget at
 * ultrawide.
 */
const PAN_X = 3.5;

/** A slight yaw into the direction of travel, so the pan is a look, not a slide. */
const PAN_YAW = -0.03;

export const createCameraRig = (camera) => {
  let easedDescend = 0;
  let easedPan = 0;

  camera.position.set(0, BASE_Y, BASE_Z);

  return {
    /**
     * @param {number} descend 0 at the top of the document, 1 at the bottom.
     * @param {number} pan     0..1 across the pinned horizontal section.
     * @param {boolean} [snap] Jump straight to the target (first frame, or
     *                         reduced-motion, where easing must not animate).
     */
    update(descend, pan, snap = false) {
      if (snap) {
        easedDescend = descend;
        easedPan = pan;
      } else {
        easedDescend += (descend - easedDescend) * LERP;
        easedPan += (pan - easedPan) * LERP;
      }

      camera.position.x = easedPan * PAN_X;
      camera.position.y = BASE_Y + easedDescend * RISE;
      camera.position.z = BASE_Z - easedDescend * DOLLY;

      camera.rotation.x = easedDescend * TILT;
      camera.rotation.y = easedPan * PAN_YAW;
    },
  };
};

/** How far the camera travels sideways — needed to size the ridges. */
export const PAN_DISTANCE = PAN_X;
