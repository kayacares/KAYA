import { useMemo, useState } from "react";
import { Download, History, Search, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { formatDate, relativeTime } from "@/lib/utils";
import { ROLE_BADGE, ROLE_LABEL, can } from "@/lib/permissions";
import type { AuditLogCategory, AuditLogEntry } from "@/types";

const CATEGORY_LABEL: Record<AuditLogCategory, string> = {
  auth: "Authentication",
  shops: "Shops",
  products: "Products",
  vendors: "Vendors",
  orders: "Orders",
  waitlist: "Waitlist",
  settings: "Settings",
  staff: "Staff",
  investigations: "Investigations",
  access: "Access denied",
};

const CATEGORY_PILL: Record<AuditLogCategory, string> = {
  auth: "bg-cream-200 text-charcoal-700",
  shops: "bg-mustard-100 text-mustard-700",
  products: "bg-sage-100 text-sage-700",
  vendors: "bg-cream-200 text-charcoal-700",
  orders: "bg-cream-200 text-charcoal-700",
  waitlist: "bg-cream-200 text-charcoal-700",
  settings: "bg-mustard-100 text-mustard-700",
  staff: "bg-charcoal-900 text-mustard-400",
  investigations: "bg-clay-100 text-clay-600",
  access: "bg-clay-400/15 text-clay-600",
};

function escapeCsv(value: string): string {
  if (value == null) return "";
  const needsQuoting = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function exportCsv(rows: AuditLogEntry[]) {
  const headers = [
    "Timestamp",
    "Actor",
    "Role",
    "Category",
    "Action",
    "Target",
    "Notes",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.at).toISOString(),
        r.actorName,
        ROLE_LABEL[r.actorRole],
        CATEGORY_LABEL[r.category],
        r.action,
        r.target ? `${r.target.type}: ${r.target.label}` : "",
        r.notes ?? "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `kaya-audit-log-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} audit entries`);
}

/**
 * Audit Log tab — Super Admin only. Tracks every sensitive admin
 * action (sign-ins, deletions, refunds, settings changes) plus
 * attempted unauthorized actions.
 */
export default function AuditLogTab() {
  const { user, auditLog, recordAudit } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | AuditLogCategory>("all");

  if (!can("audit.view", user)) {
    return (
      <div className="card-base p-10 text-center">
        <ShieldAlert className="mx-auto text-clay-600 mb-2" size={28} />
        <p className="display text-xl font-semibold">Access denied</p>
        <p className="text-sm text-charcoal-400 mt-1">
          The audit log is restricted to Super Admin accounts.
        </p>
      </div>
    );
  }

  const counts = useMemo(() => {
    const c = new Map<AuditLogCategory, number>();
    for (const e of auditLog) c.set(e.category, (c.get(e.category) ?? 0) + 1);
    return c;
  }, [auditLog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return auditLog
      .filter((e) => category === "all" || e.category === category)
      .filter((e) => {
        if (!q) return true;
        return (
          e.actorName.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          (e.target?.label ?? "").toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q)
        );
      });
  }, [auditLog, query, category]);

  const denials = counts.get("access") ?? 0;
  const categoryOptions: Array<"all" | AuditLogCategory> = [
    "all",
    "auth",
    "shops",
    "products",
    "vendors",
    "orders",
    "settings",
    "staff",
    "investigations",
    "access",
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="display text-2xl font-semibold flex items-center gap-2">
            <History size={20} className="text-mustard-600" /> Audit log
          </h2>
          <p className="text-sm text-charcoal-400">
            {auditLog.length} sensitive action
            {auditLog.length === 1 ? "" : "s"} recorded
            {denials > 0 && (
              <>
                {" · "}
                <span className="text-clay-600 font-semibold">
                  {denials} access{" "}
                  {denials === 1 ? "denial" : "denials"}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            exportCsv(filtered);
            recordAudit({
              category: "settings",
              action: `Exported ${filtered.length} audit log entries`,
            });
          }}
          disabled={filtered.length === 0}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by actor, action, target or notes"
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
        {categoryOptions.map((c) => {
          const count = c === "all" ? auditLog.length : counts.get(c) ?? 0;
          if (count === 0 && c !== "all" && category !== c) return null;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                category === c
                  ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                  : "bg-white border-charcoal-100 text-charcoal-700 hover:border-charcoal-400"
              }`}
            >
              {c === "all" ? "All" : CATEGORY_LABEL[c]} · {count}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <div className="text-4xl mb-2">📜</div>
          <p className="display text-lg font-semibold">
            {auditLog.length === 0 ? "No audit entries yet" : "No matches"}
          </p>
          <p className="text-sm text-charcoal-400 mt-1 max-w-sm mx-auto">
            {auditLog.length === 0
              ? "Sensitive admin actions — sign-ins, deletions, refunds, settings changes — will appear here as they happen."
              : "Try a different search or category filter."}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {filtered.map((entry) => (
            <li key={entry.id} className="card-base p-4">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="font-semibold text-sm flex-1 min-w-0">
                  {entry.action}
                </p>
                <span
                  className={`chip text-[10px] shrink-0 ${
                    CATEGORY_PILL[entry.category]
                  }`}
                >
                  {CATEGORY_LABEL[entry.category]}
                </span>
              </div>
              <p className="text-xs text-charcoal-400 mt-1 flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-charcoal-700">
                  {entry.actorName}
                </span>
                <span
                  className={`chip text-[9px] ${ROLE_BADGE[entry.actorRole]}`}
                >
                  {ROLE_LABEL[entry.actorRole]}
                </span>
                <span>·</span>
                <span title={formatDate(entry.at)}>
                  {relativeTime(entry.at)}
                </span>
              </p>
              {entry.target && (
                <p className="text-[11px] text-charcoal-700 mt-1 truncate">
                  <span className="text-charcoal-400">Target:</span>{" "}
                  <span className="font-semibold">{entry.target.label}</span>{" "}
                  <span className="text-charcoal-400">
                    ({entry.target.type})
                  </span>
                </p>
              )}
              {entry.notes && (
                <p className="text-[11px] text-charcoal-400 mt-1 leading-snug">
                  {entry.notes}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
