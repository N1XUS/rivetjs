// The site frame's idle effect in a leaf module: a resume chunk evaluates the module its symbol comes from, and
// inside SiteFrame.tsx that pulled the nav data, SideNav, MobileMenu, ThemeMenu… (~88 KB br at idle on every page).
import { clientEffect } from "@rivetjs/runtime/dom";
import { watchCode } from "./highlight-browser.ts";

/** At idle, start colouring visible code blocks (shared lazy highlighter chunk). */
export function watchCodeAtIdle(): void {
  clientEffect(() => watchCode(), { when: "idle" });
}
