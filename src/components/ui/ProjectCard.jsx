import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import TechBadge from "./TechBadge";

/**
 * Get theme-specific accent colors for the card
 * Uses jade (nature/water) and gold (prestige/stars) to match overall palette.
 * ultramarine is RecallGuard's app-icon hue pulled down to jade's saturation and
 * lightness, so the blue card sits at the same muted weight as the green one.
 * It runs at higher border opacity than the others (70% vs 30%) to stay visible
 * once desaturated that far.
 */
const getThemeStyles = (theme) => {
  switch (theme) {
    case "fishing":
      return {
        border: "border-jade/30 hover:border-jade/60",
        gradient: "from-jade/10 via-jade/5 to-transparent",
        accent: "text-jade",
      };
    case "michelin":
      return {
        border: "border-gold/30 hover:border-gold/60",
        gradient: "from-gold/10 via-gold/5 to-transparent",
        accent: "text-gold",
      };
    case "recallguard":
      return {
        border: "border-ultramarine/70 hover:border-ultramarine",
        gradient: "from-ultramarine/10 via-ultramarine/5 to-transparent",
        accent: "text-ultramarine",
      };
    default:
      return {
        border: "border-brown/20 hover:border-brown/40",
        gradient: "from-brown/10 to-transparent",
        accent: "text-brown/30",
      };
  }
};

/**
 * BrushCorner - Decorative ink brush stroke corner accent
 */
const BrushCorner = ({ position, className = "" }) => {
  const positionClasses = {
    "top-left": "top-0 left-0",
    "top-right": "top-0 right-0 rotate-90",
    "bottom-left": "bottom-0 left-0 -rotate-90",
    "bottom-right": "bottom-0 right-0 rotate-180",
  };

  return (
    <svg
      className={`absolute h-8 w-8 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${positionClasses[position]} ${className}`}
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M2 2 Q8 2 12 6 Q16 10 16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M2 6 Q6 6 8 10"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
};

/**
 * ProjectCard - Displays a project with image, title, description, and tech stack
 * Features traditional Chinese ink brush corner accents
 */
const ProjectCard = forwardRef(({ project, imageUrl, posterUrl }, ref) => {
  const themeStyles = getThemeStyles(project.theme);
  const [techExpanded, setTechExpanded] = useState(false);
  const visibleTechCount = 5;
  const hasMoreTech = project.technologies.length > visibleTechCount;
  const displayedTech = techExpanded
    ? project.technologies
    : project.technologies.slice(0, visibleTechCount);

  return (
    <article
      ref={ref}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border-2 bg-dark-beige/95 shadow-md transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${themeStyles.border}`}
    >
      {/* Ink brush corner accents */}
      <BrushCorner position="top-left" className={themeStyles.accent} />
      <BrushCorner position="top-right" className={themeStyles.accent} />
      <BrushCorner position="bottom-left" className={themeStyles.accent} />
      <BrushCorner position="bottom-right" className={themeStyles.accent} />

      {/* Gradient overlay based on theme */}
      <div
        className={`pointer-events-none absolute inset-0 z-0 bg-gradient-to-br opacity-50 ${themeStyles.gradient}`}
      />

      {/* Image */}
      <div className="relative z-[1] aspect-[5/2] w-full overflow-hidden bg-dark-beige">
        <img
          className="h-full w-full object-cover transition-transform duration-900 ease-out group-hover:scale-105"
          src={imageUrl}
          alt={`${project.title} project preview`}
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-brown/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </div>

      {/* Content */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col p-5 sm:p-6">
        {/* Title — hidden when the cover image already contains it */}
        {!project.hideTitle && (
          <h3 className="mb-2 text-xl font-semibold leading-tight text-ink sm:text-2xl">
            {project.title}
          </h3>
        )}

        {/* Description — fills available space, overflows hidden */}
        <div className="mb-3 min-h-0 flex-1 overflow-hidden">
          <p className="text-sm leading-relaxed text-brown sm:text-base">
            {project.shortDescription ?? project.description}
          </p>
        </div>

        {/* Bottom section — pinned to bottom */}
        <div className="mt-auto shrink-0">
          {/* Tech stack */}
          <div className="mb-3">
            <ul className="flex flex-wrap gap-1.5">
              {displayedTech.map((tech, index) => (
                <li key={index}>
                  <TechBadge name={tech} />
                </li>
              ))}
              {hasMoreTech && !techExpanded && (
                <li>
                  <button
                    onClick={() => setTechExpanded(true)}
                    className="inline-flex items-center rounded-full border border-brown/20 bg-beige px-3 py-1 text-xs font-medium text-brown/60 transition-all duration-300 hover:border-brown/40 hover:text-brown"
                  >
                    +{project.technologies.length - visibleTechCount}
                  </button>
                </li>
              )}
              {hasMoreTech && techExpanded && (
                <li>
                  <button
                    onClick={() => setTechExpanded(false)}
                    className="inline-flex items-center rounded-full border border-brown/20 bg-beige px-3 py-1 text-xs font-medium text-brown/60 transition-all duration-300 hover:border-brown/40 hover:text-brown"
                  >
                    Show less
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Action links — the whole row goes when a project has none, so a
              retired project doesn't render an orphan rule over dead space. */}
          {(project.github || posterUrl || project.appPage || project.demo) && (
          <div className="flex flex-wrap gap-2 border-t border-brown/10 pt-3">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-transparent px-3 py-1.5 text-sm font-medium text-ink transition-all duration-300 hover:bg-ink hover:text-beige"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View Code
            </a>
          )}
          {posterUrl && (
            <a
              href={posterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-transparent px-3 py-1.5 text-sm font-medium text-ink transition-all duration-300 hover:bg-ink hover:text-beige"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              View Poster
            </a>
          )}
          {project.appPage && (
            <Link
              to={project.appPage}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-transparent px-3 py-1.5 text-sm font-medium text-ink transition-all duration-300 hover:bg-ink hover:text-beige"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              About
            </Link>
          )}
          {project.demo && (
            <a
              href={project.demo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brown px-3 py-1.5 text-sm font-medium text-beige transition-all duration-300 hover:bg-ink"
            >
              <svg
                className="h-4 w-4"
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
              {project.demoLabel ?? "Live Demo"}
            </a>
          )}
        </div>
          )}
        </div>
      </div>
    </article>
  );
});

ProjectCard.displayName = "ProjectCard";

export default ProjectCard;
