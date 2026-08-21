import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { EASE, DURATION, STAGGER } from "../../lib/motion";

const Hero = () => {
  const sectionRef = useRef();
  const contentRef = useRef();
  const eyebrowRef = useRef();
  const line1Ref = useRef();
  const line2Ref = useRef();
  const decorLineRef = useRef();
  const ledeRef = useRef();
  const cueRef = useRef();

  // Initial hidden state runs inside useGSAP so its context handles revert
  // on unmount. Hide the TYPE so it doesn't flash through the preloader's
  // ripple reveal — the painting stays visible on purpose, so the water
  // reveal unveils it like a scene emerging on a rainy window.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.set([line1Ref.current, line2Ref.current], { opacity: 0, y: 52 });
      gsap.set([eyebrowRef.current, ledeRef.current, cueRef.current], {
        opacity: 0,
        y: 16,
      });
      gsap.set(decorLineRef.current, {
        scaleX: 0,
        transformOrigin: "left center",
      });
    },
    { scope: sectionRef }
  );

  // Scroll parallax. The type drifts up slower than the page and dissolves,
  // so it sits IN the scene rather than on top of a moving picture. Scrubbed
  // rather than eased — its timing belongs to the scroll, not to a curve — and
  // it only engages once scrolling starts, so it never competes with the
  // entrance timeline below.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.to(contentRef.current, {
        y: -90,
        opacity: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    },
    { scope: sectionRef }
  );

  // The preloader's water effect reveals the painting; the type then
  // writes itself in on the shared ease after a short beat. Keyed off
  // the real preloader handoff, not a blind timer.
  //
  // The window listener lives in a real useEffect — useGSAP discards its
  // callback's return value, so a listener registered there would leak.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let entranceTl;
    const playEntrance = () => {
      entranceTl = gsap
        .timeline({
          delay: 0.2,
          defaults: { ease: EASE, duration: DURATION.base },
        })
        .to(eyebrowRef.current, { opacity: 1, y: 0 })
        .to(
          [line1Ref.current, line2Ref.current],
          { opacity: 1, y: 0, stagger: STAGGER * 2 },
          "-=0.45"
        )
        .to(decorLineRef.current, { scaleX: 1 }, "-=0.35")
        .to(ledeRef.current, { opacity: 1, y: 0 }, "-=0.45")
        .to(cueRef.current, { opacity: 1, y: 0 }, "-=0.4");
    };

    if (window.__preloaderDone) {
      playEntrance();
    } else {
      window.addEventListener("preloader:complete", playEntrance, {
        once: true,
      });
    }

    return () => {
      window.removeEventListener("preloader:complete", playEntrance);
      entranceTl?.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-svh w-full items-center overflow-hidden"
    >
      {/* No background of its own — the live ink scene (PageLayout → InkScene)
          shows through from z-0 behind the whole page. */}
      {/* Mobile-only beige scrim — keeps type readable where the ridges rise
          into the text column on narrow viewports. Weighted to the MIDDLE,
          where the lede sits, rather than the bottom: a heavy bottom stop
          painted straight over the foreground ink plates and erased them. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-beige/25 via-beige/60 to-transparent lg:hidden"
        aria-hidden="true"
      />
      {/* The bottom seam gradient that used to live here is GONE on purpose.
          It existed to dissolve the hero into an opaque section below it, but
          the backdrop is now continuous down the whole page, so a beige band
          across the bottom of the viewport just reads as a hard fade line at
          the hero/Experience boundary. Nothing to seam against any more. */}
      {/* Paper grain moved to the backdrop (InkScene). Scoped to the hero it
          ended at the section edge, leaving a faint tonal line straight across
          the viewport at the hero/Experience boundary — the last remnant of
          the old handoff. Paper does not stop halfway down a page. */}

      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-10 mx-auto w-full max-w-[1500px] px-gutter"
      >
        <p
          ref={eyebrowRef}
          className="mb-7 font-KoHo text-eyebrow font-medium uppercase leading-[1.7] text-balance text-brown/70"
        >
          Software Engineer &amp; App Developer
        </p>

        <h1 className="font-Fraunces text-display font-normal text-ink">
          <span ref={line1Ref} className="block">
            Anthony
          </span>
          <span ref={line2Ref} className="block italic lg:pl-[32vw]">
            Chen
          </span>
        </h1>

        {/* Brush stroke — the signature, bridging name and statement */}
        <svg
          ref={decorLineRef}
          width="90"
          height="12"
          viewBox="0 0 60 8"
          className="mt-8 text-vermillion"
          aria-hidden="true"
        >
          <path
            d="M0 4 Q10 0 20 4 Q30 8 40 4 Q50 0 60 4"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        <p
          ref={ledeRef}
          className="mt-8 max-w-[34ch] font-KoHo text-lede text-brown/85"
        >
          Building accessible, aesthetic, and adaptable solutions through
          thoughtful software engineering.
        </p>
      </div>

      {/* Scroll cue — quiet and static; calm by intent */}
      <div
        ref={cueRef}
        className="absolute bottom-[clamp(1.25rem,4vh,2.75rem)] left-gutter z-10 flex items-center gap-3"
      >
        <span className="h-12 w-px bg-gradient-to-b from-transparent to-brown/35" />
        <span className="font-KoHo text-eyebrow uppercase text-brown/55">
          Scroll
        </span>
      </div>
    </section>
  );
};

export default Hero;
