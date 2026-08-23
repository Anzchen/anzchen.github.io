import { useEffect, useRef, useState } from "react";

/**
 * The page backdrop: the hero scroll painting, cut into depth planes and drawn
 * as a live WebGL scene with cloud banks drifting between the layers.
 *
 * React owns the canvas element and nothing else; `createInkScene` owns
 * everything drawn on it. three.js is imported dynamically so it lands in its
 * own chunk and never blocks first paint. If WebGL is unavailable the canvas is
 * replaced by the flat painting, so the hero is never blank.
 *
 * This component used to also composite three generated ink plates as DOM
 * images over the canvas, and to lay a beige veil over everything to push the
 * scene behind the page content. Both are gone: the plates were a second,
 * heavier foreground competing with the painting's own, and the veil flattened
 * the scene it was meant to recede. The clouds do the receding now.
 */
const InkScene = () => {
  const backdropRef = useRef(null);
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let scene = null;
    let cancelled = false;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    import("./scene/createInkScene")
      .then(({ createInkScene }) => {
        if (cancelled || !canvasRef.current) return;
        scene = createInkScene(canvasRef.current, { reducedMotion });
      })
      .catch((error) => {
        console.error("[InkScene] scene failed to initialise:", { error });
        setFailed(true);
        // Unblock the preloader — it must never wait on a scene that will
        // never arrive.
        window.dispatchEvent(new Event("scene:ready"));
      });

    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);

  // WebGL unavailable — fall back to the flat painting the hero used before
  // this existed. The fallback lives here rather than in Hero so there is
  // exactly one place that decides what the backdrop is.
  if (failed) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-painting bg-cover bg-center"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={backdropRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/*
        Slightly over-scaled so no soft edge ever exposes a viewport corner.
        No blur here any more: it existed to hold the procedural ridges apart
        from the sharp foreground plates, and with both of those gone it only
        softened fine gongbi detail the painting depends on.
      */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full scale-[1.02]" />
      {/* Paper grain lives here, not in the hero, so the tooth is continuous
          for the whole document instead of ending at a section edge. */}
      <div className="paper-grain" />
    </div>
  );
};

export default InkScene;
