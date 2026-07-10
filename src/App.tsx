import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider, useApp } from "@/contexts/AppContext";
import AppLayout from "@/components/layout/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Recipients from "@/pages/Recipients";
import RecipientDetail from "@/pages/RecipientDetail";
import Shop from "@/pages/Shop";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Bundle from "@/pages/Bundle";
import CarePackage from "@/pages/CarePackage";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Profile from "@/pages/Profile";
import Help from "@/pages/Help";
import Admin from "@/pages/Admin";
import StaffLogin from "@/pages/StaffLogin";
import StaffResetPassword from "@/pages/StaffResetPassword";
import Waitlist from "@/pages/Waitlist";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCanceled from "@/pages/PaymentCanceled";
import ConfirmLocation from "@/pages/ConfirmLocation";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import NotFound from "@/pages/NotFound";
import InstallPrompt from "@/components/features/InstallPrompt";
import OfflineBanner from "@/components/features/OfflineBanner";
import AdminManifestSwap from "@/components/features/AdminManifestSwap";

/**
 * Protected route guard. Unauthenticated visitors are bounced to
 * `/login` — preserving the requested path as a `next` query param so
 * that once the visitor finishes signing up or signing in we can
 * return them to exactly where they were headed (cart → checkout,
 * order detail deep link, etc.). The public landing page at `/` is
 * served by `RootGate` instead of this guard.
 */
function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) {
    const requestedPath = `${location.pathname}${location.search}`;
    const nextParam =
      requestedPath && requestedPath !== "/"
        ? `?next=${encodeURIComponent(requestedPath)}`
        : "";
    return <Navigate to={`/login${nextParam}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Root route gate. Renders the public Landing page for unauthenticated
 * visitors and the standard AppLayout (with Home as the index child)
 * for signed-in users. This lets `/` serve two totally different
 * experiences without needing a redirect.
 */
function RootGate() {
  const { user } = useApp();
  if (!user) return <Landing />;
  return <AppLayout />;
}

/**
 * Watches for the transition from guest → signed-in and, when a
 * post-login destination was stashed in sessionStorage (by
 * `Login.tsx` right before kicking off the Google OAuth redirect),
 * navigates the browser back to that path. This is how a guest who
 * taps "Sign in to checkout" from the cart ends up on `/checkout`
 * the moment Google auth completes.
 */
function usePostAuthReturn() {
  const { user } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const next = sessionStorage.getItem("kaya_post_login_next");
    if (!next) return;
    sessionStorage.removeItem("kaya_post_login_next");
    navigate(next, { replace: true });
  }, [user, navigate]);
}

function AppShell() {
  usePostAuthReturn();
  return (
    <>
      <AdminManifestSwap />
      <OfflineBanner />
      <Routes>
        {/* Public entry point — Landing for guests, Home for members */}
        <Route path="/" element={<RootGate />}>
          <Route index element={<Home />} />
        </Route>

        {/* Public auth + informational routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route
          path="/staff-reset-password"
          element={<StaffResetPassword />}
        />

        {/* Customer password recovery — Supabase parses the recovery
            token from the URL hash and hands us a temporary session.
            Publicly accessible so recipients of the reset email can
            land here without being signed in first. */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Customer email verification landing — the destination of
            the "Verify Email" button in the sign-up confirmation
            email. Supabase parses the token from the URL hash and
            creates a session; VerifyEmail waits for the session,
            shows a confirmation state, then redirects the newly-
            verified customer straight into KAYA. */}
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Public recipient location confirmation — opened by the
            recipient from a WhatsApp / SMS link. Deliberately
            unauthenticated so recipients can pin their delivery
            location without needing a KAYA account. */}
        <Route
          path="/confirm-location/:token"
          element={<ConfirmLocation />}
        />

        {/* Public browsing routes — guests can shop, view care
            packages, open quick product sheets and manage their cart
            without ever signing up. Kept inside `AppLayout` so the
            bottom navigation and cart badge stay visible. The
            sign-in wall only appears when they try to save a
            recipient, proceed to checkout, or place an order. */}
        <Route element={<AppLayout />}>
          <Route path="/shop/:shopId" element={<Shop />} />
          <Route path="/care-package/:id" element={<CarePackage />} />
          <Route path="/bundle/:id" element={<Bundle />} />
          <Route path="/cart" element={<Cart />} />
        </Route>

        {/* Auth-required routes — anything that mutates a customer
            profile (saved recipients), completes an order, or reveals
            personal data (orders, profile, checkout) lives behind
            `Protected`, which redirects to /login?next=<current-path>
            so we can return the visitor here the moment auth
            completes. */}
        <Route
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/recipients" element={<Recipients />} />
          <Route path="/recipient/:id" element={<RecipientDetail />} />
          <Route path="/recipient/:id/shop/:shopId" element={<Shop />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/help" element={<Help />} />
        </Route>
        <Route
          path="/payment-success"
          element={
            <Protected>
              <PaymentSuccess />
            </Protected>
          }
        />
        <Route
          path="/payment-canceled"
          element={
            <Protected>
              <PaymentCanceled />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected>
              <Admin />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <InstallPrompt />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell />
        <Toaster
          position="top-center"
          closeButton
          richColors={false}
          offset={16}
          toastOptions={{
            classNames: {
              toast:
                "!rounded-2xl !border !border-mustard-400/50 !bg-cream-50 !text-charcoal-900 !shadow-card",
              title: "!font-semibold !text-charcoal-900",
              description: "!text-charcoal-700",
              closeButton: "!bg-cream-100 !border-charcoal-100",
            },
          }}
        />
      </BrowserRouter>
    </AppProvider>
  );
}
