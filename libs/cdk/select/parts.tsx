// RAC Select, parts form only (react-aria-components Select.tsx), Apache-2.0, © Adobe: `@rivetjs/cdk/select/parts`.
// Same component as `@rivetjs/cdk/select`'s `Select` given Label / Button / SelectValue / Popover / ListBox children
// (no `items` / shared `state`), without the preset's popover overlay, header and field helpers in the module graph,
// so a page that only uses the parts form (`@rivetjs/ui` Select / CellSelect / InlineSelect) does not prefetch them.
import { SelectParts, type SelectPartsProps } from "./select-parts.tsx";
import type { SelectionMode } from "../state/select.ts";

export { SelectValue, SelectContext, SelectStateContext, SelectValueContext, selectedText } from "./select-value.tsx";
export type { SelectValueProps, SelectValueRenderProps, SelectContextValue, ItemRenderProps } from "./select-value.tsx";
export type { SelectPartsProps, SelectPartsRenderProps } from "./select-parts.tsx";
export { createSelectState, setSelectValue, selectValue, selectedKeys, selectedItems, selectedItemsOf, openSelect, toggleSelect } from "../state/select.ts";
export type { SelectionMode, SelectState, ValueType, ChangeValueType } from "../state/select.ts";
export type { Key, Selection } from "../state/list.ts";
export { removeSelected, clearSelection, toggleSelected } from "./behaviour.tsx";

/** RAC Select (parts form): builds the collection from the ListBox in its children. */
export function Select<M extends SelectionMode = "single">(props: SelectPartsProps<M>) {
  return <SelectParts props={props} />;
}
