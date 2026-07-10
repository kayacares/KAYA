import { Link, useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import {
  ArrowRight,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import CurrencySelector from "@/components/features/CurrencySelector";
import SupportButton from "@/components/features/SupportButton";
import ReferralCreditCard from "@/components/features/ReferralCreditCard";
import type { UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Customer",
  ops: "Operations Coordinator",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_STYLE: Record<UserRole, string> = {
  customer: "bg-cream-200 text-charcoal-700",
  ops: "bg-sage-300 text-charcoal-900",
  admin: "bg-mustard-400 text-charcoal-900",
  super_admin: "bg-charcoal-900 text-cream-50",
};

export default function Profile() {
  const { user, logout, recipients, orders } = useApp();
  const navigate = useNavigate();

  if (!user) return null;

  const role: UserRole = user.role ?? (user.isAdmin ? "admin" : "customer");
  const isStaff = role !== "customer";

  const myOrders = orders.filter((o) => o.senderId === user.id);
  const totalSentGHS = myOrders.reduce((s, o) => s + o.totalGHS, 0);

  return (
    <>
      <TopBar title="Profile" right={<CurrencySelector />} />
      <main className="container-app px-4 pb-10">
        <section className="card-base p-5 mb-4 bg-charcoal-800 text-cream-50 border-charcoal-700">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-mustard-400 text-charcoal-900 display text-2xl font-bold">
              {(user.firstName?.[0] ?? user.name[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="display text-xl font-semibold truncate">
                {user.name}
              </p>
              <p className="text-xs text-cream-100/70 truncate">
                {user.email} · {user.country}
              </p>
              <span className={`chip text-[10px] mt-2 ${ROLE_STYLE[role]}`}>
                {isStaff && <ShieldCheck size={11} />}
                {ROLE_LABEL[role]}
              </span>
            </div>
          </div>
          {!isStaff && (
            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { l: "Loved ones", v: recipients.length },
                { l: "Care sent", v: myOrders.length },
                { l: "Total GH₵", v: totalSentGHS.toFixed(0) },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-2xl bg-cream-50/10 p-3 text-center"
                >
                  <p className="display text-xl font-bold">{s.v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-cream-100/70">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {!isStaff && <ReferralCreditCard />}

        <section className="card-base p-2 mb-4 divide-y divide-charcoal-100">
          <Link
            to="/recipients"
            className="flex items-center gap-3 p-3 hover:bg-cream-100 rounded-2xl"
          >
            <Users size={18} className="text-charcoal-700" />
            <span className="font-medium text-sm flex-1">Recipients</span>
            <ArrowRight size={14} className="text-charcoal-400" />
          </Link>
          <Link
            to="/help"
            className="flex items-center gap-3 p-3 hover:bg-cream-100 rounded-2xl"
          >
            <HelpCircle size={18} className="text-charcoal-700" />
            <span className="font-medium text-sm flex-1">Help Center</span>
            <span className="chip bg-sage-100 text-sage-700 text-[10px]">FAQs</span>
            <ArrowRight size={14} className="text-charcoal-400" />
          </Link>
        </section>

        {/* KAYA is a Ghana-first, GHS-only marketplace at launch —
            surfaced here so customers understand why the display
            currency is fixed regardless of their home country. */}
        {!isStaff && (
          <section className="card-base p-4 mb-4 bg-cream-100 border-charcoal-100/60">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white text-mustard-600 shrink-0 display font-bold text-sm">
                GH₵
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-charcoal-900">
                  All prices shown in Ghana Cedis
                </p>
                <p className="text-[11px] text-charcoal-700 leading-snug mt-1">
                  KAYA charges in GH₵ so what you see is what you pay.
                  Your bank or card provider may convert this charge
                  into your local currency.
                </p>
              </div>
            </div>
          </section>
        )}

        <SupportButton variant="card" className="mb-4" />

        <button
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="btn-outline w-full text-clay-600 border-clay-400/30"
        >
          <LogOut size={16} /> Sign out
        </button>
      </main>
    </>
  );
}
