import { Color, FogExp2, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { sceneScroll, updateSceneScroll } from "../../../lib/sceneScroll";
import { createCameraRig } from "./cameraPath";
import { createClouds } from "./clouds";
import { createMotes } from "./motes";
import { createPainting } from "./painting";

/**
 * The live ink-wash backdrop.
 *
 * Framework-free on purpose — React owns the canvas element and nothing else,
 * so no scene state rides on the render cycle.
 */

/** Straight from tailwind.config.js. Fog colour MUST equal the page background. */
const BEIGE = 0xe2d7bb;
const INK = 0x2c2825;

/**
 * Fog is doing double duty. It gives the range its depth, and because its
 * colour is exactly the page beige, every piece of geometry terminates in the
 * background colour by construction — so there is no edge left to seam against
 * the sections below. That seam is the specific problem that killed the
 * earlier darker-background attempts.
 */
/**
 * FogExp2 attenuates as exp(-(density·distance)²).
 *
 * Much thinner than the 0.042 the procedural ridges used, and deliberately so:
 * that value was tuned to make five identical silhouettes recede by dissolving
 * the back ones almost entirely, which is exactly what must NOT happen to a
 * painting. At 0.042 the far layer would come back 87% dissolved and the
 * mountain crown would simply be gone. At 0.012 the four layers land at roughly
 * 2% / 5% / 8% / 15% — enough atmospheric lift to separate them, far too little
 * to erase anything. The clouds carry the haze now; fog only tints.
 */
const FOG_DENSITY = 0.012;

const FOV = 42;

export const createInkScene = (canvas, { reducedMotion = false, fadeTarget = null } = {}) => {
  // The element carrying the published scroll custom property. Defaults to the
  // canvas so the scene still works standalone.
  const backdrop = fadeTarget || canvas;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: !reducedMotion && window.innerWidth > 640,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(new Color(BEIGE), 1);

  const scene = new Scene();
  scene.fog = new FogExp2(BEIGE, FOG_DENSITY);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 120);
  const rig = createCameraRig(camera);

  const tanHalfFov = Math.tan((FOV / 2) * (Math.PI / 180));

  // Textures decode asynchronously, so the reveal has to wait for them or the
  // preloader lifts on an empty beige field. `draw` is called again on arrival
  // because the reduced-motion path renders exactly once, before they land.
  let paintingReady = false;
  const painting = createPainting(tanHalfFov, () => {
    paintingReady = true;
    draw();
  });
  painting.objects.forEach((layer) => scene.add(layer));

  const clouds = createClouds(tanHalfFov);
  clouds.objects.forEach((band) => scene.add(band));

  const motes = createMotes(INK, { mobile: window.innerWidth <= 640 });
  scene.add(motes.object);

  const resize = () => {
    const { innerWidth: w, innerHeight: h } = window;
    // Mobile GPUs get a lower ceiling; a retina phone at full DPR is a lot of
    // fragments for a backdrop nobody is looking at directly.
    const maxDpr = w > 640 ? 2 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // The painting is placed against frustum WIDTH, so it has to be re-laid-out
    // whenever the aspect changes.
    painting.layout(camera.aspect);
  };
  resize();

  let frame = null;
  let running = false;
  let announced = false;

  const draw = () => {
    // Clouds ride with the camera rather than sitting at fixed world heights.
    clouds.follow(camera.position.y);
    renderer.render(scene, camera);
    // Gated on the painting: the first frame now happens before the textures
    // decode, and announcing there would reveal a bare beige field with the
    // landscape popping in a moment later.
    if (!announced && paintingReady) {
      announced = true;
      // Lets the preloader hold its reveal until there is something to reveal.
      window.dispatchEvent(new Event("scene:ready"));
    }
  };

  let lastTime = 0;
  let elapsed = 0;

  /**
   * Below the hero the scene is atmosphere behind text, not the subject, so it
   * runs at half rate. Implemented as a frame SKIP rather than a timer, which
   * keeps every rendered frame aligned to vsync — a setInterval at ~33ms beats
   * against the display clock and reads as stutter, which is worse than the
   * lower rate it buys.
   */
  let skip = false;

  const tick = (now) => {
    frame = requestAnimationFrame(tick);

    const heroInView = window.scrollY < window.innerHeight;
    if (!heroInView) {
      skip = !skip;
      if (skip) return;
    } else {
      skip = false;
    }

    // Delta is clamped because a backgrounded tab resumes with an enormous
    // gap, which would teleport every mote in a single frame.
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    elapsed += delta;

    rig.update(sceneScroll.descend, sceneScroll.pan);
    motes.update(delta, elapsed);
    draw();
  };

  const start = () => {
    if (running || reducedMotion) return;
    running = true;
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    // Drop the timestamp so resuming measures from the next frame rather than
    // from whenever the loop was paused — otherwise scrolling back up jumps
    // the motes by the entire time spent below the fold.
    lastTime = 0;
  };

  /**
   * How the scene gets out of the way of the page content below the hero.
   *
   * Starts early on purpose: the next section's heading crosses into frame at
   * roughly half a viewport, well before the hero has finished leaving, and
   * waiting until then hands it a bare landscape to sit on.
   *
   * The mechanism is now cloud cover rather than a beige rectangle fading in
   * over the top. Dimming a picture flattens it — every depth cue fades at the
   * same rate — whereas weather rolling in takes the view away while the layers
   * behind it keep their separation.
   */
  const RECEDE_FROM = 0.25;
  const RECEDE_TO = 1.0;

  /**
   * A second recession over the last stretch of the document.
   *
   * The ramp above is spent within the first viewport and then holds flat for
   * the remaining eleven. That is right for the sections in between, and not
   * enough for the footer: by then the lateral pan has carried the painting's
   * densest passage into the middle of the frame, right under the contact
   * details, which are small text over foliage rather than headings over mist.
   */
  const DEEPEN_FROM = 0.82;

  /** Published for CSS; must not grow without bound. */
  const PROGRESS_MAX = 1.25;

  let lastThicken = -1;
  let lastDeepen = -1;
  let lastHeroProgress = -1;

  const syncScroll = () => {
    updateSceneScroll();

    const raw = window.scrollY / Math.max(window.innerHeight, 1);
    const heroProgress = Math.min(raw, PROGRESS_MAX);

    const t = Math.min(1, Math.max(0, (raw - RECEDE_FROM) / (RECEDE_TO - RECEDE_FROM)));
    const thicken = t * t * (3 - 2 * t); // smoothstep

    // Progress through the WHOLE document, which is what the footer needs.
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const docProgress = window.scrollY / scrollable;
    const d = Math.min(1, Math.max(0, (docProgress - DEEPEN_FROM) / (1 - DEEPEN_FROM)));
    const deepen = d * d * (3 - 2 * d);

    if (Math.abs(heroProgress - lastHeroProgress) > 0.002) {
      backdrop.style.setProperty("--scroll-progress", heroProgress.toFixed(4));
      lastHeroProgress = heroProgress;
    }

    // Only touch the materials when it actually moves — this runs on every
    // scroll event.
    if (Math.abs(thicken - lastThicken) > 0.004 || Math.abs(deepen - lastDeepen) > 0.004) {
      clouds.setThicken(thicken, deepen);
      lastThicken = thicken;
      lastDeepen = deepen;
      // The loop is halved below the fold and stopped entirely when the tab is
      // hidden, so a scroll that lands while paused must repaint itself.
      if (!running) draw();
    }
  };

  const onScroll = () => syncScroll();
  const onResize = () => {
    resize();
    syncScroll();
    if (!running) draw();
  };

  /**
   * A hidden tab should cost nothing. This replaces the old scroll gating,
   * which stopped the loop below the fold — no longer correct now that the
   * scene is visible the whole way down.
   */
  const onVisibility = () => {
    if (document.hidden) stop();
    else if (!reducedMotion) start();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  updateSceneScroll();
  rig.update(sceneScroll.descend, sceneScroll.pan, true);

  if (reducedMotion) {
    // Compose the scene once and leave it. Still an image, never a moving one.
    draw();
  } else {
    syncScroll();
    start();
  }

  return {
    dispose() {
      stop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      painting.dispose();
      clouds.dispose();
      motes.dispose();
      renderer.dispose();
    },
  };
};
