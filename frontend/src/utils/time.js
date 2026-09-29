/**
 * Time and duration formatting utilities.
 */

/** Format milliseconds as "m:ss" */
export function formatMs(ms) {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Format seconds as "m:ss" */
export function formatSec(sec) {
  return formatMs((sec ?? 0) * 1000);
}

/** Format a Date or ISO string as a short relative label ("2h ago", "just now"). */
export function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
