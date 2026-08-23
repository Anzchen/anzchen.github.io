import { useRef, useLayoutEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import WaterReveal from "./WaterReveal";

const Preloader = () => {
  const preloaderRef = useRef(null);
  const [isRevealing, setIsRevealing] = useState(true);
  const lenisRef = useRef(null);

  useLayoutEffect(() => {
    // This preloader instance has not completed yet — reset the handoff flag
    // so section entrances (Hero) wait for THIS reveal, not a prior one.
    // Matters on back-navigation, when Preloader remounts and replays.
    window.__preloaderDone = false;

    // The ink scene almost always finishes compiling before the reveal ends,
    // so record it rather than only listening — by the time the reveal calls
    // back, the event has usually already fired.
    window.__sceneReady = false;
    const markSceneReady = () => {
      window.__sceneReady = true;
    };
    window.addEventListener("scene:ready", markSceneReady, { once: true });

    // Disable browser's automatic scroll restoration
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    // Force scroll to top on page load/refresh
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Belt-and-suspenders: catch any browser scroll restoration after layout
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    // On beforeunload, set scroll to 0 so the browser saves position as 0
    const handleBeforeUnload = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Initialize Lenis for smooth scrolling
    lenisRef.current = new Lenis({
      lerp: 0.1, // Default smooth scrolling
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    // Expose Lenis instance globally for other components to access
    window.lenis = lenisRef.current;

    // Stop scrolling during preloader
    lenisRef.current.stop();

    // Prevent scrolling during preloader
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("scene:ready", markSceneReady);
      if (lenisRef.current) {
        lenisRef.current.destroy();
      }
    };
  }, []);

  /**
   * Hold the reveal until the backdrop has drawn its first frame, so the
   * water effect never unveils an empty canvas. The timeout is the important
   * half: a slow or failed WebGL init must not strand the page behind the
   * preloader.
   */
  const handleRevealComplete = () => {
    if (window.__sceneReady) {
      finishHandoff();
      return;
    }

    let done = false;
    const proceed = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("scene:ready", proceed);
      finishHandoff();
    };

    const timer = setTimeout(proceed, 1500);
    window.addEventListener("scene:ready", proceed, { once: true });
  };

  const finishHandoff = () => {
    setIsRevealing(false);

    // Hide preloader
    if (preloaderRef.current) {
      preloaderRef.current.style.display = "none";
    }

    // Re-enable scrolling
    document.body.style.overflow = "";

    // Start Lenis smooth scrolling
    if (lenisRef.current) {
      lenisRef.current.start();
      lenisRef.current.on("scroll", ScrollTrigger.update);

      gsap.ticker.add((time) => {
        lenisRef.current.raf(time * 1000);
      });

      gsap.ticker.lagSmoothing(0);
    }

    // Hand off to section entrance animations (e.g. Hero) — a real signal
    // instead of a blind timer, so they stay correct if this duration changes.
    window.__preloaderDone = true;
    window.dispatchEvent(new Event("preloader:complete"));
  };

  return (
    <div ref={preloaderRef}>
      {isRevealing && (
        <WaterReveal onComplete={handleRevealComplete} duration={2500} />
      )}
    </div>
  );
};

export default Preloader;
