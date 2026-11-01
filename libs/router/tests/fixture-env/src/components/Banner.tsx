import { env } from "../lib/config.ts";

// A component reaching `@rivetjs/router/env`: RV3011 for every client-navigated page rendering it.
export function Banner() {
  return <p class="banner">{String(env.SITE_NAME)}</p>;
}
