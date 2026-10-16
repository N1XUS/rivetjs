// Type-level suite (`tsc -p libs/ui` only): `CellSelect` props (variant union, single / multiple value, Select parts props),
// parts; errors: bad variant, Popover without children.
import { signal } from "@rivetjs/reactivity";
import { CellSelect } from "../src/components/cell-select/index.ts";
import type { CellSelectProps } from "../src/components/cell-select/index.ts";

const props: CellSelect["Props"] = { variant: "secondary", defaultValue: "a", name: "n" };
const rootProps: CellSelectProps = props;
const many = signal<readonly (string | number)[]>([]);

export const ok = () => (
  <>
    <CellSelect {...rootProps} onChange={(k) => void k}>
      <CellSelect.Trigger class="t">
        <CellSelect.Label class="l">L</CellSelect.Label>
        <CellSelect.Value>{({ isPlaceholder }) => (isPlaceholder() ? "none" : "set")}</CellSelect.Value>
        <CellSelect.Indicator class="i" />
      </CellSelect.Trigger>
      <CellSelect.Popover placement="bottom start">
        <div />
      </CellSelect.Popover>
    </CellSelect>
    <CellSelect selectionMode="multiple" value={many} aria-label="Many">
      <CellSelect.Trigger>
        <CellSelect.Value />
      </CellSelect.Trigger>
    </CellSelect>
  </>
);

// @ts-expect-error unknown variant
export const badVariant = () => <CellSelect variant="ghost" />;
// @ts-expect-error Popover needs children
export const badPopover = () => <CellSelect.Popover />;
