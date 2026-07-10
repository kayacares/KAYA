import { useMemo, useState } from "react";
import { Download, Mail, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { formatDate } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { WaitlistEntry, WaitlistSource } from "@/types";

const SOURCE_LABEL: Record<WaitlistSource, string> = {
  signup: "Account signup",
  waitlist_page: "Waitlist page",
  checkout: "Checkout",
};

const SOURCE_PILL: Record<WaitlistSource, string> = {
  signup: "bg-mustard-100 text-mustard-700",
  waitlist_page: "bg-sage-100 text-sage-700",
  checkout: "bg-clay-100 text-clay-600",
};

function escapeCsv(value: string): string {
  if (value == null) return "";
  const needsQuoting = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function exportCsv(rows: WaitlistEntry[]) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "City",
    "Source",
    "Referred by code",
    "Joined",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.email,
        r.phone ?? "",
        r.city ?? "",
        SOURCE_LABEL[r.source],
        r.referredByCode ?? "",
        new Date(r.createdAt).toISOString(),
      ]
        .map(escapeCsv)
        .join(",")
    );
  }
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `kaya-waitlist-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} waitlist contacts`);
}

export default function WaitlistTab() {
  const { waitlistEntries, user, recordAudit } = useApp();
  const canExport = can("waitlist.export", user);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | WaitlistSource>(
    "all"
  );

  const stats = useMemo(() => {
    const bySource = new Map<WaitlistSource, number>();
    const byCity = new Map<string, number>();
    let referred = 0;
    for (const e of waitlistEntries) {
      bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
      if (e.city) byCity.set(e.city, (byCity.get(e.city) ?? 0) + 1);
      if (e.referredByCode) referred++;
    }
    return { bySource, byCity, referred };
  }, [waitlistEntries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...waitlistEntries]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .filter(
        (e) => sourceFilter === "all" || e.source === sourceFilter
      )
      .filter((e) => {
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          (e.phone ?? "").toLowerCase().includes(q) ||
          (e.referredByCode ?? "").toLowerCase().includes(q)
        );
      });
  }, [waitlistEntries, query, sourceFilter]);

  const sourceOptions: Array<"all" | WaitlistSource> = [
    "all",
    "signup",
    "waitlist_page",
    "checkout",
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="display text-2xl font-semibold">Launch waitlist</h2>
          <p className="text-sm text-charcoal-400">
            {waitlistEntries.length}{" "}
            {waitlistEntries.length === 1 ? "family" : "families"} waiting for
            KAYA to open · {stats.referred} arrived via referral
          </p>
        </div>
        {canExport ? (
          <button
            type="button"
            onClick={() => {
              exportCsv(filtered);
              recordAudit({
                category: "waitlist",
                action: `Exported ${filtered.length} waitlist contacts`,
              });
            }}
            disabled={filtered.length === 0}
            className="btn-primary shrink-0 disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
        ) : (
          <span className="chip bg-cream-200 text-charcoal-700 shrink-0 text-[10px]">
            Export restricted to Super Admin
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatTile
          label="Total"
          value={waitlistEntries.length}
          accent="bg-mustard-100 text-mustard-700"
        />
        <StatTile
          label="Via signup"
          value={stats.bySource.get("signup") ?? 0}
          accent="bg-sage-100 text-sage-700"
        />
        <StatTile
          label="Via waitlist page"
          value={stats.bySource.get("waitlist_page") ?? 0}
          accent="bg-cream-200 text-charcoal-700"
        />
        <StatTile
          label="Via checkout"
          value={stats.bySource.get("checkout") ?? 0}
          accent="bg-clay-100 text-clay-600"
        />
      </div>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone or referral code"
          className="input-base pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full bg-charcoal-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {sourceOptions.map((s) => {
          const count =
            s === "all"
              ? waitlistEntries.length
              : stats.bySource.get(s) ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSourceFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                sourceFilter === s
                  ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                  : "bg-white border-charcoal-100 text-charcoal-700 hover:border-charcoal-400"
              }`}
            >
              {s === "all" ? "All" : SOURCE_LABEL[s]} · {count}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="display text-lg font-semibold">
            {waitlistEntries.length === 0
              ? "No waitlist signups yet"
              : "No matches"}
          </p>
          <p className="text-sm text-charcoal-400 mt-1 max-w-sm mx-auto">
            {waitlistEntries.length === 0
              ? "Waitlist signups from /waitlist, the signup flow and the checkout page will appear here."
              : "Try a different search or clear the filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <article
              key={e.id}
              className="card-base p-4 flex items-start gap-3"
            >
              <div className="grid place-items-center w-11 h-11 rounded-2xl bg-cream-100 display font-bold shrink-0 text-base text-charcoal-900">
                {(e.name[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{e.name}</p>
                  <span
                    className={`chip text-[10px] ${SOURCE_PILL[e.source]}`}
                  >
                    {SOURCE_LABEL[e.source]}
                  </span>
                </div>
                <p className="text-xs text-charcoal-400 mt-0.5 truncate flex items-center gap-1">
                  <Mail size={11} /> {e.email}
                  {e.phone && (
                    <>
                      <span className="text-charcoal-100">·</span> {e.phone}
                    </>
                  )}
                </p>
                <div className="text-[11px] text-charcoal-400 mt-1 flex items-center flex-wrap gap-2">
                  {e.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={10} /> {e.city}
                    </span>
                  )}
                  {e.referredByCode && (
                    <span className="inline-flex items-center gap-1 font-semibold text-mustard-700">
                      Referred by {e.referredByCode}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold">
                  Joined
                </p>
                <p className="text-xs font-semibold mt-0.5">
                  {formatDate(e.createdAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="card-base p-3">
      <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold leading-tight">
        {label}
      </p>
      <p className={`display text-2xl font-bold mt-1 tabular-nums`}>
        {value}
      </p>
      <span
        className={`mt-1 inline-block h-1 w-8 rounded-full ${accent
          .replace("text-", "bg-")
          .split(" ")
          .find((c) => c.startsWith("bg-")) || "bg-mustard-400"}`}
      />
    </div>
  );
}
