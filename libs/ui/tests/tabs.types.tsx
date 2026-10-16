// Type-level checks for `@rivetjs/ui/tabs` (tsc only, not run).
import { signal } from "@rivetjs/reactivity";
import { Tabs, TabsRoot } from "../src/components/tabs/index.ts";
import type { TabsProps } from "../src/components/tabs/index.ts";

const selected = signal<string | number | null>("a");

export const a = (
  <Tabs selectedKey={selected} variant="secondary" align="start" orientation="vertical" class="x" onSelectionChange={(k) => String(k)}>
    <Tabs.ListContainer class="c">
      <Tabs.List aria-label="Options" class={({ orientation }) => orientation()}>
        <Tabs.Tab id="a" class={({ isSelected }) => (isSelected() ? "s" : "")}>
          <Tabs.Separator class="sep" />A
          <Tabs.Indicator class="i" />
        </Tabs.Tab>
        <Tabs.Tab id="b" isDisabled href="/b" render={(props: Record<string, any>) => <a {...props} />}>
          B
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.ListContainer>
    <Tabs.Panel id="a" class="p">
      {() => "A"}
    </Tabs.Panel>
  </Tabs>
);
export const b = <TabsRoot defaultSelectedKey="a" render={(props: Record<string, any>) => <div {...props} data-custom="foo" />} />;
export const c: TabsProps = { variant: "primary" };
// @ts-expect-error unknown variant
export const d = <Tabs variant="loud" />;
// @ts-expect-error unknown align
export const e = <Tabs align="middle" />;
