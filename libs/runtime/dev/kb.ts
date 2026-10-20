// Development only (imported by dev/on.ts; production resolution never reaches it): byte counts in dev messages.

/** `812 B` below 1 KiB, else `12.3 KB` (resume state-size warnings, `state-sites.ts` shapes). */
export const kb = (bytes: number): string => (bytes < 1024 ? bytes + " B" : (bytes / 1024).toFixed(1) + " KB");
