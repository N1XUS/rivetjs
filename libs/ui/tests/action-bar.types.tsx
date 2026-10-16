// Type-level suite (`tsc -p libs/ui` only): `ActionBar` props (`isOpen` value / accessor, `aria-label`, `isAttached`,
// `orientation`, div attributes), parts + `class`, `ActionBar["…Props"]`; errors: missing `isOpen`, unknown orientation.
import { signal } from "@rivetjs/reactivity";

import { ActionBar } from "../src/components/action-bar/index.ts";

export const ok = () => {
  const count = signal(0);
  return (
    <ActionBar isOpen={() => count() > 0} aria-label="Bulk actions" isAttached={false} orientation="vertical" class="c" id="x">
      <ActionBar.Prefix class="p">{count()} selected</ActionBar.Prefix>
      <ActionBar.Content>a</ActionBar.Content>
      <ActionBar.Suffix>b</ActionBar.Suffix>
    </ActionBar>
  );
};

export const value = () => <ActionBar isOpen={true}>x</ActionBar>;

export const props: ActionBar["Props"] = { isOpen: false };
export const prefixProps: ActionBar["PrefixProps"] = { class: "p" };

// @ts-expect-error isOpen is required
export const missing = () => <ActionBar>x</ActionBar>;

// @ts-expect-error unknown orientation
export const badOrientation = () => <ActionBar isOpen orientation="diagonal" />;
