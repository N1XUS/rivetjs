// `@rivetjs/cdk/storage` (COLD-FIX-B 2026-10-27): Web Storage reads / writes that never throw — private mode (older iOS
// Safari: every `setItem` throws QuotaExceededError), a full quota, access denied. Resizable `useDefaultLayout` saves
// through it: a failed save keeps the layout in memory without a console error (before: `console.error` per save).
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStorage, removeStorage, webStorage, writeStorage, type StorageLike } from "../utils/storage.ts";
import { useDefaultLayout } from "../resizable/index.tsx";

const quota = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");
const throwing: StorageLike & { ssr: true } = {
  ssr: true,
  getItem: () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem: () => {
    throw quota();
  },
  removeItem: () => {
    throw quota();
  },
};
const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

afterEach(() => vi.restoreAllMocks());

describe("cdk storage", () => {
  it("reads / writes / removes through a working storage", () => {
    const s = memory();
    expect(writeStorage(s, "k", "v")).toBe(true);
    expect(readStorage(s, "k")).toBe("v");
    expect(removeStorage(s, "k")).toBe(true);
    expect(readStorage(s, "k")).toBe(null);
  });

  it("a storage that throws reads as empty and refuses writes; no storage likewise", () => {
    expect(readStorage(throwing, "k")).toBe(null);
    expect(writeStorage(throwing, "k", "v")).toBe(false);
    expect(removeStorage(throwing, "k")).toBe(false);
    expect(readStorage(undefined, "k")).toBe(null);
    expect(writeStorage(null, "k", "v")).toBe(false);
  });

  it("webStorage: undefined without a document (server)", () => {
    expect(typeof document).toBe("undefined");
    expect(webStorage("local")).toBe(undefined);
    expect(webStorage("session")).toBe(undefined);
  });

  it("Resizable useDefaultLayout: a save into a throwing storage logs nothing and keeps the hook working", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail", storage: throwing });
    expect(defaultLayout()).toBe(undefined);
    expect(() => onLayoutChanged({ a: 30, b: 70 }, { isUserInteraction: true } as never)).not.toThrow();
    expect(error).not.toHaveBeenCalled();
  });

  it("Resizable useDefaultLayout: a working storage still persists the layout", () => {
    const s = Object.assign(memory(), { ssr: true });
    const { onLayoutChanged } = useDefaultLayout({ id: "mail", storage: s });
    onLayoutChanged({ a: 30, b: 70 }, { isUserInteraction: true } as never);
    expect([...s.data.values()]).toEqual([JSON.stringify({ a: 30, b: 70 })]);
  });
});
