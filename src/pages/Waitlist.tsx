import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { isValidReferralCodeFormat, normalizeReferralCode } from "@/lib/referral";
import type { City, WaitlistEntry } from "@/types";
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  Heart,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";

const CITY_OPTIONS: Array<City | "Both"> = ["Accra", "Tema", "Both"];

/**
 * Public, no-auth waitlist landing — for visitors who don't want to
 * create a full KAYA account yet but want to know when we launch.
 */
export default function Waitlist() {
  const { addWaitlistEntry, waitlistEntries, user } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState<(City | "Both") | "">("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<WaitlistEntry | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(normalizeReferralCode(ref));
  }, [searchParams]);

  const totalCount = useMemo(() => waitlistEntries.length, [waitlistEntries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Tell us what to call you.");
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      setError("That email doesn't look right.");
      return;
    }
    const trimmedRef = referralCode.trim();
    if (trimmedRef && !isValidReferralCodeFormat(trimmedRef)) {
      setError(
        "That referral code doesn't look right — codes are 6 letters and numbers."
      );
      return;
    }

    const entry = addWaitlistEntry({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      city: (city || undefined) as City | "Both" | undefined,
      source: "waitlist_page",
      referredByCode: trimmedRef
        ? normalizeReferralCode(trimmedRef)
        : undefined,
    });

    if (!entry) {
      // Already on the list — still show success.
      const existing = waitlistEntries.find(
        (w) => w.email.toLowerCase() === email.trim().toLowerCase()
      );
      setSubmitted(existing ?? null);
      toast("You're already on the launch list", {
        description: "We'll email you the moment KAYA opens for orders.",
      });
      return;
    }
    setSubmitted(entry);
    toast.success("You're on the launch list", {
      description: "We'll email you the moment KAYA opens for orders.",
    });
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="container-app px-4 py-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (user ? navigate("/") : navigate("/login"))}
          className="grid place-items-center w-10 h-10 rounded-2xl bg-white border border-charcoal-100 hover:bg-cream-100 transition"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-9 h-9 rounded-2xl bg-mustard-400 text-charcoal-900 display font-bold">
            K
          </div>
          <span className="display text-xl font-semibold text-charcoal-900">
            KAYA
          </span>
        </div>
        <Link
          to="/login"
          className="text-xs font-semibold text-charcoal-700 hover:text-charcoal-900 underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </header>

      <main className="container-app px-4 pb-12">
        <section className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
          {/* Hero copy */}
          <div className="animate-fade-in-up">
            <div className="chip bg-sage-100 text-sage-700 mb-3">
              <span>🇬🇭</span> Launching in Accra & Tema
            </div>
            <h1 className="display text-4xl sm:text-5xl font-semibold text-charcoal-900 leading-[1.05] text-balance">
              KAYA is preparing for launch in Accra & Tema.
            </h1>
            <p className="mt-4 text-base text-charcoal-700 leading-relaxed max-w-prose">
              Join the waitlist and be among the first families to send care
              through KAYA.{" "}
              <span aria-hidden className="text-clay-400">
                ❤️
              </span>
            </p>

            <ul className="mt-6 space-y-3">
              {[
                {
                  Icon: Heart,
                  title: "Care-first delivery",
                  body: "Thoughtful gifts, essentials, and everyday care delivered to the people who matter most.",
                },
                {
                  Icon: Sparkles,
                  title: "Support without the stress",
                  body: "Send care to loved ones in Ghana from wherever you are — no calling around, no chasing.",
                },
                {
                  Icon: Gift,
                  title: "Refer a friend, earn credit",
                  body: "Bring a loved one onto the waitlist with your code — you both earn GH₵20 on the first order.",
                },
              ].map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="flex items-start gap-3 rounded-2xl bg-white border border-charcoal-100 p-3.5"
                >
                  <span className="grid place-items-center w-10 h-10 rounded-2xl bg-mustard-100 text-mustard-700 shrink-0">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-charcoal-900">
                      {title}
                    </p>
                    <p className="text-xs text-charcoal-400 leading-snug mt-0.5">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {totalCount > 0 && (
              <p className="mt-5 text-xs text-charcoal-400">
                Joining {totalCount} {totalCount === 1 ? "family" : "families"}{" "}
                already on the list.
              </p>
            )}
          </div>

          {/* Form / confirmation */}
          <div className="card-base p-5 sm:p-6">
            {submitted ? (
              <div className="text-center py-2">
                <span className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-sage-500 text-cream-50">
                  <CheckCircle2 size={26} />
                </span>
                <h2 className="display text-2xl font-semibold mt-4">
                  You're on the launch list
                </h2>
                <p className="text-sm text-charcoal-400 mt-2 max-w-xs mx-auto leading-relaxed">
                  We'll email <span className="font-semibold">{submitted.email}</span>{" "}
                  the moment KAYA opens for orders.
                </p>
                <div className="mt-6 space-y-2">
                  <Link to="/login" className="btn-primary w-full">
                    Create a full account
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate(user ? "/" : "/login")}
                    className="btn-outline w-full"
                  >
                    {user ? "Back home" : "Back to sign in"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="display text-2xl font-semibold leading-tight">
                    Join the waitlist
                  </h2>
                  <p className="text-sm text-charcoal-400 mt-1">
                    Takes 20 seconds. No spam, just one launch alert.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700">
                    Your name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-base mt-1"
                    placeholder="Ama Owusu"
                    autoComplete="name"
                    required
                  />
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
                  <label className="text-xs font-semibold text-charcoal-700 flex items-center justify-between">
                    Phone number
                    <span className="text-[10px] uppercase tracking-wider font-medium text-charcoal-400">
                      Optional
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-base mt-1"
                    placeholder="+1 555 123 4567"
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-charcoal-700 flex items-center gap-1.5">
                    <MapPin size={12} className="text-mustard-600" />
                    Which Ghana city are you sending to?
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {CITY_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setCity(city === opt ? "" : opt)}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                          city === opt
                            ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                            : "bg-white border-charcoal-100 hover:border-charcoal-400"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
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
                </div>

                {error && (
                  <div className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-sm px-4 py-2.5">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-yellow w-full">
                  <Mail size={16} /> Notify me at launch
                </button>

                <p className="text-center text-[11px] text-charcoal-400">
                  Want full access?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-charcoal-900 underline-offset-2 hover:underline"
                  >
                    Create an account
                  </Link>{" "}
                  and save your recipients now.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
