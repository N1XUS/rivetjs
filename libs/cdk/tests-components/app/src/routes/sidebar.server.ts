import type { RequestEvent } from "@rivetjs/router";
import { sidebarCookieOpen } from "@rivetjs/cdk/sidebar/state";
import { load } from "@rivetjs/router";

// SSR hook point of the persisted sidebar state: the `sidebar_state` cookie → `defaultOpen`.
export const loader = load(({ cookies }: RequestEvent) => ({ open: sidebarCookieOpen(cookies) ?? null }));
