import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE, DURATION, STAGGER } from "../../lib/motion";

/**
 * BrushStroke - Decorative ink brush stroke SVG
 */
const BrushStroke = ({ className = "" }) => (
  <svg
    width="60"
    height="8"
    viewBox="0 0 60 8"
    className={className}
  >
    <path
      d="M0 4 Q10 0 20 4 Q30 8 40 4 Q50 0 60 4"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const CopyEmail = ({ email, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`cursor-pointer transition-colors hover:text-vermillion ${className}`}
    >
      {copied ? "Copied!" : email}
    </button>
  );
};

const Footer = () => {
  const footerRef = useRef(null);
  const contentRef = useRef(null);

  // Staggered entrance for footer content
  useGSAP(() => {
    if (!contentRef.current) return;
    const elements = contentRef.current.children;

    gsap.fromTo(
      elements,
      { opacity: 0, y: 20, filter: "blur(3px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: DURATION.base,
        stagger: STAGGER,
        ease: EASE,
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  });

  useGSAP(() => {
    let isSnapping = false;
    let scrollTimeout;

    const checkSnap = () => {
      if (isSnapping) return;

      const footer = footerRef.current;
      if (!footer) return;

      const rect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Snap zone: footer top is between 15% and 85% of viewport
      if (rect.top > viewportHeight * 0.15 && rect.top < viewportHeight * 0.85) {
        isSnapping = true;

        // Determine snap direction based on position
        const snapToFooter = rect.top < viewportHeight * 0.5;
        const targetY = snapToFooter
          ? window.scrollY + rect.top
          : window.scrollY + rect.top - viewportHeight;

        gsap.to(window, {
          scrollTo: { y: snapToFooter ? footer : targetY, autoKill: true },
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => {
            isSnapping = false;
          },
          onInterrupt: () => {
            isSnapping = false;
          },
        });
      }
    };

    // Detect when scrolling stops
    ScrollTrigger.create({
      trigger: footerRef.current,
      start: "top bottom",
      end: "bottom bottom",
      onUpdate: () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(checkSnap, 150);
      },
    });
  });
  const socialsData = [
    {
      href: "https://github.com/Anzchen",
      icon: "fa-github",
      label: "GitHub",
    },
    {
      href: "https://www.linkedin.com/in/anthonyzchen/",
      icon: "fa-linkedin",
      label: "LinkedIn",
    },
    {
      href: "https://www.instagram.com/anthonyzchen/",
      icon: "fa-instagram",
      label: "Instagram",
    },
    {
      href: "https://www.facebook.com/anthonyzchen.03",
      icon: "fa-facebook",
      label: "Facebook",
    },
    {
      href: "https://open.spotify.com/user/22bsi2i6c5v3vpb2uoxuias2a",
      icon: "fa-spotify",
      label: "Spotify",
    },
  ];

  return (
    <footer ref={footerRef} className="relative flex h-screen w-full flex-col overflow-hidden">
      {/* Faded painting background overlay */}
      <div
        className="pointer-events-none absolute inset-0 bg-painting bg-cover bg-center opacity-[0.04]"
        style={{ backgroundPosition: "center 30%" }}
      />

      {/* Main content section - grows to fill available space */}
      <div ref={contentRef} className="relative flex flex-1 flex-col items-center justify-center px-6 sm:px-8">
        {/* Heading */}
        <h2 className="mb-4 text-center font-Fraunces text-3xl font-light uppercase tracking-widest text-ink sm:text-4xl">
          Let's Connect
        </h2>

        {/* Decorative brush stroke */}
        <BrushStroke className="mb-6 text-vermillion/40" />

        {/* About text */}
        <p className="max-w-xl text-center text-sm leading-relaxed text-brown/80 sm:text-base">
          This portfolio reflects my journey as a developer and my connection to
          my Chinese and Taiwanese roots. Built with React, Tailwind CSS, and
          GSAP, it evolves alongside my growth.
        </p>

        {/* Social links - larger and more prominent */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {socialsData.map((social, index) => (
            <a
              key={index}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit Anthony's ${social.label} profile`}
              className="group flex h-12 w-12 items-center justify-center rounded-full border border-brown/20 text-brown transition-all duration-300 hover:-translate-y-1 hover:border-vermillion hover:bg-vermillion hover:text-beige hover:shadow-md"
            >
              <i
                className={`fa-brands ${social.icon} text-lg transition-transform duration-300 group-hover:scale-115`}
                aria-hidden="true"
              ></i>
            </a>
          ))}
        </div>

        {/* Contact info */}
        <div className="mt-12 flex flex-col items-center gap-4 text-center text-sm text-brown/70 sm:flex-row sm:gap-8">
          <CopyEmail email="anthonyzchen@yahoo.com" />
          <span className="hidden text-brown/30 sm:inline">|</span>
          <span>Boston & New York</span>
          <span className="hidden text-brown/30 sm:inline">|</span>
          {/* Reciprocal link — the studio footer points back here. */}
          <a
            href="https://azcstudios.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-vermillion"
          >
            AZC Studios
          </a>
        </div>
      </div>

      {/* Bottom bar - fixed height at bottom */}
      <div className="relative border-t border-ink/10">
        <div className="px-6 py-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-xs text-brown/60 sm:flex-row">
            <p>
              <span className="mr-1">&copy;</span>
              {new Date().getFullYear()} AZC Studios LLC
            </p>
            <p className="font-medium text-ink/70">
              Software Engineering & App Development
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
