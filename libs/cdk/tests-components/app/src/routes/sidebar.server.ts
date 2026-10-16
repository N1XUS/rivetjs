import type { RequestEvent } from "@rivetjs/router";
import { sidebarCookieOpen } from "@rivetjs/cdk/sidebar/state";

// SSR hook point of the persisted sidebar state: the `sidebar_state` cookie → `defaultOpen`.
export const load = ({ cookies }: RequestEvent) => ({ open: sidebarCookieOpen(cookies) ?? null });
