/** Partial measurements replace only selected rows, preserving unmeasured rows and metadata. */
export function baselineAfterUpdate(previous, measured, partial, sections = ["apps"]) {
  if (!partial) return measured;
  const updated = { ...previous };
  for (const section of sections) updated[section] = { ...previous[section], ...measured[section] };
  return updated;
}
