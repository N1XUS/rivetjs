// Rivet port of input-otp 1.5.0 (MIT, © 2024 Guilherme Rodz): the document-reading helpers of `src/input.tsx` (style tag) and
// `src/use-pwm-badge.tsx` (badge space / probe). A `.ts` module: called only from client effects of `input-otp.tsx` (a `.tsx`
// module reading browser globals at module level fails the server build, RV2001). Licence + notice: `libs/ui/NOTICE`.
import { untrack } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";

function safeInsertRule(sheet: CSSStyleSheet, rule: string): void {
  try {
    sheet.insertRule(rule);
  } catch {
    // Some environments reject individual selectors (e.g. `:autofill` in older WebViews). Losing one of these cosmetic
    // rules never breaks the input, so it must not look like an application error.
    console.warn("input-otp could not insert CSS rule:", rule);
  }
}

/** Upstream: the `<style id="input-otp-style">` rules, once per document. */
export function injectStyles(nonce: string | undefined): void {
  if (document.getElementById("input-otp-style")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "input-otp-style";
  if (nonce) styleEl.setAttribute("nonce", nonce);
  document.head.appendChild(styleEl);
  if (!styleEl.sheet) return;
  const autofillStyles =
    "background: transparent !important; color: transparent !important; border-color: transparent !important; opacity: 0 !important; box-shadow: none !important; -webkit-box-shadow: none !important; -webkit-text-fill-color: transparent !important;";
  safeInsertRule(styleEl.sheet, "[data-input-otp]::selection { background: transparent !important; color: transparent !important; }");
  safeInsertRule(styleEl.sheet, `[data-input-otp]:autofill { ${autofillStyles} }`);
  safeInsertRule(styleEl.sheet, `[data-input-otp]:-webkit-autofill { ${autofillStyles} }`);
  // iOS
  safeInsertRule(
    styleEl.sheet,
    `@supports (-webkit-touch-callout: none) { [data-input-otp] { letter-spacing: -.6em !important; font-weight: 100 !important; font-stretch: ultra-condensed; font-optical-sizing: none !important; left: -1px !important; right: 1px !important; } }`,
  );
  // PWM badges
  safeInsertRule(styleEl.sheet, `[data-input-otp] + * { pointer-events: all !important; }`);
}

/* ---- password-manager badge (upstream `src/use-pwm-badge.tsx`) ---- */
const PWM_BADGE_MARGIN_RIGHT = 18;
export const PWM_BADGE_SPACE_WIDTH_PX = 40;
export const PWM_BADGE_SPACE_WIDTH = `${PWM_BADGE_SPACE_WIDTH_PX}px` as const;

/** Free space, in px, between the container's right edge and the content edge of the nearest box constraining horizontal
 *  overflow (viewport included): the push strategy grows the input past the container. */
export function availableBadgeSpace(container: HTMLElement): number {
  const containerRight = container.getBoundingClientRect().right;

  // Start at the container itself: overflow set via `containerClass` also clips the absolutely-positioned input inside it.
  let el: HTMLElement | null = container;
  while (el) {
    if (getComputedStyle(el).overflowX !== "visible") {
      const rect = el.getBoundingClientRect();
      return rect.left + el.clientLeft + el.clientWidth - containerRight;
    }
    el = el.parentElement;
  }

  // No constraining ancestor: the viewport is the limit (`clientWidth` excludes a vertical scrollbar).
  return document.documentElement.clientWidth - containerRight;
}

const PASSWORD_MANAGERS_SELECTORS = [
  "[data-lastpass-icon-root]", // LastPass
  "com-1password-button", // 1Password
  "[data-dashlanecreated]", // Dashlane
  '[style$="2147483647 !important;"]', // Bitwarden
].join(",");

export interface BadgeState {
  hasPWMBadge: Signal<boolean>;
  hasPWMBadgeSpace: Signal<boolean>;
  done: Signal<boolean>;
}

/** Upstream `trackPWMBadge`. */
export function trackPWMBadge(badge: BadgeState, container: HTMLElement | undefined, input: HTMLInputElement | undefined, strategy: string): void {
  if (!container || !input || untrack(badge.done) || strategy === "none") return;

  // The top right-center point of the container: where most password managers place their badge.
  const rightCornerX = container.getBoundingClientRect().left + container.offsetWidth;
  const centereredY = container.getBoundingClientRect().top + container.offsetHeight / 2;
  const x = rightCornerX - PWM_BADGE_MARGIN_RIGHT;
  const y = centereredY;

  // Known password managers first, else `elementFromPoint`.
  const pmws = document.querySelectorAll(PASSWORD_MANAGERS_SELECTORS);
  if (pmws.length === 0) {
    const maybeBadgeEl = document.elementFromPoint(x, y);
    // The container itself: most likely no badge.
    if (maybeBadgeEl === container) return;
  }

  // Re-measure before committing to the push (the interval copy can be up to a second stale).
  badge.hasPWMBadgeSpace.set(availableBadgeSpace(container) >= PWM_BADGE_SPACE_WIDTH_PX);
  badge.hasPWMBadge.set(true);
  badge.done.set(true);
}
