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
      {/* The scene sits behind everything and stays visible the whole way down —
          the sections no longer carry an opaque bg-beige to occlude it. Cloud
          cover, thickening with scroll, is what pushes it back behind content. */}
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
