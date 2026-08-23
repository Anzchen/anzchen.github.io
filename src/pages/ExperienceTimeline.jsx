import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TechBadge } from "../components/ui";
import experienceData from "../data/experience.json";
import { EASE, DURATION } from "../lib/motion";
import { clearPanRange, setPan, setPanRange } from "../lib/sceneScroll";

gsap.registerPlugin(ScrollTrigger);

// Get size category based on window width
// Returns "mobile" | "lg" | "xl" | "2xl"
const getSizeCategory = (width) => {
  if (width < 1024) return "mobile";
  if (width < 1280) return "lg";
  if (width < 1536) return "xl";
  return "2xl";
};

// Custom hook to detect size category with debounced updates
// Returns both isMobile boolean and sizeCategory string
// When sizeCategory changes, components using it as a key will remount
// Also preserves scroll percentage across size category changes
const useSizeCategory = () => {
  const [sizeCategory, setSizeCategory] = useState(() =>
    typeof window !== "undefined" ? getSizeCategory(window.innerWidth) : "lg"
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const savedScrollPercentRef = useRef(null);

  useEffect(() => {
    let timeoutId;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newCategory = getSizeCategory(window.innerWidth);
        if (newCategory !== sizeCategory) {
          // Save current scroll percentage before category change
          const scrollY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          savedScrollPercentRef.current = maxScroll > 0 ? scrollY / maxScroll : 0;
          // Hide content during transition to prevent flash
          setIsTransitioning(true);
        }
        setSizeCategory(newCategory);
      }, 150); // Debounce to avoid rapid re-renders
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [sizeCategory]);

  // Restore scroll position after remount
  useEffect(() => {
    if (savedScrollPercentRef.current !== null) {
      const savedPercent = savedScrollPercentRef.current;
      savedScrollPercentRef.current = null;

      // Wait for layout to stabilize, then restore scroll instantly
      // Using setTimeout(0) to defer until after React's commit phase
      setTimeout(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const targetScroll = savedPercent * maxScroll;
        window.scrollTo({ top: targetScroll, behavior: 'instant' });
        // Show content after scroll is restored
        setIsTransitioning(false);
      }, 0);
    }
  }, [sizeCategory]);

  return {
    isMobile: sizeCategory === "mobile",
    sizeCategory,
    isTransitioning,
  };
};

// Sort by start date (oldest first for left to right chronological)
// Parse the timeframe to get start date for sorting
const parseStartDate = (timeframe) => {
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const match = timeframe.match(/(\w+)\s+(\d{4})/);
  if (match) {
    return new Date(parseInt(match[2]), months[match[1]] || 0);
  }
  return new Date(0);
};

const sortedExperiences = [...experienceData].sort((a, b) =>
  parseStartDate(a.timeframe) - parseStartDate(b.timeframe)
);

// Check if experience is ongoing (contains "Present")
const isOngoing = (timeframe) => timeframe.toLowerCase().includes('present');

// Get all years from experiences
const experienceYears = [...new Set(sortedExperiences.map((exp) => exp.year))].sort();
const minYear = Math.min(...experienceYears);
const maxYear = Math.max(...experienceYears);

// Create a combined timeline with experiences and missing year markers
const timelineData = [];
for (let year = minYear; year <= maxYear; year++) {
  const experiencesForYear = sortedExperiences.filter((exp) => exp.year === year);
  if (experiencesForYear.length > 0) {
    // Add all experiences for this year
    experiencesForYear.forEach((exp) => {
      timelineData.push({ ...exp, isYearMarker: false });
    });
  } else {
    // Add a placeholder for missing year
    timelineData.push({
      id: `year-marker-${year}`,
      year: year,
      isYearMarker: true,
    });
  }
}

/**
 * ExpandableTechStack - Reusable component for expandable technology badges
 * Shows limited techs with a clickable "+N" button to expand
 */
const ExpandableTechStack = ({ technologies, visibleCount = 5, size = "sm" }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = technologies.length > visibleCount;
  const displayedTech = expanded ? technologies : technologies.slice(0, visibleCount);

  return (
    <ul className="flex flex-wrap gap-1.5">
      {displayedTech.map((tech, index) => (
        <li key={index}>
          <TechBadge name={tech} size={size} />
        </li>
      ))}
      {hasMore && !expanded && (
        <li>
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center rounded-full border border-brown/20 bg-beige px-3 py-1 text-xs font-medium text-brown/60 transition-all duration-300 hover:border-brown/40 hover:text-brown"
          >
            +{technologies.length - visibleCount}
          </button>
        </li>
      )}
      {hasMore && expanded && (
        <li>
          <button
            onClick={() => setExpanded(false)}
            className="inline-flex items-center rounded-full border border-brown/20 bg-beige px-3 py-1 text-xs font-medium text-brown/60 transition-all duration-300 hover:border-brown/40 hover:text-brown"
          >
            Show less
          </button>
        </li>
      )}
    </ul>
  );
};

