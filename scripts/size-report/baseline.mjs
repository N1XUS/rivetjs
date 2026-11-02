/** Partial measurements replace only selected rows, preserving unmeasured rows and metadata. */
export function baselineAfterUpdate(previous, measured, partial, sections = ["apps"]) {
  if (!partial) return measured;
  const updated = { ...previous };
  for (const section of sections) updated[section] = { ...previous[section], ...measured[section] };
  return updated;
}

/** Numeric leaves that grew (current > baseline + tolerance). `*Requests` counts grow at +1, `status` never compares. */
export function growth(base, now, tolerance, at = "") {
  const out = [];
  for (const [key, value] of Object.entries(now ?? {})) {
    const path = at ? at + "." + key : key;
    const old = base?.[key];
    if (typeof value === "number" && typeof old === "number" && !/status|Requests$/.test(key) && value > old + tolerance)
      out.push(`${path}: ${old} -> ${value} (+${value - old})`);
    else if (typeof value === "number" && typeof old === "number" && /Requests$/.test(key) && value > old) out.push(`${path}: ${old} -> ${value}`);
    else if (value && typeof value === "object" && !Array.isArray(value)) out.push(...growth(old, value, tolerance, path));
  }
  return out;
}

/**
 * Routes that broke vs the baseline: a non-200 status, a failed scripted interaction (`interactionError`) or page
 * errors that the baseline row did not have. A broken route measures nothing (or less), so `growth` alone would let
 * it pass. A row already broken the same way in the baseline stays a known red here (fix it, then `--update`).
 */
export function broken(base, report) {
  const out = [];
  for (const [name, app] of Object.entries(report.apps ?? {}))
    for (const [path, row] of Object.entries(app?.routes ?? {})) {
      const was = base?.apps?.[name]?.routes?.[path];
      const at = `apps.${name}.routes.${path}`;
      if (row.status !== 200 && row.status !== was?.status) out.push(`${at}.status: ${was?.status ?? "new"} -> ${row.status}`);
      if (row.interactionError && !was?.interactionError) out.push(`${at}.interactionError: ${row.interactionError}`);
      const errors = (row.errors ?? []).filter((e) => !(was?.errors ?? []).includes(e));
      if (errors.length) out.push(`${at}.errors: ${errors.join(" | ")}`);
    }
  return out;
}
