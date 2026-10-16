import type { Status } from "./types.ts";

const LABELS: Record<Status, string> = { stable: "Stable", experimental: "Experimental", planned: "Planned" };

/** Feature status label (`stable` | `experimental` | `planned`). */
export function StatusBadge({ status, small }: { status: Status; small?: boolean }) {
  return <span class={"status-badge status-" + status + (small ? " status-small" : "")}>{LABELS[status]}</span>;
}
