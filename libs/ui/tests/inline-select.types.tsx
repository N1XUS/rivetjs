// Type-level suite (`tsc -p libs/ui` only): `InlineSelect` props (single / multiple value, Select parts props), parts,
// `Breadcrumbs.Item` function child render props; errors: variant prop, Popover without children.
import { signal } from "@rivetjs/reactivity";
import { Breadcrumbs } from "../src/components/breadcrumbs/index.ts";
import { InlineSelect } from "../src/components/inline-select/index.ts";
import type { InlineSelectProps } from "../src/components/inline-select/index.ts";

const props: InlineSelect["Props"] = { defaultValue: "a", name: "n", "aria-label": "Team" };
const rootProps: InlineSelectProps = props;
const many = signal<readonly (string | number)[]>([]);

export const ok = () => (
  <>
    <InlineSelect {...rootProps} onChange={(k) => void k}>
      <InlineSelect.Trigger class="t">
        <InlineSelect.Value>{({ isPlaceholder }) => (isPlaceholder() ? "none" : "set")}</InlineSelect.Value>
        <InlineSelect.Indicator class="i" />
      </InlineSelect.Trigger>
      <InlineSelect.Popover placement="bottom start">
        <div />
      </InlineSelect.Popover>
    </InlineSelect>
    <InlineSelect selectionMode="multiple" value={many} aria-label="Many">
      <InlineSelect.Trigger>
        <InlineSelect.Value />
      </InlineSelect.Trigger>
    </InlineSelect>
    <Breadcrumbs>
      <Breadcrumbs.Item>{({ isCurrent, isDisabled, separator }) => (isCurrent() || isDisabled() ? null : separator())}</Breadcrumbs.Item>
    </Breadcrumbs>
  </>
);

// @ts-expect-error no variants
export const badVariant = () => <InlineSelect variant="secondary" />;
// @ts-expect-error Popover needs children
export const badPopover = () => <InlineSelect.Popover />;
