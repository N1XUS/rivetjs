// Type-level checks for `@rivetjs/ui/disclosure-group` (tsc only, not run).
import { signal } from "@rivetjs/reactivity";
import { DisclosureGroup, DisclosureGroupRoot, useDisclosureGroupNavigation } from "../src/components/disclosure-group/index.ts";
import type { DisclosureGroupProps, UseDisclosureGroupNavigationReturn } from "../src/components/disclosure-group/index.ts";

const keys = signal(new Set<string | number>(["a"]));
const nav: UseDisclosureGroupNavigationReturn = useDisclosureGroupNavigation({ expandedKeys: keys, itemIds: ["a"], onExpandedChange: (k) => keys.set(k) });
const _disabled: boolean = nav.isPrevDisabled();
void _disabled;

export const a = (
  <DisclosureGroup allowsMultipleExpanded expandedKeys={keys} isDisabled={false} class="x" onExpandedChange={(k) => k.size}>
    <span />
  </DisclosureGroup>
);
export const b = <DisclosureGroupRoot defaultExpandedKeys={["a"]} class={({ isDisabled }) => (isDisabled ? "x" : "y")} />;
export const c: DisclosureGroupProps = { expandedKeys: new Set(["a"]) };
// @ts-expect-error itemIds is required
useDisclosureGroupNavigation({ expandedKeys: keys, onExpandedChange: () => {} });
