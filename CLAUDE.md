# CLAUDE.md - AI Assistant Context

This file provides context for Claude Code when working on this project.

## Project Overview

Personal portfolio website for Anthony Chen (anthonyzchen.com). Built with React, Vite, and Tailwind CSS, featuring GSAP animations, smooth scrolling, and a water ripple preloader effect.

## Quick Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run icons    # Regenerate favicons / og-image from the source icon

# Hero scene assets (rarely needed — the built layers are committed)
node scripts/make-painting-layers.mjs   # cut src/assets/painting-src/ into the shipped layers
node scripts/export-painting-cuts.mjs   # export bands from the master painting, to expand with AI
node scripts/merge-expansion.mjs <layer> <generated>  # merge an AI expansion back onto a band
```

## Project Structure

```
src/
├── components/
│   ├── ui/                  # Reusable UI components
│   │   ├── TechBadge.jsx    # Technology pill/badge
│   │   ├── ProjectCard.jsx  # Project display card
│   │   ├── ExperienceCard.jsx # Work experience card
│   │   └── index.js         # Barrel export
│   ├── About/
│   │   ├── Projects.jsx     # Projects section with ScrollTrigger
│   │   ├── Experience.jsx   # Work experience list
│   │   └── animations.jsx   # ScrollTrigger animations
│   ├── Hero/                # Full-screen intro section
│   ├── Logo/                # Fixed logo component (scrolls to top on click)
│   │   └── Logo.jsx
│   ├── Footer/              # Social links and contact
│   ├── Preloader/           # Rain-on-glass reveal (WebGL)
│   │   ├── Preloader.jsx    # Main preloader component
│   │   ├── WaterReveal.jsx  # Full-screen WebGL canvas
│   │   └── rainShaders.js   # VERT / FRAG for the rain pane
│   ├── Scene/               # The live hero backdrop (see "Hero Scene" below)
│   │   ├── InkScene.jsx     # React owns the canvas; nothing else
│   │   └── scene/           # Framework-free three.js: camera, painting, clouds, motes
│   └── utils.jsx            # Shared animation utilities
├── data/
│   ├── projects.json        # Project data (edit here to add/update projects)
│   └── experience.json      # Work experience data
├── pages/
│   ├── Home.jsx             # Main page (Hero + Projects)
│   ├── ExperienceTimeline.jsx # Responsive timeline (vertical mobile, horizontal desktop)
│   └── PageLayout.jsx       # Layout wrapper (Preloader + Logo + Content + Footer)
├── lib/
│   ├── motion.js            # Shared GSAP easing / duration tokens
│   └── sceneScroll.js       # Publishes scroll state the hero scene reads
├── assets/
│   ├── images/              # Project covers, the master painting, logo
│   └── painting/            # Built hero layers + layers.json (committed)
└── App.jsx                  # React Router configuration
```

## Key Technologies

- **React 18** - UI framework
- **Vite 5** - Build tool
- **Tailwind CSS 3** - Styling
- **GSAP 3** - Animations (with ScrollTrigger)
- **three.js** - The hero backdrop scene
- **Lenis** - Smooth scrolling
- **React Router 6** - Routing

## Color Palette (tailwind.config.js)

### Base Colors
| Name | Hex | Usage |
|------|-----|-------|
| beige | #E2D7BB | Primary background |
| brown | #564E41 | Body text |
| dark-beige | #DACEAB | Card backgrounds |
| transparent-beige | #E2D7BB9A | Overlays |
| mist | #F5F2EB | Light backgrounds |

### Accent Colors
| Name | Hex | Usage |
|------|-----|-------|
| ink | #2C2825 | Headings, emphasis (darker than brown) |
| vermillion | #C23B3B | Primary accent, CTAs, links (matches logo) |
| terracotta | #A65D4C | Hover states for vermillion |
| jade | #5B7E6B | Fishing project theme (nature/water) |
| gold | #B8964B | Michelin project theme (prestige/stars) |
| ultramarine | #5B637E | RecallGuard project theme (app-icon hue at jade's saturation) |

## Animation Timing

- **Preloader duration**: 2500ms, passed from `Preloader.jsx` to `WaterReveal`
- **Hero text**: waits for the preloader's completion handoff, not a fixed delay
- **Scene reveal**: the preloader holds until the scene fires `scene:ready`, so the
  hero is never revealed as a bare beige field while textures decode

## Preloader - Rain on Glass

A full-screen WebGL canvas (`WaterReveal.jsx` + `rainShaders.js`) renders a
frosted-beige pane; procedural rain beads and streaks down it, clearing trails
that reveal the page behind. `u_progress` drives the reveal; `onComplete` fires
when the pane is clear. Falls back to a plain fade when WebGL is unavailable or
the user prefers reduced motion.

## Hero Scene

The backdrop is a live three.js scene, not a background image. `InkScene.jsx`
owns the canvas element and nothing else; everything drawn on it lives in
`scene/`, framework-free, so no scene state rides the React render cycle.
three is imported dynamically so it lands in its own chunk. If WebGL is
unavailable the canvas is replaced by the flat painting, so the hero is never
blank.

**The painting is four depth planes**, cut from `assets/images/background2560.webp`
by `scripts/make-painting-layers.mjs` and described by `assets/painting/layers.json`.
Read the manifest, never hardcode the numbers — a retuned seam moves a layer's
first row.

Things that were learned the hard way and are cheap to break again:

- **Each layer is a BAND**, fading in at its seam and dissolving once the layer
  in front takes over. Running layers to the bottom of the source makes gaps
  impossible but leaves every layer holding the same village, so the camera
  composites the scene against displaced copies of itself and the page shows
  duplicates.
- **The feather is the only place two layers are both visible**, so it is the
  only place doubling can appear. It must land inside the painting's own mist,
  which is why seams are carved per column rather than ruled straight.
- **Fog colour MUST equal the page beige.** That is what makes every layer
  terminate in the background colour with no edge to seam against.
- **Clouds must be LIGHTER than the landscape** to register at all, and each
  band samples its own lane of the texture — identical shapes stacked add
  opacity but no volume. They do not animate: only the camera moves them.
- **Lateral parallax is derived, not chosen.** Each layer's follow factor comes
  from how much painting it has past the composition, so a wider source unlocks
  its parallax with no code change.

## Adding New Content

### New Project
1. Add image to `src/assets/images/`
2. Add entry to `src/data/projects.json` with fields:
   - `id`, `title`, `description`, `techstack`, `technologies[]`
   - `image`, `github` (optional), `demo` (optional), `poster` (optional), `theme`
3. Import image in `src/components/About/Projects.jsx` and add to `projectImages` map
4. If poster exists, import and add to `projectPosters` map

### New Experience
1. Add entry to `src/data/experience.json` with required fields:
   - `id`, `title`, `employment`, `company`, `timeframe`, `year`
   - `description`, `shortDescription`, `link`, `technologies`
2. Components auto-render from data (Experience.jsx and ExperienceTimeline.jsx)

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Home.jsx | Hero section + Projects (single-page flow) |

## UI Notes

- **No navigation menu** - Single page flow design
- **Logo** - Fixed top-left, clicking scrolls to top
- **Scrollbars hidden** - Clean look, Lenis handles smooth scrolling
- **No horizontal scroll** - `overflow-x: hidden` on html/body

## UI Components

### ProjectCard
- Displays project with image, title, description, and tech stack
- **Tech stack**: Shows first 5 technologies, clickable "+N" expands to show all
- **Action buttons**: View Poster (if poster exists), Live Demo (if demo exists)
- **Theme-based borders**: jade for fishing theme, gold for Michelin theme, ultramarine for RecallGuard (at higher opacity — 70%/100% vs 30%/60%, since the blue washes out on beige)

### ExperienceTimeline
- **Desktop (1024px+)**: Horizontal scrolling timeline with animated SVG path
- **Mobile (<1024px)**: Vertical timeline with stacked cards
- **Tech stack**: Expandable with clickable "+N" button (4 visible on mobile, 5 on desktop)
- Uses `ExpandableTechStack` component for consistent expand/collapse behavior

## Common Issues

- **Animations not triggering**: Check GSAP ScrollTrigger registration in App.jsx
- **Smooth scroll issues**: Lenis integration in PageLayout.jsx
- **Preloader not showing**: Check WaterReveal.jsx canvas rendering
- **Hero backdrop blank**: the scene failed to init and fell back to the flat
  painting — check the console for `[InkScene]`
- **Build cannot resolve `three`**: local `node_modules` gap, run `npm install`

## Deployment

**Cloudflare Pages, Git-connected. NOT GitHub Actions and NOT GitHub Pages** —
there is no `.github/workflows/`, so do not go looking for one. Pushing to
`main` triggers a Cloudflare build and deploy, typically live in about a minute
at anthonyzchen.com.

- `public/_redirects` carries the RecallGuard 301s to azcstudios.com. Those
  rules must stay ABOVE any SPA fallback: Cloudflare takes the first match, so a
  catch-all placed first swallows them.
- Verify a deploy by diffing the `assets/index-*.js` hash the live site serves
  against the one `npm run build` produces locally.
- The hero scene needs `three`. If `npm run build` fails to resolve it after
  switching branches or worktrees, that is a local `node_modules` gap — run
  `npm install`. Cloudflare installs from the lockfile and is unaffected.
