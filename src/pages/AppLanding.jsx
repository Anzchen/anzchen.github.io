import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import appsData from "../data/apps.json";
import { usePageEntrance } from "../components/utils";

// Map app slug -> imported icon asset; apps without one fall back to an initial.
const appIcons = {};

const AppStoreBadge = ({ url }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-beige transition-colors hover:bg-ink/80"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M15.545 9.891a4.372 4.372 0 0 1 2.084 3.67c0 .058-.004.116-.005.174a4.457 4.457 0 0 1-2.078 3.592 4.486 4.486 0 0 1-1.46.654c-.35.09-.713.135-1.078.134a4.27 4.27 0 0 1-1.476-.273l-.004-.002a4.074 4.074 0 0 0-1.528-.302 4.074 4.074 0 0 0-1.528.302l-.004.002A4.27 4.27 0 0 1 7 18.115a4.486 4.486 0 0 1-2.538-.788A4.457 4.457 0 0 1 2.384 13.735c0-.058-.003-.116-.005-.174a4.372 4.372 0 0 1 2.084-3.67 4.288 4.288 0 0 1 .963-.442A3.182 3.182 0 0 1 6.5 9.261c.37 0 .73.066 1.074.188l.004.002c.31.108.634.185.963.23V6.5a3.5 3.5 0 0 1 3-3.465V1.5a.5.5 0 0 1 1 0v1.535A3.5 3.5 0 0 1 15.5 6.5v3.181c.329-.045.653-.122.963-.23l.004-.002A3.242 3.242 0 0 1 17.541 9.261c.37 0 .73.066 1.074.188.33.118.654.267.963.442z" />
    </svg>
    Download on the App Store
  </a>
);

const AppLanding = () => {
  const { slug } = useParams();
  const app = appsData.find((a) => a.slug === slug);

  const entranceRef = usePageEntrance();

  useEffect(() => {
    document.title = app
      ? `${app.name} | AnthonyZChen`
      : "App Not Found | AnthonyZChen";
  }, [app]);

  if (!app) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-4 text-3xl font-light uppercase tracking-widest text-ink">
          App Not Found
        </h1>
        <p className="mb-8 text-brown/70">
          The app you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="text-sm text-vermillion transition-colors hover:text-terracotta"
        >
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div ref={entranceRef}>
      {/* App header */}
      <div className="mb-12 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        {/* App icon */}
        {appIcons[slug] ? (
          <img
            src={appIcons[slug]}
            alt={`${app.name} icon`}
            className="mb-6 h-24 w-24 rounded-2xl shadow-md sm:mb-0 sm:mr-8"
          />
        ) : (
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-dark-beige text-3xl font-light text-ink shadow-md sm:mb-0 sm:mr-8">
            {(app.name || "?").charAt(0)}
          </div>
        )}

        <div>
          <h1 className="mb-2 text-3xl font-light uppercase tracking-widest text-ink sm:text-4xl">
            {app.name}
          </h1>
          {app.tagline && (
            <p className="mb-4 text-base text-brown/80">{app.tagline}</p>
          )}
          {app.appStoreUrl && <AppStoreBadge url={app.appStoreUrl} />}
        </div>
      </div>

      {/* Description */}
      <section className="mb-12">
        <p className="text-sm leading-relaxed text-brown/80 sm:text-base">
          {app.description}
        </p>
      </section>

      {/* Screenshots */}
      {app.screenshots?.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6 text-lg font-medium uppercase tracking-wide text-ink">
            Screenshots
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {app.screenshots.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${app.name} screenshot ${i + 1}`}
                className="h-96 w-auto shrink-0 rounded-lg shadow-md"
              />
            ))}
          </div>
        </section>
      )}

      {/* Links */}
      <section className="flex flex-wrap gap-4 border-t border-ink/10 pt-8">
        <Link
          to={`/apps/${slug}/privacy`}
          className="text-sm text-brown/70 transition-colors hover:text-vermillion"
        >
          Privacy Policy
        </Link>
        <span className="text-brown/30">|</span>
        <Link
          to={`/apps/${slug}/support`}
          className="text-sm text-brown/70 transition-colors hover:text-vermillion"
        >
          Support
        </Link>
        {app.demoUrl && (
          <>
            <span className="text-brown/30">|</span>
            <a
              href={app.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brown/70 transition-colors hover:text-vermillion"
            >
              Live Demo
            </a>
          </>
        )}
        {app.appStoreUrl && (
          <>
            <span className="text-brown/30">|</span>
            <a
              href={app.appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brown/70 transition-colors hover:text-vermillion"
            >
              App Store
            </a>
          </>
        )}
      </section>
    </div>
  );
};

export default AppLanding;
