import { lazy, Suspense } from "react";
import Footer from "../components/Footer/Footer";
import Logo from "../components/Logo/Logo";
import Preloader from "../components/Preloader/Preloader";
import { Outlet } from "react-router-dom";

// Lazy so three.js lands in its own chunk and never blocks first paint.
const InkScene = lazy(() => import("../components/Scene/InkScene"));

const PageLayout = () => {
  return (
    <div className="bg-beige font-light text-brown">
      {/* Fixed backdrop at z-0. Every section below the hero carries its own
          opaque bg-beige, so they occlude the canvas as they scroll over it —
          no stacking work needed, and the scene stops rendering once covered. */}
      <Suspense fallback={null}>
        <InkScene />
      </Suspense>
      <Preloader />
      <Logo />
      <Outlet />
      <Footer />
    </div>
  );
};
export default PageLayout;
