import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    // Required so PASSWORD_RECOVERY links land on /staff-reset-password
    // with the recovery session already parsed from the URL hash.
    detectSessionInUrl: true,
  },
});

/**
 * ============================================================
 * Write Tracker — fixes admin → customer sync race (2026-Q3)
 * ------------------------------------------------------------
 * EVERY Supabase mutation (upsertShopRow, upsertProductRow,
 * upsertDeliveryAreaRow, deleteXRow, updateStaffLastSignIn,
 * upsertLocationConfirmation, etc.) MUST be wrapped in
 * `trackWrite` so the background sync effect in AppContext
 * knows there is a write in flight.
 *
 * WHY (recurring bug, do not regress):
 * The sync polling effect fetches the entire catalogue every
 * 20 seconds (plus on every visibilitychange / online event).
 * Without coordination, a poll that fires *while an admin's
 * upsert is still in flight* returns the pre-write server
 * snapshot and clobbers the optimistic local update. Users
 * saw this as "added item appears briefly then disappears on
 * reload" because the sync effect had overwritten localStorage
 * with the stale snapshot before Supabase committed the row.
 *
 * Even the SUCCESSFUL write ended up lost because:
 *   1. User adds area X — setDeliveryAreas puts X into local
 *      state → save-effect writes X into localStorage.
 *   2. Fire-and-forget upsert starts.
 *   3. Poll fires 100–500ms later (visibilitychange etc).
 *   4. Server hasn't committed X yet — poll returns the OLD
 *      snapshot without X.
 *   5. setDeliveryAreas(server) wipes X from local and the
 *      save-effect overwrites localStorage without X.
 *   6. Upsert finally commits to DB.
 *   7. User reloads: localStorage has no X, and the fresh
 *      fetch has X but it's too late — the local state was
 *      already showing "no X" and the user thought the write
 *      failed. In many cases the upsert had also been
 *      cancelled by a mid-flight page reload.
 *
 * HOW THIS FIXES IT:
 * - Increment counter BEFORE the write begins.
 * - Sync effect checks `getActiveWriteCount() > 0` and skips
 *   the poll if any write is in flight. It runs again on the
 *   next interval / visibility / online tick.
 * - Keep counter incremented for 2 seconds AFTER the write
 *   resolves so a poll that was already in-flight when the
 *   write finished can't return before-image data.
 * - On failure decrement immediately so a retry / manual
 *   refresh can proceed.
 * - 30-second "stuck write" safety valve force-decrements so
 *   a hung request can never permanently block sync.
 * ============================================================
 */
let activeWriteCount = 0;

export function getActiveWriteCount(): number {
  return activeWriteCount;
}

export async function trackWrite<T>(fn: () => Promise<T>): Promise<T> {
  activeWriteCount++;
  let cleanedUp = false;
  const clear = (immediate: boolean): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (immediate) {
      activeWriteCount = Math.max(0, activeWriteCount - 1);
    } else {
      window.setTimeout(() => {
        activeWriteCount = Math.max(0, activeWriteCount - 1);
      }, 2000);
    }
  };
  // Safety valve: if the write hangs for > 30s, decrement anyway
  // so sync can resume. The Promise itself keeps running and its
  // resolution / rejection is still awaited by the caller so
  // error handling stays intact.
  const stuckTimer = window.setTimeout(() => clear(true), 30_000);
  try {
    const result = await fn();
    window.clearTimeout(stuckTimer);
    clear(false);
    return result;
  } catch (err) {
    window.clearTimeout(stuckTimer);
    clear(true);
    throw err;
  }
}
