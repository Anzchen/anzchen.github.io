import { useRef, useEffect, useCallback, forwardRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projectAnimation } from "./animations";
import { ProjectCard } from "../ui";
import projectsData from "../../data/projects.json";
import { EASE, DURATION } from "../../lib/motion";

// Import project images
import project1Url from "../../assets/images/Project1_Cover1280.png";
import project2Url from "../../assets/images/Project2_Cover1280.png";
import project5Url from "../../assets/images/Project5_Cover1280.png";
import project6Url from "../../assets/images/Project6_Cover1280.png";

// Import poster images
import poster1Url from "../../assets/images/p1.png";
import poster2Url from "../../assets/images/p2_pic1.png";

const projectImages = {
  project1: project1Url,
  project2: project2Url,
  project5: project5Url,
  project6: project6Url,
};

const projectPosters = {
  project1: poster1Url,
  project2: poster2Url,
};

const CARD_GAP = 48;

/** Responsive card width — must stay in sync with Tailwind classes on card wrapper */
const getCardWidth = () => (window.innerWidth >= 640 ? 400 : 340);

/**
 * ArrowButton - Navigation arrow for the carousel
 */
const ArrowButton = forwardRef(({ direction, onClick }, ref) => (
  <button
    ref={ref}
    onClick={onClick}
    className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center p-4 text-brown/60 transition-colors duration-200 hover:text-vermillion ${
      direction === "left" ? "left-4 sm:left-8" : "right-4 sm:right-8"
    }`}
    aria-label={`Scroll ${direction}`}
  >
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d={direction === "left" ? "M10 19l-7-7m0 0l7-7m-7 7h18" : "M14 5l7 7m0 0l-7 7m7-7H3"}
      />
    </svg>
  </button>
));

// Static — tripled for infinite loop illusion
const tripledCards = [...projectsData, ...projectsData, ...projectsData];
const cardCount = projectsData.length;

/**
 * Projects - Infinite film-roll carousel with arrow navigation
 *
 * Track is positioned via gsap.set(x) — no native scroll.
 * Cards are rendered 3x. When the offset drifts past one full set,
 * we snap back to the equivalent position in the middle set (seamless).
 * Vertical scrolling is never hijacked — arrows handle horizontal movement.
 */
const Projects = () => {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const headerRef = useRef(null);
  const cleanupRef = useRef(null);
  const leftArrowRef = useRef(null);
  const rightArrowRef = useRef(null);
  const offsetRef = useRef(0);
  const tweenRef = useRef(null);

  /** One set width = cardCount * (cardWidth + gap) */
  const getSingleSetWidth = useCallback(() => {
    return cardCount * (getCardWidth() + CARD_GAP);
  }, []);

  /** Starting x offset — centers the first card of the middle set */
  const getInitialOffset = useCallback(() => {
    const cardWidth = getCardWidth();
    const singleSetWidth = getSingleSetWidth();
    const vw = viewportRef.current?.clientWidth ?? window.innerWidth;
    return -singleSetWidth + (vw - cardWidth) / 2;
  }, [getSingleSetWidth]);

  /**
   * Seamless boundary reset — triggers at half a set width from center
   * so the track edge is never visible (content is identical across sets)
   */
  const resetBoundary = useCallback(() => {
    if (!trackRef.current) return;
    const singleSetWidth = getSingleSetWidth();
    const center = getInitialOffset();
    const threshold = singleSetWidth / 2;

    if (offsetRef.current > center + threshold) {
      offsetRef.current -= singleSetWidth;
      gsap.set(trackRef.current, { x: offsetRef.current });
    } else if (offsetRef.current < center - threshold) {
      offsetRef.current += singleSetWidth;
      gsap.set(trackRef.current, { x: offsetRef.current });
    }
  }, [getSingleSetWidth, getInitialOffset]);

  /** Snap to nearest card center */
  const snapToNearest = useCallback(() => {
    if (!trackRef.current) return;
    const step = getCardWidth() + CARD_GAP;
    const initial = getInitialOffset();
    const rawIndex = (initial - offsetRef.current) / step;
    const nearestIndex = Math.round(rawIndex);
    const snapTarget = initial - nearestIndex * step;

    tweenRef.current = gsap.to(trackRef.current, {
      x: snapTarget,
      duration: DURATION.fast,
      ease: EASE,
      onUpdate: () => {
        if (!trackRef.current) return;
        offsetRef.current = gsap.getProperty(trackRef.current, "x");
      },
      onComplete: () => {
        if (!trackRef.current) return;
        offsetRef.current = snapTarget;
        resetBoundary();
        tweenRef.current = null;
      },
    });
  }, [getInitialOffset, resetBoundary]);

  /** Shift carousel by delta px with smooth tween */
  const shiftCarousel = useCallback(
    (delta) => {
      if (!trackRef.current) return;

      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
        offsetRef.current = gsap.getProperty(trackRef.current, "x");
        resetBoundary();
      }

      const target = offsetRef.current - delta;

      tweenRef.current = gsap.to(trackRef.current, {
        x: target,
        duration: DURATION.base,
        ease: EASE,
        onUpdate: () => {
          if (!trackRef.current) return;
          offsetRef.current = gsap.getProperty(trackRef.current, "x");
        },
        onComplete: () => {
          if (!trackRef.current) return;
          offsetRef.current = target;
          resetBoundary();
          tweenRef.current = null;
        },
      });
    },
    [resetBoundary],
  );

  // ── Init position ───────────────────────────────────────────────────
  const initPosition = useCallback(() => {
    if (!trackRef.current) return;
    const initial = getInitialOffset();
    offsetRef.current = initial;
    gsap.set(trackRef.current, { x: initial });
  }, [getInitialOffset]);

  useEffect(() => {
    initPosition();
    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
      }
    };
  }, [initPosition]);

  // ── Arrow bounce animation ─────────────────────────────────────────
  useEffect(() => {
    const tweens = [];

    if (leftArrowRef.current) {
      tweens.push(
        gsap.to(leftArrowRef.current, {
          x: -6,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
        }),
      );
    }

    if (rightArrowRef.current) {
      tweens.push(
        gsap.to(rightArrowRef.current, {
          x: 6,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
        }),
      );
    }

    return () => tweens.forEach((t) => t.kill());
  }, []);

  // ── Header scroll animation ─────────────────────────────────────────
  const createAnimations = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    cleanupRef.current = projectAnimation(sectionRef.current, headerRef.current);
  }, []);

  useEffect(() => {
    const id = setTimeout(createAnimations, 0);
    return () => {
      clearTimeout(id);
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [createAnimations]);

  // ── Snap to section when scroll stops in the snap zone ─────────────
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let isSnapping = false;
    let scrollTimeout;

    const checkSnap = () => {
      if (isSnapping) return;

      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;

      if (rect.top > vh * 0.15 && rect.top < vh * 0.85) {
        isSnapping = true;

        const snapToSection = rect.top < vh * 0.5;
        const targetY = snapToSection
          ? window.scrollY + rect.top
          : window.scrollY + rect.top - vh;

        gsap.to(window, {
          scrollTo: { y: snapToSection ? section : targetY, autoKill: true },
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => { isSnapping = false; },
          onInterrupt: () => { isSnapping = false; },
        });
      }
    };

    const snapTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(checkSnap, 100);
      },
    });

    return () => {
      clearTimeout(scrollTimeout);
      snapTrigger.kill();
    };
  }, []);

  // ── Resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    let timeout;
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        initPosition();
        createAnimations();
      }, 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timeout);
    };
  }, [createAnimations, initPosition]);

  // ── Arrow handler ───────────────────────────────────────────────────
  const handleArrowClick = (direction) => {
    const step = getCardWidth() + CARD_GAP;
    shiftCarousel(direction === "right" ? step : -step);
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Faded painting background */}
      <div
        className="pointer-events-none absolute inset-0 bg-painting bg-cover bg-center opacity-[0.03]"
        style={{ backgroundPosition: "center 70%" }}
      />

      <div className="relative flex h-screen flex-col pb-16 pt-6 md:pb-20 md:pt-8">
        {/* Header */}
        <div ref={headerRef} className="shrink-0 px-4 pb-4 text-center sm:px-8 md:pb-6">
          <h2 className="mb-2 font-Fraunces text-3xl font-light uppercase tracking-wider text-ink sm:text-4xl md:text-5xl">
            Featured Projects
          </h2>

          <div className="mb-3 flex justify-center">
            <svg
              width="60"
              height="8"
              viewBox="0 0 60 8"
              className="text-vermillion/40"
            >
              <path
                d="M0 4 Q10 0 20 4 Q30 8 40 4 Q50 0 60 4"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="mx-auto hidden max-w-2xl text-base text-brown/70 sm:block sm:text-lg">
            A selection of projects showcasing my work in web development,
            data analysis, and interactive applications.
          </p>
        </div>

        {/* Carousel area — arrows sit outside the mask so they stay fully visible */}
        <div className="relative min-h-0 flex-1">
          <ArrowButton ref={leftArrowRef} direction="left" onClick={() => handleArrowClick("left")} />
          <ArrowButton ref={rightArrowRef} direction="right" onClick={() => handleArrowClick("right")} />

          {/* Masked viewport */}
          <div
            ref={viewportRef}
            className="carousel-fade h-full overflow-hidden"
          >
            {/* GSAP-driven track */}
            <div
              ref={trackRef}
              className="flex h-full items-stretch py-4"
              style={{ gap: `${CARD_GAP}px` }}
            >
              {tripledCards.map((project, index) => (
                <div
                  key={`${project.id}-${index}`}
                  className="w-[340px] flex-shrink-0 sm:w-[400px]"
                >
                  <ProjectCard
                    project={project}
                    imageUrl={projectImages[project.id]}
                    posterUrl={projectPosters[project.id]}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Projects;
