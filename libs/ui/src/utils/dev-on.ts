// Development build (`development` condition of the `#dev` import, package.json): dev-only warnings run. `DEV` = the dev hooks
// object (truthy; `dev-off.ts` explains why helpers go through it).
import type { DevHooks } from "./dev-off.ts";
import { warnItemsIgnored, warnShorthandIgnored } from "./shorthand.ts";

export const DEV: DevHooks | false = { shorthandIgnored: warnShorthandIgnored, itemsIgnored: warnItemsIgnored };
