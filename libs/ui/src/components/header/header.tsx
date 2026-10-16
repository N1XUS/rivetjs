// Ported from HeroUI v3.2.6 packages/react/src/components/header/header.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class` (string); `react-aria-components/Header` → `@rivetjs/cdk/header`; `@heroui/styles` → vendored `styles/`.
// Live props: `class` is read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Header`), so when one of them is a live
//   getter (`hasLiveProp`) the class goes in as a function (`renderClass`, bound by the cdk element); static props keep the string path.
import { Header as HeaderPrimitive } from "@rivetjs/cdk/header";
import type { HeaderProps as HeaderPrimitiveProps } from "@rivetjs/cdk/header";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { headerVariants } from "../../../styles/src/components/header/index.ts";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Header Root
 * -----------------------------------------------------------------------------------------------*/
interface HeaderRootProps extends HeaderPrimitiveProps {}

const HeaderRoot = (props: HeaderRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = (): string | ((values: never) => string) => headerVariants({ class: local.class });
  const cls = hasLiveProp(local, ["class"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <HeaderPrimitive class={cls as string} data-slot="header" {...rest}>
      {local.children}
    </HeaderPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { HeaderRoot };

export type { HeaderRootProps };
