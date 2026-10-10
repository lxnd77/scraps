/** Short lowercase relative time for mono metadata labels: "just now", "2 min ago", "3 h ago". */
export function relativeTime(then: Date | string, now: Date): string {
  const seconds = Math.round((now.getTime() - new Date(then).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} d ago`;
  return new Date(then)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
}

/** Short lowercase time until a moment: "in 3 h", "in 6 d", "now" once it has passed. */
export function relativeFuture(then: Date | string, now: Date): string {
  const seconds = Math.round((new Date(then).getTime() - now.getTime()) / 1000);
  if (seconds <= 0) return "now";
  if (seconds < 90) return "in a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} d`;
}
