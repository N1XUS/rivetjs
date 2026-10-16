// The tab's DevTools session: names the pop-out BroadcastChannel and survives reloads (sessionStorage).
// A duplicated tab, or a page opened by `window.open` without `noopener`, starts with a copy of
// sessionStorage — the same session — so both agents would answer one pop-out panel (trees interleave,
// edits land on the wrong tab). Agents claim their session on a shared channel; a holder answers a
// newcomer's claim with `taken`, and the newcomer regenerates its session. The pop-out channel opens
// only after the claim had `CLAIM_WAIT` ms to be answered.
import { CLAIMS } from "../protocol.ts";

export const CLAIM_WAIT = 100;
export const newId = (): string => Math.random().toString(36).slice(2, 10);

type Claim = { claim: string; instance: string } | { taken: string; instance: string };

export interface SessionOptions {
  /** The session stored by an earlier load of this tab (or copied into a duplicate), if any. */
  stored: string | null;
  save(id: string): void;
  /** Open (or reopen, after a late collision) the pop-out channel for `id`. */
  listen(id: string): void;
  wait?: number;
}

export function claimSession(options: SessionOptions): { readonly id: string; close(): void } {
  const instance = newId();
  let id = options.stored ?? newId(),
    settled = false;
  options.save(id);
  const claims = new BroadcastChannel(CLAIMS);
  claims.onmessage = (event: MessageEvent) => {
    const data = event.data as Claim;
    if (!data || typeof data !== "object" || data.instance === undefined) return;
    if ("claim" in data) {
      // Another agent claims our session: it is the newcomer (a duplicate); tell it.
      if (data.claim === id && data.instance !== instance) claims.postMessage({ taken: id, instance: data.instance } satisfies Claim);
    } else if (data.taken === id && data.instance === instance) {
      id = newId();
      options.save(id);
      if (settled) options.listen(id);
    }
  };
  claims.postMessage({ claim: id, instance } satisfies Claim);
  const timer = setTimeout(() => {
    settled = true;
    options.listen(id);
  }, options.wait ?? CLAIM_WAIT);
  return {
    get id() {
      return id;
    },
    close() {
      clearTimeout(timer);
      claims.close();
    },
  };
}
