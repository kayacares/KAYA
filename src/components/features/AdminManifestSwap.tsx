import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Routes that should install as the "KAYA Ops" PWA rather than the
 * customer "KAYA" app. When the user is on any of these paths we swap
 * the active `<link rel="manifest">` (plus the iOS / Android home-screen
 * title and theme-color meta tags) to the staff variants so that
 * Add-to-Home-Screen installs land directly on `/admin` with its own
 * dedicated tile.
 */
const ADMIN_PATH_PREFIXES = [
  "/admin",
  "/staff-login",
  "/staff-reset-password",
];

const CUSTOMER = {
  manifest: "/manifest.json",
  appleTitle: "KAYA",
  appName: "KAYA",
  themeLight: "#F2C94C",
} as const;

const OPS = {
  manifest: "/manifest-admin.json",
  appleTitle: "KAYA Ops",
  appName: "KAYA Ops",
  themeLight: "#1A1A18",
} as const;

/**
 * Mounted once inside the router. Watches `location.pathname` and swaps
 * the document-level PWA identity between KAYA customer and KAYA Ops.
 *
 * NOTE: Chrome caches `beforeinstallprompt` against the manifest that was
 * active when the event first fired. If the user navigated to /admin via
 * client-side routing after the customer manifest already fired the
 * install prompt, they may need to refresh the page once so Chrome
 * re-emits the event against the swapped admin manifest before tapping
 * Install. The InstallAppButton help modal already advises a refresh
 * when the install option isn't showing.
 */
export default function AdminManifestSwap() {
  const loc = useLocation();
  const isAdminContext = ADMIN_PATH_PREFIXES.some((p) =>
    loc.pathname.startsWith(p)
  );

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const target = isAdminContext ? OPS : CUSTOMER;
    const manifest = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]'
    );
    const appleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    );
    const appName = document.querySelector<HTMLMetaElement>(
      'meta[name="application-name"]'
    );
    const themeLight = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"][media*="light"]'
    );

    // Only update when the value actually changes — avoids forcing the
    // browser to re-parse the manifest on every render.
    if (
      manifest &&
      manifest.getAttribute("href") !== target.manifest
    ) {
      manifest.setAttribute("href", target.manifest);
    }
    if (
      appleTitle &&
      appleTitle.getAttribute("content") !== target.appleTitle
    ) {
      appleTitle.setAttribute("content", target.appleTitle);
    }
    if (appName && appName.getAttribute("content") !== target.appName) {
      appName.setAttribute("content", target.appName);
    }
    if (
      themeLight &&
      themeLight.getAttribute("content") !== target.themeLight
    ) {
      themeLight.setAttribute("content", target.themeLight);
    }
  }, [isAdminContext]);

  return null;
}
