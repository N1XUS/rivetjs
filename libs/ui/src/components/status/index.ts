// Rivet addition (no HeroUI v3.2.6 counterpart): status / presence / unread dot.
// `@rivetjs/ui/status`: `Status`, `StatusRoot`, prop types, `statusVariants`.
import { StatusRoot } from "./status.tsx";
import type { StatusRootProps } from "./status.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Status = Object.assign(StatusRoot, {
  Root: StatusRoot,
});

export type Status = {
  Props: StatusRootProps;
  RootProps: StatusRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { StatusRoot } from "./status.tsx";
export type { StatusRootProps, StatusRootProps as StatusProps } from "./status.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { statusVariants } from "../../../styles/src/components/status/index.ts";

export type { StatusVariants } from "../../../styles/src/components/status/index.ts";
