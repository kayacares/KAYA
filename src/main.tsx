import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { initPwa } from "@/lib/pwa";

initPwa();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* swallow: PWA still works without SW */
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/*
      HelmetProvider wires up react-helmet-async so pages (currently
      just Landing.tsx) can inject page-specific <title>, meta tags,
      canonical URLs and JSON-LD structured data. It's a required
      context provider — without it, <Helmet> renders no-ops.
    */}
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
