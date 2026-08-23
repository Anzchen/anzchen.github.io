/**
 * Shared scroll driver for the ink backdrop.
 *
 * The scene cannot derive its own progress from `window.scrollY`, because that
 * value stops describing what the viewer sees the moment a section pins.
 * ExperienceTimeline pins the viewport and translates its cards sideways
 * (see its ScrollTrigger in src/pages/ExperienceTimeline.jsx): scrollY keeps
 * climbing while the page is visually frozen. A camera reading scrollY would
 * dive vertically behind a stationary page.
 *
 * So scroll is split into two independent signals:
 *
 *   descend — vertical journey, with the pinned span REMOVED. It freezes while
 *             the pin holds and resumes afterwards, so the camera only travels
 *             down when the page actually travels down.
 *   pan     — 0..1 across the pinned section, published by that trigger itself.
 *
 * A plain module rather than React context: the scene is lazy-loaded and this
 * has to sit in the main chunk where ExperienceTimeline can reach it without
 * pulling three.js along with it.
 */

/** Live driver state. Read every frame by the scene; never reassigned. */
export const sceneScroll = {
  descend: 0,
  pan: 0,
};

/** Pinned span in document coordinates. null when nothing is pinned. */
let panStart = null;
let panEnd = null;

/**
 * Published by the pinned trigger on refresh. Called again on every resize,
 * since the pin length depends on the card track's width.
 */
export const setPanRange = (start, end) => {
  panStart = start;
  panEnd = end;
};

/** Cleared when the pin goes away — e.g. crossing to the mobile layout. */
/**
 * scrollHeight forces layout and this runs on every scroll event. It only
 * changes when the document does, so cache it and let a resize invalidate.
 */
let scrollableCache = null;
const scrollableHeight = () =>
  scrollableCache ?? (scrollableCache = document.documentElement.scrollHeight - window.innerHeight);

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    scrollableCache = null;
  });
}

export const clearPanRange = () => {
  panStart = null;
  panEnd = null;
  /**
   * Reset the value too, not just the range. updateSceneScroll returns early
   * when there is no pin, so a stale pan would stick: resizing across the lg
   * breakpoint while scrolled into the pinned timeline used to leave the camera
   * with a permanent lateral offset and yaw for the rest of the session, with
   * no scroll position able to bring it back.
   */
  sceneScroll.pan = 0;
};

/** Published by the pinned trigger on update. */
export const setPan = (progress) => {
  sceneScroll.pan = Math.min(1, Math.max(0, progress));
};

/**
 * Total vertical distance the journey spans, excluding the pinned span.
 *
 * Normalising against this rather than a fixed number of viewports means the
 * camera arrives at the end of its path exactly at the document bottom, no
 * matter how many roles or projects get added later.
 */
const travelLength = () => {
  const total = Math.max(
    1,
    scrollableHeight()
  );
  const pinned = panStart !== null ? panEnd - panStart : 0;
  return Math.max(1, total - pinned);
};

/**
 * Recompute `descend` (and `pan` when no pin is present) from the current
 * scroll position. Call from a scroll listener; cheap enough to run per event.
 */
export const updateSceneScroll = () => {
  const y = window.scrollY;

  if (panStart === null) {
    // No pinned section — mobile renders the vertical timeline instead, so
    // the journey is simply continuous.
    sceneScroll.descend = Math.min(1, Math.max(0, y / travelLength()));
    return;
  }

  let vertical;
  if (y <= panStart) {
    vertical = y;
  } else if (y >= panEnd) {
    // Past the pin: subtract its length so the journey resumes where it froze.
    vertical = y - (panEnd - panStart);
  } else {
    // Inside the pin: vertical travel is held. `pan` is driven by the trigger.
    vertical = panStart;
  }

  sceneScroll.descend = Math.min(1, Math.max(0, vertical / travelLength()));

  // Keep pan consistent if the viewer jumps past the section without the
  // trigger firing (anchor links, restored scroll position).
  if (y > panEnd) sceneScroll.pan = 1;
  else if (y < panStart) sceneScroll.pan = 0;
};