// Category colors and icons
const categoryStyles = {
  engineering: {
    accent: "text-blue-700",
    bg: "bg-blue-800/10",
    border: "border-blue-700/30",
    badge: "bg-blue-700/20 text-blue-800 border-blue-700/30",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  leadership: {
    accent: "text-purple-700",
    bg: "bg-purple-800/10",
    border: "border-purple-700/30",
    badge: "bg-purple-700/20 text-purple-800 border-purple-700/30",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  service: {
    accent: "text-amber-700",
    bg: "bg-amber-800/10",
    border: "border-amber-700/30",
    badge: "bg-amber-700/20 text-amber-800 border-amber-700/30",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  education: {
    accent: "text-emerald-700",
    bg: "bg-emerald-800/10",
    border: "border-emerald-700/30",
    badge: "bg-emerald-700/20 text-emerald-800 border-emerald-700/30",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
  },
};

/**
 * ExperienceTimeline - Horizontal scrolling timeline page
 * Scrolls vertically but translates content horizontally
 * Features an animated SVG path that draws as you scroll
 */
// Parse the end date from timeframe (e.g., "May 2025 - Present" -> current date, "Sep 2021 - May 2025" -> May 2025)
const parseEndDate = (timeframe) => {
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  // If ongoing, treat as most recent
  if (timeframe.toLowerCase().includes('present')) {
    return new Date();
  }

  // Match the second date in the timeframe (end date)
  const matches = [...timeframe.matchAll(/(\w+)\s+(\d{4})/g)];
  if (matches.length >= 2) {
    const endMatch = matches[1];
    return new Date(parseInt(endMatch[2]), months[endMatch[1]] || 0);
  } else if (matches.length === 1) {
    // Single date format
    return new Date(parseInt(matches[0][2]), months[matches[0][1]] || 0);
  }
  return new Date(0);
};

// Sort experiences by end date (newest first for vertical timeline)
const sortedExperiencesDescending = [...experienceData].sort((a, b) =>
  parseEndDate(b.timeframe) - parseEndDate(a.timeframe)
);

/**
 * VerticalTimeline - Mobile-friendly vertical timeline component
 * Displays experiences in a stacked vertical layout
 */
const VerticalTimeline = () => {
  return (
    <section className="min-h-screen px-3 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
        <h1 className="font-Fraunces text-2xl font-medium text-brown sm:text-4xl md:text-5xl">
          My Professional Journey
        </h1>
      </div>

      {/* Vertical Timeline */}
      <div className="relative mx-auto max-w-2xl">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 h-full w-0.5 bg-brown/20 sm:left-6 md:left-7" />

        {/* Experience cards */}
        <div className="space-y-4 sm:space-y-6">
          {sortedExperiencesDescending.map((experience, index) => {
            const style = categoryStyles[experience.category] || categoryStyles.engineering;
            const ongoing = isOngoing(experience.timeframe);

            return (
              <div key={experience.id} className="relative pl-8 sm:pl-14 md:pl-16">
                {/* Timeline dot */}
                <div
                  className={`absolute left-[6px] top-5 h-2.5 w-2.5 rounded-full border-2 border-beige sm:left-[12px] sm:top-6 sm:h-3 sm:w-3 md:left-[14px] ${
                    ongoing ? "bg-vermillion" : "bg-brown"
                  }`}
                />

                {/* Year badge - show on first item of each year */}
                {(index === 0 || sortedExperiencesDescending[index - 1].year !== experience.year) && (
                  <div
                    className="absolute left-3 top-3 -translate-x-1/2 rounded-full bg-brown px-1.5 py-0.5 text-[10px] font-medium text-beige sm:left-6 sm:top-4 sm:px-2 sm:text-xs md:left-7"
                  >
                    {experience.year}
                  </div>
                )}

                {/* Card */}
                <div
                  className={`rounded-lg border-2 sm:rounded-xl ${style.border} bg-dark-beige/95 p-3 shadow-md sm:p-4`}
                >
                  {/* Header with category icon and employment type */}
                  <div className="mb-1.5 flex flex-wrap items-start justify-between gap-1.5 sm:mb-2 sm:gap-2">
                    <div className={`flex items-center gap-1 sm:gap-1.5 ${style.accent}`}>
                      <span className="[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
                        {style.icon}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wider sm:text-xs">
                        {experience.category}
                      </span>
                    </div>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:text-xs ${style.badge}`}
                    >
                      {experience.employment}
                    </span>
                  </div>

                  {/* Title and company */}
                  <h3 className="mb-0.5 text-base font-medium leading-tight text-brown sm:mb-1 sm:text-lg">
                    {experience.title}
                  </h3>
                  {experience.link ? (
                    <a
                      href={experience.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mb-1.5 inline-flex items-center text-xs text-red-700 transition-colors hover:text-red-800 sm:mb-2 sm:text-sm"
                    >
                      {experience.company}
                      <svg
                        className="ml-1 h-3 w-3 sm:h-3.5 sm:w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  ) : (
                    <p className="mb-1.5 text-xs text-brown/80 sm:mb-2 sm:text-sm">
                      {experience.company}
                    </p>
                  )}

                  {/* Timeframe and location */}
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-brown/60 sm:mb-2 sm:gap-x-2 sm:gap-y-1 sm:text-xs">
                    <span>{experience.timeframe}</span>
                    <span>|</span>
                    <span className="flex items-center gap-0.5 sm:gap-1">
                      <svg
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {experience.location}
                    </span>
                  </div>

                  {/* Short description */}
                  <p className="mb-2 text-xs leading-relaxed text-brown/80 sm:mb-3 sm:text-sm">
                    {experience.shortDescription}
                  </p>

                  {/* Highlights */}
                  {experience.highlights && experience.highlights.length > 0 && (
                    <ul className="mb-2 space-y-0.5 sm:mb-3 sm:space-y-1">
                      {experience.highlights.slice(0, 2).map((highlight, hIndex) => (
                        <li
                          key={hIndex}
                          className="flex items-start gap-1.5 text-[10px] text-brown/70 sm:gap-2 sm:text-xs"
                        >
                          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-brown/40 sm:mt-1.5" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Tech stack */}
                  <ExpandableTechStack technologies={experience.technologies} visibleCount={4} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
};

/**
 * HorizontalTimeline - Desktop horizontal scrolling timeline
 * Scrolls vertically but translates content horizontally
 * Features an animated SVG path that draws as you scroll
 */
const HorizontalTimeline = () => {
  const containerRef = useRef(null);
  const horizontalRef = useRef(null);
  const pathRef = useRef(null);
  const cardsRef = useRef([]);
  const autoScrollButtonRef = useRef(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const [isRewinding, setIsRewinding] = useState(false);
  const autoScrollTweenRef = useRef(null);
  const scrollTriggerRef = useRef(null);
  const bounceAnimationRef = useRef(null);

  // Refs to track state inside ScrollTrigger callback
  const isAtEndRef = useRef(false);
  const isRewindingRef = useRef(false);

  // Ref for scroll blocking function
  const blockScrollRef = useRef((e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  });

  // Keep refs in sync with state
  useEffect(() => {
    isAtEndRef.current = isAtEnd;
  }, [isAtEnd]);

  useEffect(() => {
    isRewindingRef.current = isRewinding;
  }, [isRewinding]);

  // Track screen width for responsive calculations
  // Using ref to avoid triggering useGSAP re-runs which cause pin-spacer duplication
  const screenWidthRef = useRef(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [, forceUpdate] = useState(0);

  // Update screen width on resize and refresh ScrollTrigger
  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      // If rewind or auto-scroll is happening, stop it and restore normal state
      if (autoScrollTweenRef.current) {
        autoScrollTweenRef.current.kill();
        autoScrollTweenRef.current = null;
      }
      if (isRewindingRef.current) {
        // Remove scroll blockers
        const blockScroll = blockScrollRef.current;
        document.removeEventListener("wheel", blockScroll, { capture: true });
        document.removeEventListener("touchmove", blockScroll, { capture: true });
        document.body.style.overflow = "";
        if (window.lenis) {
          window.lenis.start();
        }
        setIsRewinding(false);
      }
      setIsAutoScrolling(false);
      setIsAtEnd(false);
      if (bounceAnimationRef.current) {
        bounceAnimationRef.current.play();
      }

      const newWidth = window.innerWidth;

      // Update ref immediately so renders use the correct value
      screenWidthRef.current = newWidth;

      // Immediately update horizontal position on every resize frame
      if (horizontalRef.current && scrollProgressRef.current !== undefined) {
        // Calculate segment width for the new screen size
        const newSegmentWidth = newWidth >= 1536 ? 480 : newWidth >= 1280 ? 440 : 400;
        // Calculate total width: 2 full screens (intro + end) + all cards
        const newTotalWidth = (2 * newWidth) + (timelineData.length * newSegmentWidth);
        const currentScrollWidth = newTotalWidth - newWidth;
        horizontalRef.current.style.transform = `translate3d(${-currentScrollWidth * scrollProgressRef.current}px, 0, 0)`;
      }

      // Force immediate re-render so DOM elements get updated widths
      forceUpdate((n) => n + 1);

      // Debounce ScrollTrigger refresh (heavier operation)
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // ScrollTrigger.refresh() recalculates all trigger positions
        // The onRefresh callback handles scroll position restoration
        ScrollTrigger.refresh();
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Calculate responsive segment width based on screen size
  // lg (1024-1279): 400px, xl (1280-1535): 440px, 2xl (1536+): 480px
  const getSegmentWidth = () => {
    const width = screenWidthRef.current;
    if (width >= 1536) return 480;
    if (width >= 1280) return 440;
    return 400; // lg breakpoint (1024+)
  };
  const segmentWidth = getSegmentWidth();
  const screenWidth = screenWidthRef.current;

  // Track scroll progress for preservation across resize
  const scrollProgressRef = useRef(0);

  useGSAP(() => {
    const container = containerRef.current;
    const horizontal = horizontalRef.current;
    const path = pathRef.current;

    // Safety check - don't initialize if elements aren't ready
    if (!container || !horizontal) return;

    // Calculate dimensions
    const scrollWidth = horizontal.scrollWidth - window.innerWidth;

    // Safety check - scrollWidth should be positive
    if (scrollWidth <= 0) return;

    const numCards = timelineData.length;
    const totalWidth = horizontal.scrollWidth;

    // Calculate where intro and outro screens end/start as percentages
    const introEndPercent = window.innerWidth / totalWidth;
    const outroStartPercent = 1 - (window.innerWidth / totalWidth);
    const timelineRange = outroStartPercent - introEndPercent;

    // Path starts at 70% of intro and ends at 30% into outro
    const pathStartPercent = (window.innerWidth * 0.7) / totalWidth;
    const pathEndPercent = 1 - (window.innerWidth * 0.7) / totalWidth;
    const pathRange = pathEndPercent - pathStartPercent;

    // Pre-calculate path length once
    let pathLength = 0;
    if (path) {
      pathLength = path.getTotalLength();
      path.style.strokeDasharray = pathLength;
      path.style.strokeDashoffset = pathLength;
    }

    // Main horizontal scroll animation with optimized onUpdate
    scrollTriggerRef.current = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: () => `+=${scrollWidth}`,
      pin: true,
      scrub: 0.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        // Tell the ink backdrop which scroll span is pinned, so its camera
        // pans sideways here instead of diving vertically behind a frozen
        // viewport. Re-published on every refresh because the pin's length
        // depends on the card track width.
        setPanRange(self.start, self.end);

        // Restore scroll position after resize using the saved progress from ref
        const currentProgress = scrollProgressRef.current;
        if (currentProgress > 0 && currentProgress < 1) {
          const targetScroll = self.start + (currentProgress * (self.end - self.start));
          window.scrollTo({ top: targetScroll, behavior: "instant" });
        }
      },
      onUpdate: (self) => {
        const prog = self.progress;

        // Save progress for restoration on resize
        scrollProgressRef.current = prog;

        // Drive the backdrop's lateral camera pan from the same progress that
        // moves the cards, so the scene travels with them rather than against.
        setPan(prog);

        // Update isAtEnd state based on scroll progress
        if (prog >= 0.98 && !isAtEndRef.current) {
          setIsAtEnd(true);
        } else if (prog < 0.95 && isAtEndRef.current && !isRewindingRef.current) {
          setIsAtEnd(false);
        }

        // Calculate scroll width dynamically for resize support
        const currentScrollWidth = horizontal.scrollWidth - window.innerWidth;

        // Update horizontal position directly on style for performance
        horizontal.style.transform = `translate3d(${-currentScrollWidth * prog}px, 0, 0)`;

        // Calculate path parameters dynamically for resize support
        const currentTotalWidth = horizontal.scrollWidth;
        const currentPathStartPercent = (window.innerWidth * 0.7) / currentTotalWidth;
        const currentPathEndPercent = 1 - (window.innerWidth * 0.7) / currentTotalWidth;
        const currentPathRange = currentPathEndPercent - currentPathStartPercent;

        // Update path drawing - synced with where the path actually starts/ends
        if (path && pathLength > 0) {
          const pathProgress = Math.min(1, Math.max(0, (prog - currentPathStartPercent) / currentPathRange));
          path.style.strokeDashoffset = pathLength * (1 - pathProgress);
        }

        // Animate cards - each card should be fully visible by the time it reaches center of screen
        const currentIntroEndPercent = window.innerWidth / currentTotalWidth;
        const currentOutroStartPercent = 1 - (window.innerWidth / currentTotalWidth);
        const currentTimelineRange = currentOutroStartPercent - currentIntroEndPercent;

        cardsRef.current.forEach((card, index) => {
          if (!card) return;

          // Calculate when this card's CENTER reaches the CENTER of the screen
          // The horizontal container scrolls from 0 to scrollWidth
          // Each card is at position: (index * segmentWidth) + (segmentWidth / 2) for its center
          // Card center is at screen center when: scrollX = cardCenterX - (screenWidth / 2)
          // As a fraction of total scroll: scrollX / scrollWidth

          // Get current dimensions dynamically for resize support
          const currentScreenWidth = window.innerWidth;
          const currentSegmentWidth = currentScreenWidth >= 1536 ? 480 : currentScreenWidth >= 1280 ? 440 : 400;
          const cardCenterX = currentScreenWidth + (index + 0.5) * currentSegmentWidth; // intro screen + card position
          const scrollWhenCentered = cardCenterX - (currentScreenWidth / 2);
          const totalScrollWidth = horizontal.scrollWidth - currentScreenWidth;
          const cardCenterProgress = scrollWhenCentered / totalScrollWidth;

          // Animation window: complete exactly when card center hits screen center
          const animationDuration = 0.04; // 4% of scroll for smooth animation
          const cardStart = cardCenterProgress - animationDuration;
          const cardEnd = cardCenterProgress; // Fully visible exactly when centered
          const cardProgress = Math.min(1, Math.max(0, (prog - cardStart) / (cardEnd - cardStart)));

          // Easing function for smoother animation
          const eased = cardProgress < 0.5
            ? 4 * cardProgress * cardProgress * cardProgress
            : 1 - Math.pow(-2 * cardProgress + 2, 3) / 2;

          // Cards slide in from their respective sides (top cards from above, bottom from below)
          const yOffset = index % 2 === 0 ? -50 : 50;
          // Slight rotation that straightens out
          const rotation = index % 2 === 0 ? -3 : 3;

          card.style.opacity = eased;
          card.style.transform = `translate3d(0, ${yOffset * (1 - eased)}px, 0) rotate(${rotation * (1 - eased)}deg)`;
          card.style.filter = `blur(${(1 - eased) * 4}px)`;
        });
      },
    });

    // Bounce animation for auto-scroll button (vertical bounce like Hero)
    if (autoScrollButtonRef.current) {
      bounceAnimationRef.current = gsap.to(autoScrollButtonRef.current, {
        y: 8,
        duration: DURATION.slow,
        repeat: -1,
        yoyo: true,
        ease: EASE,
      });
    }

    // Note: useGSAP automatically handles cleanup of GSAP animations created within it.
    // We only need to manually clean up refs that might persist.
    return () => {
      if (autoScrollTweenRef.current) {
        autoScrollTweenRef.current.kill();
        autoScrollTweenRef.current = null;
      }
      if (bounceAnimationRef.current) {
        bounceAnimationRef.current.kill();
        bounceAnimationRef.current = null;
      }
      // The pin is going away — most often because a resize crossed into the
      // mobile layout, which renders the vertical timeline instead. A stale
      // range would leave the backdrop's descent frozen for the rest of the
      // page, since it subtracts a span that no longer exists.
      clearPanRange();

      // Note: Do NOT call ScrollTrigger.getAll().forEach((t) => t.kill()) here
      // as it would kill ScrollTriggers from other components (like Projects)
    };
  }, []); // Empty deps - ScrollTrigger.refresh() handles resize updates

  // Handle auto-scroll through the timeline
  const handleAutoScroll = (e) => {
    // Prevent event bubbling issues
    e.preventDefault();
    e.stopPropagation();

    // Stop Lenis scroll momentum immediately
    if (window.lenis) {
      window.lenis.stop();
      // Resume after a brief moment
      setTimeout(() => {
        if (window.lenis) window.lenis.start();
      }, 50);
    }

    // Don't allow stopping during rewind
    if (isRewinding) {
      return;
    }

    if (isAutoScrolling) {
      // Stop auto-scroll (only for forward journey, not rewind)
      if (autoScrollTweenRef.current) {
        autoScrollTweenRef.current.kill();
      }
      // Resume bounce animation
      if (bounceAnimationRef.current) {
        bounceAnimationRef.current.play();
      }
      setIsAutoScrolling(false);
      return;
    }

    // Pause bounce animation during auto-scroll for stability
    if (bounceAnimationRef.current) {
      bounceAnimationRef.current.pause();
      gsap.set(autoScrollButtonRef.current, { y: 0 });
    }

    // Use the ScrollTrigger's end position directly
    const trigger = scrollTriggerRef.current;
    if (!trigger) return;

    const currentScroll = window.scrollY;
    const triggerStart = trigger.start;
    const triggerEnd = trigger.end;
    const totalScrollDistance = triggerEnd - triggerStart;

    // Total journey takes a fixed time (e.g., 30 seconds for the full timeline)
    const totalDuration = 30;
    const pixelsPerSecond = totalScrollDistance / totalDuration;

    // If at the end, scroll back to the beginning quickly
    if (isAtEnd) {
      const rewindDistance = Math.max(0, currentScroll - triggerStart);

      if (rewindDistance <= 10) {
        setIsAtEnd(false);
        setIsRewinding(false);
        return;
      }

      // Rewind at 3x speed - no stopping allowed
      const duration = Math.max(2, rewindDistance / (pixelsPerSecond * 3));

      setIsRewinding(true);
      setIsAutoScrolling(false); // Not showing as "auto scrolling" during rewind

      // Block scrolling during rewind (like preloader does)
      if (window.lenis) {
        window.lenis.stop();
      }
      document.body.style.overflow = "hidden";

      // Block wheel and touch scroll events
      const blockScroll = blockScrollRef.current;
      document.addEventListener("wheel", blockScroll, { passive: false, capture: true });
      document.addEventListener("touchmove", blockScroll, { passive: false, capture: true });

      autoScrollTweenRef.current = gsap.to(window, {
        scrollTo: { y: triggerStart, autoKill: false },
        duration: duration,
        ease: EASE,
        onComplete: () => {
          // Remove scroll blockers
          document.removeEventListener("wheel", blockScroll, { capture: true });
          document.removeEventListener("touchmove", blockScroll, { capture: true });

          // Re-enable scrolling
          document.body.style.overflow = "";
          if (window.lenis) {
            window.lenis.start();
          }

          setIsRewinding(false);
          setIsAtEnd(false);
          if (bounceAnimationRef.current) {
            bounceAnimationRef.current.play();
          }
        },
      });
      return;
    }

    // Forward scroll to the end
    const remainingDistance = Math.max(0, triggerEnd - currentScroll);

    // If already at or past the end, don't scroll
    if (remainingDistance <= 0) {
      setIsAtEnd(true);
      return;
    }

    const duration = remainingDistance / pixelsPerSecond;

    setIsAutoScrolling(true);

    autoScrollTweenRef.current = gsap.to(window, {
      scrollTo: { y: triggerEnd, autoKill: true },
      duration: duration,
      ease: "none",
      onComplete: () => {
        setIsAutoScrolling(false);
        setIsAtEnd(true);
        if (bounceAnimationRef.current) {
          bounceAnimationRef.current.play();
        }
      },
      onInterrupt: () => {
        setIsAutoScrolling(false);
        if (bounceAnimationRef.current) {
          bounceAnimationRef.current.play();
        }
      },
    });
  };

  // Generate SVG path for the timeline
  const generateTimelinePath = () => {
    const screenW = screenWidth;
    const midY = 200; // Center of the 400px SVG
    const waveHeight = 50; // Height of wave from center

    // Start at right edge of My Journey page (with some padding into the page)
    const fadeInStart = screenW * 0.7; // Start 70% through intro page
    let path = `M ${fadeInStart} ${midY}`;

    // Timeline section boundaries
    const timelineStart = screenW;
    const timelineEnd = screenW + (timelineData.length * segmentWidth);

    // Full path from fade in to fade out
    const pathEnd = timelineEnd + screenW * 0.3;

    // Generate smooth sine wave
    const numPoints = timelineData.length * 40; // Many points for smoothness

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = fadeInStart + ((pathEnd - fadeInStart) * t);

      // Calculate where we are relative to the timeline section
      const timelineT = (x - timelineStart) / (timelineEnd - timelineStart);

      // Ease amplitude: ramp up at start, ramp down at end
      let amplitude = waveHeight;
      if (x < timelineStart) {
        // Before timeline - ease in
        amplitude = waveHeight * ((x - fadeInStart) / (timelineStart - fadeInStart));
      } else if (x > timelineEnd) {
        // After timeline - ease out
        amplitude = waveHeight * (1 - (x - timelineEnd) / (pathEnd - timelineEnd));
      }

      // Wave goes through the center (midY) at each card position
      // Cards are at positions (index + 0.5) / numCards through the timeline
      // Wave should pass through midY at those points, with peaks/troughs between cards
      const wavePhase = timelineT * Math.PI * timelineData.length;
      const y = midY + Math.sin(wavePhase) * amplitude;

      path += ` L ${x} ${y}`;
    }

    return path;
  };

  // Two full screens (intro + end) plus all experience cards
  const totalWidth = (2 * screenWidth) + (timelineData.length * segmentWidth);

  // Get unique years for the intro section
  const uniqueYears = [...new Set(timelineData.map((item) => item.year))].sort();

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden"
    >
      {/* Auto-scroll button - fixed to viewport bottom center */}
      <button
        ref={autoScrollButtonRef}
        onMouseDown={handleAutoScroll}
        onTouchEnd={handleAutoScroll}
        className={`absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 p-4 transition-colors sm:bottom-8 ${
          isRewinding ? "cursor-not-allowed text-brown/40" : "cursor-pointer text-brown/60 hover:text-vermillion"
        }`}
        style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        aria-label={isAutoScrolling ? "Stop auto-scroll" : isRewinding ? "Rewinding" : "Auto-scroll through timeline"}
      >
        <span className="min-w-[80px] text-center text-xs uppercase tracking-widest">
          {isRewinding ? "Rewinding" : isAutoScrolling ? "Stop" : isAtEnd ? "Rewind" : "Journey"}
        </span>
        <svg
          className={`h-5 w-5 ${isRewinding ? "animate-pulse" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isRewinding ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          ) : isAutoScrolling ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : isAtEnd ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          )}
        </svg>
      </button>

      {/* Horizontal scrolling container */}
      <div
        ref={horizontalRef}
        className="flex h-screen items-center"
        style={{ width: `${totalWidth}px` }}
      >
        {/* Intro section - full screen width */}
        <div
          className="relative flex h-full flex-shrink-0 flex-col items-center justify-center px-6 lg:px-8"
          style={{ width: `${screenWidth}px` }}
        >
          <h1 className="mb-4 text-center font-Fraunces text-4xl font-medium text-brown lg:mb-6 lg:text-5xl xl:text-6xl 2xl:text-7xl">
            My Professional Journey
          </h1>
          <p className="mb-3 text-center text-xl text-brown/70 lg:mb-4 lg:text-2xl">
            {uniqueYears[0]} - Present
          </p>
          <p className="max-w-[320px] text-center text-base text-brown/60 lg:max-w-[400px] lg:text-lg">
            A timeline of growth through education, leadership, and engineering.
          </p>
        </div>

        {/* Timeline SVG */}
        <svg
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2"
          width={totalWidth}
          height="400"
          style={{ zIndex: 0 }}
        >
          {/* Gradient definitions for fading effect */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#564E41" stopOpacity="0" />
              <stop offset="5%" stopColor="#564E41" stopOpacity="1" />
              <stop offset="95%" stopColor="#564E41" stopOpacity="1" />
              <stop offset="100%" stopColor="#564E41" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradientFaded" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#564E41" stopOpacity="0" />
              <stop offset="5%" stopColor="#564E41" stopOpacity="0.12" />
              <stop offset="95%" stopColor="#564E41" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#564E41" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Background path (faded) */}
          <path
            d={generateTimelinePath()}
            fill="none"
            stroke="url(#lineGradientFaded)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Animated foreground path */}
          <path
            ref={pathRef}
            d={generateTimelinePath()}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />

        </svg>

        {/* Experience cards */}
        {timelineData.map((item, index) => {
          // Handle year-only markers (missing years)
          if (item.isYearMarker) {
            return (
              <div
                key={item.id}
                ref={(el) => (cardsRef.current[index] = el)}
                className="relative z-10 flex h-[550px] flex-shrink-0 flex-col items-center justify-center"
                style={{
                  width: `${segmentWidth - 30}px`,
                  marginLeft: index === 0 ? "30px" : "15px",
                  marginRight: "15px",
                }}
              >
                {/* Year badge positioned to align with experience year badges on the SVG line */}
                {/* Experience cards are at bottom-[290px] with year badge at bottom-[-80px], so year is at 290-80=210px from center */}
                {/* For even index cards (above timeline), year badge goes below; for odd (below timeline), year badge goes above */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full bg-brown px-3 py-1 text-sm font-medium text-beige"
                  style={{ bottom: index % 2 === 0 ? '210px' : 'auto', top: index % 2 === 0 ? 'auto' : '210px' }}
                >
                  {item.year}
                </div>
              </div>
            );
          }

          // Regular experience card
          const experience = item;
          const ongoing = isOngoing(experience.timeframe);
          const style = categoryStyles[experience.category] || categoryStyles.engineering;

          return (
            <div
              key={experience.id}
              ref={(el) => (cardsRef.current[index] = el)}
              className="relative z-10 flex h-[550px] flex-shrink-0 flex-col"
              style={{
                width: `${segmentWidth - 30}px`,
                marginLeft: index === 0 ? "30px" : "15px",
                marginRight: "15px",
              }}
            >
              {/* Card positioned above or below timeline based on index */}
              <div
                className={`absolute w-full ${
                  index % 2 === 0 ? "bottom-[290px]" : "top-[290px]"
                }`}
              >
                <div
                  className={`rounded-xl border-2 ${style.border} bg-dark-beige/95 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl`}
                >
                  {/* Header with category icon and employment type */}
                  <div className="mb-2 flex items-start justify-between">
                    <div className={`flex items-center gap-1.5 ${style.accent}`}>
                      <span className="[&>svg]:h-4 [&>svg]:w-4">{style.icon}</span>
                      <span className="text-xs font-medium uppercase tracking-wider">
                        {experience.category}
                      </span>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.badge}`}
                    >
                      {experience.employment}
                    </span>
                  </div>

                  {/* Title and company */}
                  <h3 className="mb-1 text-base font-medium leading-tight text-brown">
                    {experience.title}
                  </h3>
                  {experience.link ? (
                    <a
                      href={experience.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mb-1.5 inline-flex items-center text-sm text-red-700 transition-colors hover:text-red-800"
                    >
                      {experience.company}
                      <svg
                        className="ml-1 h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  ) : (
                    <p className="mb-1.5 text-sm text-brown/80">
                      {experience.company}
                    </p>
                  )}

                  {/* Timeframe and location */}
                  <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-brown/60">
                    <span>{experience.timeframe}</span>
                    <span>|</span>
                    <span className="flex items-center gap-0.5">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {experience.location}
                    </span>
                  </div>

                  {/* Short description */}
                  <p className="mb-2 text-xs leading-relaxed text-brown/80">
                    {experience.shortDescription}
                  </p>

                  {/* Highlights - only show 2 */}
                  {experience.highlights && experience.highlights.length > 0 && (
                    <ul className="mb-2 space-y-0.5">
                      {experience.highlights.slice(0, 2).map((highlight, hIndex) => (
                        <li
                          key={hIndex}
                          className="flex items-start gap-1.5 text-xs text-brown/70"
                        >
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-brown/40" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Tech stack */}
                  <ExpandableTechStack technologies={experience.technologies} visibleCount={4} />
                </div>

                {/* Connector line to timeline - extends through SVG */}
                <div
                  className={`absolute left-1/2 w-[2px] -translate-x-1/2 bg-brown/30 ${
                    index % 2 === 0
                      ? "bottom-[-70px] h-[70px]"
                      : "top-[-70px] h-[70px]"
                  }`}
                />

                {/* Year badge on the SVG line */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-brown px-3 py-1 text-sm font-medium text-beige ${
                    index % 2 === 0 ? "bottom-[-80px]" : "top-[-80px]"
                  }`}
                >
                  {experience.year}
                </div>
              </div>
            </div>
          );
        })}

        {/* End section - full screen width */}
        <div
          className="flex h-full flex-shrink-0 flex-col items-center justify-center px-6 lg:px-8"
          style={{ width: `${screenWidth}px` }}
        >
          <h2 className="mb-3 text-center font-Fraunces text-4xl font-medium text-brown lg:mb-4 lg:text-5xl xl:text-6xl">
            Present Day
          </h2>
          <p className="mb-2 text-center text-xl text-brown/70 lg:mb-3 lg:text-2xl">
            Software Engineer at UKG
          </p>
          <p className="max-w-[320px] text-center text-base text-brown/60 lg:max-w-[400px] lg:text-lg">
            Building enterprise solutions and continuing to grow as a developer.
          </p>
          <div className="mt-6 flex gap-3 lg:mt-8 lg:gap-4">
            <a
              href="https://www.linkedin.com/in/anthonyzchen/"
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-2 rounded-full bg-brown px-5 py-2.5 text-base text-beige transition-colors hover:bg-brown/80"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
            <a
              href="https://github.com/anthonyzchen"
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-2 rounded-full border-2 border-brown px-5 py-2.5 text-base text-brown transition-colors hover:bg-brown/10"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </div>

    </section>
  );
};

/**
 * ExperienceTimeline - Main component that renders either
 * vertical (mobile) or horizontal (desktop) timeline based on screen size
 *
 * Uses sizeCategory as a key to force remount when crossing breakpoints.
 * This ensures the SVG path and ScrollTrigger are recalculated with correct dimensions.
 */
const ExperienceTimeline = () => {
  const { isMobile, sizeCategory, isTransitioning } = useSizeCategory();

  // Render vertical timeline on mobile, horizontal on desktop
  // Key prop forces remount when size category changes, ensuring fresh calculations
  // Opacity 0 during transition prevents flash to wrong scroll position
  return (
    <div style={{ opacity: isTransitioning ? 0 : 1 }}>
      {isMobile ? (
        <VerticalTimeline key={sizeCategory} />
      ) : (
        <HorizontalTimeline key={sizeCategory} />
      )}
    </div>
  );
};

export default ExperienceTimeline;
