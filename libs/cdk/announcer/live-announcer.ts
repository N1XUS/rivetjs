// Live announcer: screen reader announcements through assertive / polite `role="log"` live regions,
// each message its own node (removed after `timeout`), `aria-labelledby` messages, clear / destroy.
// Ported from @react-aria/live-announcer (react-spectrum), Apache-2.0, © Adobe.
//
// Deviation: the regions are created on the first `announce()` (no import-time globals). A
// server-rendered `<LiveAnnouncerRegions/>` (`@rivetjs/cdk/announcer`) is adopted when present, so
// even the first message is announced without the original's 100 ms creation delay.
// For the Angular-style single-message region (politeness default "polite"), see `announce` in
// `@rivetjs/cdk/a11y`.

export type Assertiveness = "assertive" | "polite";
type Message = string | { "aria-labelledby": string };

const LIVEREGION_TIMEOUT_DELAY = 7000;

class LiveAnnouncer {
  node: HTMLElement | null = null;
  assertiveLog: HTMLElement | null = null;
  politeLog: HTMLElement | null = null;
  adopted = false;

  constructor() {
    if (typeof document === "undefined") return;
    const existing = document.querySelector<HTMLElement>("[data-live-announcer]");
    if (existing) {
      this.node = existing;
      this.adopted = true;
      this.assertiveLog = existing.querySelector('[aria-live="assertive"]');
      this.politeLog = existing.querySelector('[aria-live="polite"]');
      return;
    }
    this.node = document.createElement("div");
    this.node.dataset.liveAnnouncer = "true";
    // VisuallyHidden.
    Object.assign(this.node.style, {
      border: "0",
      clip: "rect(0 0 0 0)",
      clipPath: "inset(50%)",
      height: "1px",
      margin: "-1px",
      overflow: "hidden",
      padding: "0",
      position: "absolute",
      width: "1px",
      whiteSpace: "nowrap",
    });
    this.assertiveLog = this.createLog("assertive");
    this.node.appendChild(this.assertiveLog);
    this.politeLog = this.createLog("polite");
    this.node.appendChild(this.politeLog);
    document.body.prepend(this.node);
  }

  isAttached(): boolean {
    return !!this.node?.isConnected;
  }

  createLog(ariaLive: string): HTMLElement {
    const node = document.createElement("div");
    node.setAttribute("role", "log");
    node.setAttribute("aria-live", ariaLive);
    node.setAttribute("aria-relevant", "additions");
    return node;
  }

  destroy(): void {
    if (!this.node) return;
    if (this.adopted) this.clear();
    else this.node.remove();
    this.node = null;
  }

  announce(message: Message, assertiveness: Assertiveness = "assertive", timeout = LIVEREGION_TIMEOUT_DELAY): void {
    if (!this.node) return;
    const node = document.createElement("div");
    if (typeof message === "object") {
      // aria-labelledby is read only with an appropriate role, such as img.
      node.setAttribute("role", "img");
      node.setAttribute("aria-labelledby", message["aria-labelledby"]);
    } else node.textContent = message;
    if (assertiveness === "assertive") this.assertiveLog?.appendChild(node);
    else this.politeLog?.appendChild(node);
    if (message !== "") setTimeout(() => node.remove(), timeout);
  }

  clear(assertiveness?: Assertiveness): void {
    if (!this.node) return;
    if ((!assertiveness || assertiveness === "assertive") && this.assertiveLog) this.assertiveLog.innerHTML = "";
    if ((!assertiveness || assertiveness === "polite") && this.politeLog) this.politeLog.innerHTML = "";
  }
}

let liveAnnouncer: LiveAnnouncer | null = null;
/** Test hook: announce synchronously on creation (the original checks for a jest / act environment). */
export const announcerOptions = { immediate: false };

/** Announce `message` with screen reader technology (assertive by default; removed after `timeout` ms). */
export function announce(message: Message, assertiveness: Assertiveness = "assertive", timeout: number = LIVEREGION_TIMEOUT_DELAY): void {
  if (!liveAnnouncer) {
    liveAnnouncer = new LiveAnnouncer();
    // Safari skips messages added right after the regions: wait 100 ms for created ones.
    if (!liveAnnouncer.adopted && !announcerOptions.immediate)
      setTimeout(() => {
        if (liveAnnouncer?.isAttached()) liveAnnouncer.announce(message, assertiveness, timeout);
      }, 100);
    else liveAnnouncer.announce(message, assertiveness, timeout);
  } else liveAnnouncer.announce(message, assertiveness, timeout);
}

/** Stop queued announcements (one politeness, or both when omitted). */
export function clearAnnouncer(assertiveness?: Assertiveness): void {
  liveAnnouncer?.clear(assertiveness);
}

/** Remove the announcer from the DOM. */
export function destroyAnnouncer(): void {
  if (liveAnnouncer) {
    liveAnnouncer.destroy();
    liveAnnouncer = null;
  }
}
