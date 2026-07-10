import { useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { formatDate } from "@/lib/utils";
import {
  ROLE_BADGE,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  can,
  getRole,
} from "@/lib/permissions";
import type { User, UserRole } from "@/types";

/**
 * Staff Management tab — Super Admin only. List staff, add/remove
 * accounts, reset passwords. Cannot remove self.
 */
export default function StaffTab() {
  const {
    user,
    customers,
    addStaffMember,
    removeStaffMember,
    resetStaffPassword,
    updateStaffEmail,
  } = useApp();
  const [adding, setAdding] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);

  if (!can("staff.manage", user)) {
    return (
      <div className="card-base p-10 text-center">
        <ShieldAlert className="mx-auto text-clay-600 mb-2" size={28} />
        <p className="display text-xl font-semibold">Access denied</p>
        <p className="text-sm text-charcoal-400 mt-1">
          Staff management is restricted to Super Admin accounts.
        </p>
      </div>
    );
  }

  const staff = customers
    .filter((c) => getRole(c) !== "customer")
    .sort((a, b) => {
      const order: UserRole[] = ["super_admin", "admin", "ops"];
      return order.indexOf(getRole(a)) - order.indexOf(getRole(b));
    });

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="display text-2xl font-semibold flex items-center gap-2">
            <UserCog size={20} className="text-mustard-600" /> Staff
          </h2>
          <p className="text-sm text-charcoal-400">
            {staff.length} staff account{staff.length === 1 ? "" : "s"} with
            access to KAYA Ops.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn-primary shrink-0"
        >
          <Plus size={16} /> Add staff
        </button>
      </div>

      <section className="card-base p-4 mb-4 bg-cream-100 border-mustard-400/40">
        <p className="text-[10px] uppercase tracking-wider font-bold text-mustard-700 mb-2">
          Role boundaries
        </p>
        <div className="space-y-2">
          {(["super_admin", "admin", "ops"] as UserRole[]).map((r) => (
            <div key={r} className="flex items-start gap-3">
              <span
                className={`chip text-[10px] shrink-0 ${ROLE_BADGE[r]}`}
              >
                {ROLE_LABEL[r]}
              </span>
              <p className="text-xs text-charcoal-700 leading-relaxed">
                {ROLE_DESCRIPTION[r]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        {staff.map((s) => {
          const role = getRole(s);
          const isSelf = s.id === user?.id;
          return (
            <article
              key={s.id}
              className="card-base p-4 flex items-start gap-3"
            >
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cream-100 display font-bold text-base shrink-0">
                {(s.firstName?.[0] ?? s.name[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{s.name}</p>
                  <span className={`chip text-[10px] ${ROLE_BADGE[role]}`}>
                    {ROLE_LABEL[role]}
                  </span>
                  {isSelf && (
                    <span className="chip bg-sage-100 text-sage-700 text-[10px]">
                      You
                    </span>
                  )}
                </div>
                <p className="text-xs text-charcoal-400 mt-0.5 truncate">
                  {s.email}
                  {s.phone && ` · ${s.phone}`}
                </p>
                {s.lastSignInAt && (
                  <p className="text-[10px] uppercase tracking-wider text-charcoal-400 font-semibold mt-1">
                    Last sign-in {formatDate(s.lastSignInAt)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingEmailId(s.id)}
                  className="btn-ghost text-[11px] py-1.5 px-2"
                  aria-label={`Update email for ${s.name}`}
                >
                  <Mail size={12} /> Email
                </button>
                <button
                  type="button"
                  onClick={() => setResettingId(s.id)}
                  className="btn-ghost text-[11px] py-1.5 px-2"
                  aria-label={`Reset password for ${s.name}`}
                >
                  <KeyRound size={12} /> Reset
                </button>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${s.name}? They will lose access to KAYA Ops immediately.`
                        )
                      ) {
                        if (removeStaffMember(s.id)) {
                          toast.success(`${s.name} removed`);
                        }
                      }
                    }}
                    className="btn-ghost text-[11px] py-1.5 px-2 text-clay-600"
                    aria-label={`Remove ${s.name}`}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {adding && (
        <AddStaffModal
          onClose={() => setAdding(false)}
          onSubmit={(data) => {
            const result = addStaffMember(data);
            if (!result.ok) {
              toast.error(result.error ?? "Couldn't add staff");
              return false;
            }
            toast.success(
              `${result.user?.name} added as ${ROLE_LABEL[data.role]}`
            );
            setAdding(false);
            return true;
          }}
        />
      )}

      {resettingId && (
        <ResetPasswordModal
          onClose={() => setResettingId(null)}
          onSubmit={(password) => {
            const ok = resetStaffPassword(resettingId, password);
            if (ok) {
              toast.success("Password reset");
              setResettingId(null);
            }
            return ok;
          }}
        />
      )}

      {editingEmailId && (
        <EditEmailModal
          staff={staff.find((s) => s.id === editingEmailId)!}
          isSelf={user?.id === editingEmailId}
          onClose={() => setEditingEmailId(null)}
          onSubmit={(newEmail) => {
            const result = updateStaffEmail(editingEmailId, newEmail);
            if (!result.ok) {
              toast.error(result.error ?? "Couldn't update email");
              return false;
            }
            toast.success("Email updated");
            setEditingEmailId(null);
            return true;
          }}
        />
      )}
    </>
  );
}

function AddStaffModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: UserRole;
    password: string;
  }) => boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("ops");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!email.includes("@")) {
      setError("Valid email required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    onSubmit({
      firstName,
      lastName,
      email,
      phone: phone.trim() || undefined,
      role,
      password,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
        <h3 className="display text-xl font-semibold mb-1">
          Add staff member
        </h3>
        <p className="text-xs text-charcoal-400 mb-4">
          They'll be able to sign in at /staff-login immediately.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input-base"
              placeholder="First name"
              required
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input-base"
              placeholder="Last name"
              required
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
            placeholder="Email"
            required
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-base"
            placeholder="Phone (optional)"
          />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400 mb-1.5">
              Role
            </p>
            <div className="grid grid-cols-1 gap-2">
              {(["super_admin", "admin", "ops"] as UserRole[]).map((r) => {
                const on = role === r;
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      on
                        ? "bg-charcoal-800 text-cream-50 border-charcoal-800"
                        : "bg-white border-charcoal-100 hover:border-charcoal-400"
                    }`}
                  >
                    <span
                      className={`chip text-[10px] shrink-0 ${
                        on
                          ? "bg-mustard-400 text-charcoal-900"
                          : ROLE_BADGE[r]
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </span>
                    <span
                      className={`text-[11px] leading-snug ${
                        on ? "text-cream-100/80" : "text-charcoal-400"
                      }`}
                    >
                      {ROLE_DESCRIPTION[r]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Temporary password
            </label>
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base pr-12"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-charcoal-400 hover:bg-cream-100 transition"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-charcoal-400 mt-1">
              Share this password securely with the new staff member.
            </p>
          </div>
          {error && (
            <p className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">
              <ShieldCheck size={14} /> Add staff
            </button>
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (password: string) => boolean;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5">
        <h3 className="display text-xl font-semibold mb-1">Reset password</h3>
        <p className="text-xs text-charcoal-400 mb-4">
          Share the new password securely with the staff member.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              New password
            </label>
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base pr-12"
                placeholder="Min 8 characters"
                minLength={8}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-charcoal-400 hover:bg-cream-100 transition"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">
              Reset password
            </button>
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEmailModal({
  staff,
  isSelf,
  onClose,
  onSubmit,
}: {
  staff: User;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (email: string) => boolean;
}) {
  const [email, setEmail] = useState(staff.email);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleaned = email.trim().toLowerCase();
    if (!cleaned.includes("@") || !cleaned.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    if (cleaned === staff.email.toLowerCase()) {
      setError("This is already the current email.");
      return;
    }
    onSubmit(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className="relative bg-cream-50 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5">
        <h3 className="display text-xl font-semibold mb-1 flex items-center gap-2">
          <Mail size={18} className="text-mustard-600" /> Update sign-in email
        </h3>
        <p className="text-xs text-charcoal-400 mb-4">
          {staff.name} will use this email at{" "}
          <span className="font-mono">/staff-login</span>. Their password
          stays the same.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              Current email
            </label>
            <p className="text-sm font-mono text-charcoal-700 bg-cream-100 rounded-xl px-3 py-2 mt-1 truncate">
              {staff.email}
            </p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-charcoal-400">
              New email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base mt-1"
              placeholder="new@email.com"
              autoFocus
              required
            />
          </div>
          {isSelf && (
            <p className="rounded-2xl bg-mustard-100 border border-mustard-400/40 text-charcoal-700 text-[11px] px-3 py-2 leading-snug">
              You're updating your own email. Make sure you remember it —
              you'll need it the next time you sign in.
            </p>
          )}
          {error && (
            <p className="rounded-2xl bg-clay-400/15 border border-clay-400/40 text-clay-600 text-xs px-4 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">
              <Mail size={14} /> Update email
            </button>
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
