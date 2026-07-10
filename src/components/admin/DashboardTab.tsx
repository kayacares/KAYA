import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { formatGHS } from "@/lib/currency";
import {
  Activity,
  CheckCircle2,
  Clock,
  Heart,
  Layers,
  MapPin,
  Repeat,
  TrendingUp,
  Users,
} from "lucide-react";
import AcquisitionChannelsCard from "@/components/admin/AcquisitionChannelsCard";
import ReferralsCard from "@/components/admin/ReferralsCard";
import SupportConfigNote from "@/components/admin/SupportConfigNote";
import { can } from "@/lib/permissions";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

export default function DashboardTab() {
  const { orders, customers, vendors, shops, recipients, user } = useApp();
  const canFinancials = can("financials.view", user);

  const stats = useMemo(() => {
    const now = Date.now();
    const last30 = orders.filter(
      (o) => now - new Date(o.createdAt).getTime() < MS_30D
    );
    const revenue = orders.reduce((s, o) => s + o.totalGHS, 0);
    const aov = orders.length ? revenue / orders.length : 0;
    const revenueLast30 = last30.reduce((s, o) => s + o.totalGHS, 0);
    const monthlyActiveSenders = new Set(last30.map((o) => o.senderId)).size;

    const senderCount = new Map<string, number>();
    orders.forEach((o) =>
      senderCount.set(o.senderId, (senderCount.get(o.senderId) ?? 0) + 1)
    );
    const totalSenders = senderCount.size;
    const repeatSenders = Array.from(senderCount.values()).filter(
      (n) => n >= 2
    ).length;
    const repeatRate =
      totalSenders > 0 ? (repeatSenders / totalSenders) * 100 : 0;

    const decided = orders.filter(
      (o) =>
        o.status === "Completed" || o.status === "Flagged for Investigation"
    );
    const successful = decided.filter((o) => o.status === "Completed").length;
    const successRate =
      decided.length > 0 ? (successful / decided.length) * 100 : 0;

    const fulfillmentMs: number[] = [];
    orders.forEach((o) => {
      const assigned = o.history.find((h) => h.status === "Assigned to Vendor");
      const out = o.history.find((h) => h.status === "Out for Delivery");
      if (assigned && out) {
        const diff =
          new Date(out.at).getTime() - new Date(assigned.at).getTime();
        if (diff > 0) fulfillmentMs.push(diff);
      }
    });
    const avgFulfillmentHrs =
      fulfillmentMs.length > 0
        ? fulfillmentMs.reduce((s, n) => s + n, 0) /
          fulfillmentMs.length /
          (60 * 60 * 1000)
        : 0;

    const totalCustomers = customers.filter(
      (u) => (u.role ?? "customer") === "customer"
    ).length;

    return {
      orderCount: orders.length,
      revenue,
      revenueLast30,
      aov,
      monthlyActiveSenders,
      totalSenders,
      repeatSenders,
      repeatRate,
      successRate,
      avgFulfillmentHrs,
      totalCustomers,
    };
  }, [orders, customers]);

  const coverage = useMemo(() => {
    const m: Record<string, number> = {};
    vendors
      .filter((v) => v.active)
      .forEach((v) =>
        v.coverageAreas.forEach((c) => (m[c] = (m[c] ?? 0) + 1))
      );
    return m;
  }, [vendors]);

  const byShop = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach((o) => (m[o.shopId] = (m[o.shopId] ?? 0) + o.totalGHS));
    return m;
  }, [orders]);
  const maxShop = Math.max(1, ...Object.values(byShop));

  return (
    <>
      <h2 className="display text-2xl font-semibold mb-1">
        Operations overview
      </h2>
      <p className="text-sm text-charcoal-400 mb-5">
        Realtime KPIs across orders, vendors and senders.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatTile
          Icon={Activity}
          label="Monthly Active Senders"
          value={stats.monthlyActiveSenders}
          sub="Senders · last 30d"
          accent="bg-mustard-100 text-mustard-700"
        />
        <StatTile
          Icon={Layers}
          label="Orders"
          value={stats.orderCount}
          sub={
            canFinancials
              ? `${formatGHS(stats.revenue)} revenue`
              : `${recipients.length} recipients served`
          }
          accent="bg-sage-100 text-sage-700"
        />
        {canFinancials && (
          <StatTile
            Icon={TrendingUp}
            label="Avg Order Value"
            value={formatGHS(stats.aov)}
            sub="Per order"
            accent="bg-cream-200 text-charcoal-700"
          />
        )}
        <StatTile
          Icon={Repeat}
          label="Repeat Rate"
          value={`${stats.repeatRate.toFixed(0)}%`}
          sub={`${stats.repeatSenders}/${stats.totalSenders} senders`}
          accent="bg-mustard-100 text-mustard-700"
        />
        <StatTile
          Icon={CheckCircle2}
          label="Successful Deliveries"
          value={`${stats.successRate.toFixed(0)}%`}
          sub="Recipient-confirmed"
          accent="bg-sage-100 text-sage-700"
        />
        <StatTile
          Icon={Clock}
          label="Vendor Fulfillment"
          value={
            stats.avgFulfillmentHrs > 0
              ? `${stats.avgFulfillmentHrs.toFixed(1)} hrs`
              : "—"
          }
          sub="Assigned → On the way"
          accent="bg-cream-200 text-charcoal-700"
        />
        <StatTile
          Icon={Users}
          label="Total Customers"
          value={stats.totalCustomers}
          sub={`${recipients.length} recipients saved`}
          accent="bg-mustard-100 text-mustard-700"
        />
        {canFinancials && (
          <StatTile
            Icon={Heart}
            label="30-day Revenue"
            value={formatGHS(stats.revenueLast30)}
            sub="Last 30 days"
            accent="bg-sage-100 text-sage-700"
          />
        )}
      </div>

      {canFinancials && (
        <div className="card-base p-4 mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-3">
            Revenue by shop
          </h3>
          <div className="space-y-3">
            {shops.map((s) => {
              const v = byShop[s.id] ?? 0;
              const pct = (v / maxShop) * 100;
              return (
                <div key={s.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">
                      {s.emoji} {s.name}
                    </span>
                    <span className="tabular-nums">{formatGHS(v)}</span>
                  </div>
                  <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mustard-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card-base p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-3 flex items-center gap-2">
          <MapPin size={13} /> Vendor coverage by zone
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {(["Accra", "Tema"] as const).map((zone) => (
            <div key={zone} className="rounded-2xl bg-cream-100 p-4">
              <p className="text-[11px] uppercase tracking-wider text-charcoal-400 font-semibold">
                {zone}
              </p>
              <p className="display text-3xl font-bold mt-1 tabular-nums">
                {coverage[zone] ?? 0}
              </p>
              <p className="text-xs text-charcoal-400 mt-0.5">
                active vendor{(coverage[zone] ?? 0) === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <AcquisitionChannelsCard />
      <ReferralsCard />
      <SupportConfigNote />
    </>
  );
}

function StatTile({
  Icon,
  label,
  value,
  sub,
  accent,
}: {
  Icon: any;
  label: string;
  value: any;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold leading-tight">
          {label}
        </p>
        <span
          className={`grid place-items-center w-7 h-7 rounded-full ${accent}`}
        >
          <Icon size={13} />
        </span>
      </div>
      <p className="display text-2xl font-bold mt-2 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-charcoal-400 mt-0.5">{sub}</p>}
    </div>
  );
}
