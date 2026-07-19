import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import {
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referral";
import type { Country, Currency } from "@/types";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Gift,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  Search,
  UserPlus,
} from "lucide-react";

interface CountryOption {
  c: Country;
  label: string;
  cur: Currency;
  flag: string;
  dial: string;
}

const COUNTRIES: CountryOption[] = [
  { c: "USA", label: "United States", cur: "USD", flag: "🇺🇸", dial: "+1" },
  { c: "Canada", label: "Canada", cur: "CAD", flag: "🇨🇦", dial: "+1" },
  { c: "UK", label: "United Kingdom", cur: "GBP", flag: "🇬🇧", dial: "+44" },
  { c: "Germany", label: "Germany", cur: "EUR", flag: "🇩🇪", dial: "+49" },
  { c: "UAE", label: "UAE", cur: "AED", flag: "🇦🇪", dial: "+971" },
  { c: "France", label: "France", cur: "EUR", flag: "🇫🇷", dial: "+33" },
  {
    c: "Netherlands",
    label: "Netherlands",
    cur: "EUR",
    flag: "🇳🇱",
    dial: "+31",
  },
];

/** Google logo used inside the "Continue with Google" button. */
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function SearchableCountry({
  value,
  onChange,
}: {
  value: CountryOption;
  onChange: (opt: CountryOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/\D/g, "");
    return COUNTRIES.filter((opt) => {
      if (opt.label.toLowerCase().includes(q)) return true;
      if (opt.dial.toLowerCase().includes(q)) return true;
      if (digits && opt.dial.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }, [query]);

  const select = (opt: CountryOption) => {
    onChange(opt);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`input-base flex items-center justify-between gap-2 text-left ${
          open ? "border-mustard-400 ring-2 ring-mustard-400/40" : ""
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none" aria-hidden>
            {value.flag}
          </span>
          <span className="truncate font-medium text-charcoal-900">
            {value.label}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-charcoal-400 transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select your country"
          className="absolute z-30 top-[calc(100%+6px)] left-0 right-0 bg-white rounded-2xl border border-charcoal-100 shadow-hi overflow-hidden flex flex-col max-h-72 animate-fade-in-up"
        >
          <div className="p-2 border-b border-charcoal-100 shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                aria-hidden
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country..."
                aria-label="Search countries"
                className="w-full rounded-xl border border-charcoal-100 bg-white pl-9 pr-3 py-2 text-base placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-mustard-400/40 focus:border-mustard-400"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-charcoal-400 py-6 px-3">
                No countries match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((opt) => {
                const selected = opt.c === value.c;
                return (
                  <button
                    key={opt.c}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => select(opt)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition ${
                      selected
                        ? "bg-cream-100 text-charcoal-900"
                        : "hover:bg-cream-100 text-charcoal-700"
                    }`}
                  >
                    <span className="text-lg leading-none shrink-0" aria-hidden>
                      {opt.flag}
                    </span>
                    <span className="font-medium text-sm flex-1 truncate">
                      {opt.label}
                    </span>
                    <span className="text-xs text-charcoal-400 shrink-0 tabular-nums">
                      {opt.dial}
                    </span>
                    {selected && (
                      <Check
                        size={14}
                        className="text-emerald-600 shrink-0"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return { level: 0, label: "" };
    if (password.length < 8)
      return { level: 1, label: "Too short — minimum 8 characters" };
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const variety = [hasUpper, hasLower, hasDigit, hasSpecial].filter(
      Boolean
    ).length;
    if (variety >= 3 && password.length >= 12)
      return { level: 4, label: "Strong password" };
    if (variety >= 2 && password.length >= 10)
      return { level: 3, label: "Good password" };
    return { level: 2, label: "Fair — add more variety for a stronger password" };
  }, [password]);

  if (!password) return null;

  const barColors = [
    "bg-charcoal-100",
    "bg-clay-400",
    "bg-mustard-400",
    "bg-mustard-500",
    "bg-emerald-500",
  ];
  const textColors = [
    "text-charcoal-400",
    "text-clay-600",
    "text-mustard-700",
    "text-mustard-700",
    "text-emerald-600",
  ];

  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength.level ? barColors[strength.level] : "bg-charcoal-100"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-[11px] mt-1 font-semibold ${textColors[strength.level]}`}
      >
        {strength.label}
      </p>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-charcoal-100" />
      <span className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
        {label}
      </span>
      <div className="flex-1 h-px bg-charcoal-100" />
    </div>
  );
}

type Mode = "signup" | "signin" | "forgot";

/**
 * Customer sign-up / sign-in / forgot-password page. Supports two
 * methods per requirement:
 *   1. Continue with Google (Supabase Auth OAuth)
 *   2. Email + Password (Supabase Auth)
 *
 * Phone number is collected during email signup for order updates
 * and delivery notifications but never used as the primary login
 * factor. Google users complete their phone / country later on the
 * Profile page.
 *
 * ⚠️ EMAIL VERIFICATION IS NON-BLOCKING (fixed 2026-Q3, do not
 * regress): Customers are signed into KAYA immediately after
 * successful sign-up, EVEN when Supabase's server-side settings
 * would normally require email confirmation. The signed-in user
 * carries `emailVerified: false` which surfaces an "Unverified"
 * badge and gentle prompt on the Profile page. The blocking
 * "check your email" screen was removed because customers were
 * getting stuck when the Supabase email template sends an OTP
 * code (no code entry field existed) or when the link never
 * arrived. Verification now happens at leisure from Profile.
 */
export default function Login() {
  const {
    signUpWithEmail,
    signInCustomerWithEmail,
    signInWithGoogle,
    requestCustomerPasswordReset,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialMode: Mode =
    searchParams.get("mode") === "signin" ? "signin" : "signup";
  const [mode, setMode] = useState<Mode>(initialMode);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign-up state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [referralCode, setReferralCode] = useState("");

  // Sign-in state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // Forgot-password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(normalizeReferralCode(ref));
  }, [searchParams]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setResetSent(false);
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSubmitting(true);
    const next = searchParams.get("next");
    if (next) {
      // Stash the destination so `usePostAuthReturn` in App.tsx can
      // route the visitor back to /checkout (or wherever they came
      // from) the moment Google OAuth resolves. Cleared inside the
      // hook so nothing leaks between sessions.
      sessionStorage.setItem("kaya_post_login_next", next);
    } else {
      sessionStorage.removeItem("kaya_post_login_next");
    }
    const result = await signInWithGoogle();
    if (!result.ok) {
      setError(result.error ?? "Couldn't start Google sign in.");
      sessionStorage.removeItem("kaya_post_login_next");
      setSubmitting(false);
    }
    // On success the browser redirects to Google — nothing else to do.
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      setError("That email doesn't look right.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Add a valid mobile number so we can send delivery updates.");
      return;
    }
    const trimmedRef = referralCode.trim();
    if (trimmedRef && !isValidReferralCodeFormat(trimmedRef)) {
      setError(
        "That referral code doesn't look right — codes are 6 letters and numbers (e.g. KOFC4Q)."
      );
      return;
    }

    setSubmitting(true);
    const result = await signUpWithEmail({
      firstName,
      lastName,
      email,
      password,
      phone,
      country: country.c,
      referralCode: trimmedRef || undefined,
    });

    if (!result.ok) {
      setError(result.error ?? "Sign up failed. Please try again.");
      setSubmitting(false);
      return;
    }

    // Sign the user in immediately — no blocking "check your email"
    // screen. If Supabase requires email confirmation we still let
    // them in; they'll see a gentle "Unverified" badge in Profile
    // with a resend / verify-with-code option to complete later.
    if (result.needsEmailConfirmation) {
      toast.success("Welcome to KAYA — verify your email anytime from Profile.", {
        duration: 6000,
      });
    } else {
      toast.success("Welcome to KAYA!");
    }

    const nextPath = searchParams.get("next") ?? "/";
    navigate(nextPath, { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signInCustomerWithEmail(signinEmail, signinPassword);
    if (!result.ok) {
      setError(result.error ?? "Sign in failed.");
      setSubmitting(false);
      return;
    }
    const name = result.user?.firstName ?? result.user?.name?.split(" ")[0];
    const nextPath = searchParams.get("next") ?? "/";
    navigate(nextPath, {
      replace: true,
      state: { welcomeBack: true, firstName: name },
    });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await requestCustomerPasswordReset(forgotEmail);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't send the reset link.");
      return;
    }
    setResetSent(true);
    toast.success("Reset link sent — check your email.");
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      <header className="w-full border-b border-charcoal-100/60">
        <div className="mx-auto max-w-md sm:max-w-lg px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2"
            aria-label="KAYA home"
          >
            <div className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-400 text-charcoal-900 display font-bold shadow-soft">
              K
            </div>
            <span className="display text-2xl font-semibold text-charcoal-900">
              KAYA
            </span>
          </Link>
          <Link
            to="/"
            className="text-xs font-semibold text-charcoal-700 hover:text-charcoal-900"
          >
            Back to home
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center py-8 sm:py-12 px-4 sm:px-6">
        <div className="w-full max-w-md animate-fade-in-up">
          {mode !== "forgot" && (
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="inline-flex p-1 rounded-full bg-charcoal-100 mb-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => switchMode("signup")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-charcoal-800 text-cream-50 shadow-sm"
                    : "text-charcoal-700 hover:text-charcoal-900"
                }`}
              >
                <UserPlus size={14} /> Sign up
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                onClick={() => switchMode("signin")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${
                  mode === "signin"
                    ? "bg-charcoal-800 text-cream-50 shadow-sm"
                    : "text-charcoal-700 hover:text-charcoal-900"
                }`}
              >
                <LogIn size={14} /> Sign in
              </button>
            </div>
          )}

          {mode === "signup" && (
            <>
              <div className="mb-6">
                <h1 className="display text-3xl sm:text-[2rem] font-semibold text-charcoal-900 leading-[1.15]">
                  Create your account
                </h1>
                <p className="mt-2 text-sm text-charcoal-700">
                  Join KAYA and start sending care to loved ones in Ghana.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border-2 border-charcoal-100 hover:border-charcoal-400 text-charcoal-900 px-4 py-3 text-sm font-semibold shadow-soft transition disabled:opacity-60"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <Divider label="Or sign up with email" />

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-charcoal-700">
                      First name
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input-base mt-1"
                      placeholder="Kofi"
                      autoComplete="given-name"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-charcoal-700">
                      Last name
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input-base mt-1"
                      placeholder="Asante"
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-base mt-1"
                    placeholder="you@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-base pr-12"
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full text-charcoal-400 hover:text-charcoal-900 hover:bg-cream-100 transition"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <PasswordStrengthBar password={password} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Confirm password
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-base pr-12"
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full text-charcoal-400 hover:text-charcoal-900 hover:bg-cream-100 transition"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] mt-1 text-clay-600 font-semibold">
                      Passwords don&rsquo;t match yet
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Country of residence
                  </label>
                  <div className="mt-1">
                    <SearchableCountry value={country} onChange={setCountry} />
                  </div>
                  <p className="text-[11px] text-charcoal-400 mt-1.5">
                    Used for your account and support.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Mobile phone number
                  </label>
                  <div className="mt-1 flex gap-2">
                    <div
                      className="flex items-center gap-1 px-3 py-3 rounded-2xl border border-charcoal-100 bg-cream-100 text-base sm:text-sm font-semibold text-charcoal-700 shrink-0"
                      aria-label={`Country code ${country.dial}`}
                    >
                      <span aria-hidden>{country.flag}</span>
                      <span>{country.dial}</span>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-base"
                      placeholder="555 123 4567"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-charcoal-400 mt-1.5">
                    For order updates, delivery notifications and account
                    support. Not used to sign in.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700 flex items-center gap-1.5">
                    <Gift size={12} className="text-mustard-600" />
                    Referral code{" "}
                    <span className="text-[10px] uppercase tracking-wider font-medium text-charcoal-400">
                      Optional
                    </span>
                  </label>
                  <input
                    value={referralCode}
                    onChange={(e) =>
                      setReferralCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    className="input-base mt-1 tracking-[0.25em] font-semibold"
                    placeholder="KOFC4Q"
                    maxLength={6}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-charcoal-400 mt-1.5">
                    Add a friend&rsquo;s code so they earn GH₵20 when you place
                    your first order.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-sm px-4 py-2.5"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-yellow w-full mt-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create my account
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-charcoal-400 mt-2">
                  By continuing you agree to KAYA&rsquo;s terms and privacy
                  policy.
                </p>
                <p className="text-center text-sm text-charcoal-700 mt-1">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-semibold text-charcoal-900 underline-offset-2 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </>
          )}

          {mode === "signin" && (
            <>
              <div className="mb-6">
                <div className="chip bg-mustard-100 text-mustard-700 mb-3">
                  <LogIn size={12} /> Welcome back
                </div>
                <h1 className="display text-3xl sm:text-[2rem] font-semibold text-charcoal-900 leading-[1.15]">
                  Sign in to KAYA
                </h1>
                <p className="mt-2 text-sm text-charcoal-700">
                  Pick up right where you left off.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border-2 border-charcoal-100 hover:border-charcoal-400 text-charcoal-900 px-4 py-3 text-sm font-semibold shadow-soft transition disabled:opacity-60"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <Divider label="Or sign in with email" />

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    className="input-base mt-1"
                    placeholder="you@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-charcoal-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-[11px] font-semibold text-mustard-700 hover:text-mustard-600"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={signinPassword}
                      onChange={(e) => setSigninPassword(e.target.value)}
                      className="input-base pr-12"
                      placeholder="Your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full text-charcoal-400 hover:text-charcoal-900 hover:bg-cream-100 transition"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-sm px-4 py-2.5"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-yellow w-full mt-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <LogIn size={16} />
                      Sign in
                    </>
                  )}
                </button>
                <p className="text-center text-sm text-charcoal-700">
                  New to KAYA?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-semibold text-charcoal-900 underline-offset-2 hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-700 hover:text-charcoal-900 mb-4"
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>

              {!resetSent ? (
                <>
                  <div className="mb-6">
                    <div className="chip bg-mustard-100 text-mustard-700 mb-3">
                      <KeyRound size={12} /> Reset password
                    </div>
                    <h1 className="display text-3xl sm:text-[2rem] font-semibold text-charcoal-900 leading-[1.15]">
                      Reset your password
                    </h1>
                    <p className="mt-2 text-sm text-charcoal-700">
                      Enter the email you signed up with and we&rsquo;ll send a
                      one-time reset link.
                    </p>
                  </div>

                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-charcoal-700">
                        Email address
                      </label>
                      <div className="relative mt-1">
                        <Mail
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
                        />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="input-base pl-10"
                          placeholder="you@email.com"
                          autoComplete="email"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-sm px-4 py-2.5"
                      >
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-yellow w-full disabled:opacity-60"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending link…
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          Send reset link
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <span className="inline-grid place-items-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mb-4 shadow-soft">
                    <CheckCircle2 size={28} />
                  </span>
                  <h2 className="display text-2xl font-semibold text-charcoal-900">
                    Check your email
                  </h2>
                  <p className="text-sm text-charcoal-700 mt-2 leading-relaxed">
                    If an account exists for{" "}
                    <span className="font-semibold text-charcoal-900">
                      {forgotEmail}
                    </span>
                    , we&rsquo;ve sent a reset link. Open it on this device to
                    set a new password.
                  </p>
                  <div className="mt-4 rounded-2xl bg-cream-100 border border-charcoal-100 px-4 py-3 text-left">
                    <p className="text-[10px] uppercase tracking-eyebrow font-bold text-charcoal-400">
                      Didn&rsquo;t receive it?
                    </p>
                    <p className="text-[11px] text-charcoal-700 mt-1 leading-relaxed">
                      Reset emails take up to a minute. Check your spam folder
                      or try again with a different email.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="btn-yellow w-full mt-5"
                  >
                    Back to sign in
                  </button>
                </div>
              )}
            </>
          )}

          {mode !== "forgot" && (
            <div className="mt-8 pt-6 border-t border-charcoal-100 text-center">
              <p className="text-[11px] uppercase tracking-eyebrow font-bold text-charcoal-400 mb-2">
                Just want a launch alert?
              </p>
              <Link
                to="/waitlist"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal-900 underline-offset-2 hover:underline"
              >
                Join the waitlist instead
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
