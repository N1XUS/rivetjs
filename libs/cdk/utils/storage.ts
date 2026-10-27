// Web Storage that never throws (Rivet, COLD-FIX-B 2026-10-27). Components that persist UI state (cdk Resizable
// `useDefaultLayout`, ui AppLayout panel sizes) read and write through these: private browsing (older iOS Safari:
// every `setItem` throws `QuotaExceededError`), a full quota, or storage access denied (`SecurityError` on the
// `localStorage` getter when cookies are blocked) leave the state in memory, silently — a failed write is expected
// there, not an error (before: Resizable logged each failed save with `console.error`).

/** A storage-like object (`getItem` / `setItem`; `removeItem` optional): `localStorage`, `sessionStorage`, a cookie storage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** `localStorage` / `sessionStorage`, or `undefined` on the server and where reading the property throws (access denied). */
export function webStorage(kind: "local" | "session" = "local"): Storage | undefined {
  try {
    if (typeof document === "undefined") return undefined;
    return (kind === "local" ? globalThis.localStorage : globalThis.sessionStorage) ?? undefined;
  } catch {
    return undefined;
  }
}

/** `storage.getItem(key)`; `null` without storage or when the read throws. */
export function readStorage(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** `storage.setItem(key, value)`; false (state stays in memory) without storage or when the write throws. */
export function writeStorage(storage: StorageLike | null | undefined, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** `storage.removeItem(key)`; false without storage / `removeItem` or when it throws. */
export function removeStorage(storage: StorageLike | null | undefined, key: string): boolean {
  if (!storage?.removeItem) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
