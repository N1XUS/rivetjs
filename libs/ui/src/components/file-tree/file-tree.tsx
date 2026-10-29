// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no file tree). Feature set inspired by HeroUI Pro's public File Tree
// docs (a hierarchical file / folder tree on Tree: sizes sm / md / lg, guide lines always / on hover / off, item icons,
// custom expand indicator, single / multiple selection with checkboxes, dynamic collections; classes `.file-tree*`);
// independent implementation, Rivet-authored styles.
// - Root = cdk `Tree`; `size` → `.file-tree--{sm,md,lg}`, `showGuideLines` (true | false | "hover") → `data-guide-lines`
//   ("always" | "none" | "hover"); guide lines are CSS only (a repeating gradient over the indent, `--tree-item-level`).
//   `reduceMotion` → `data-reduce-motion="true"`: no chevron turn / row colour transitions, whatever the OS setting
//   (`prefers-reduced-motion` already turns them off).
// - `Item` = cdk `TreeItem` + `TreeItemContent`: indent, expand button (`Button slot="chevron"`, lucide `ChevronRight`
//   rotated by `[data-expanded]` CSS, or `indicator`), selection checkbox (ui `Checkbox slot="selection"` when selection
//   is on with `selectionBehavior` "toggle"), `icon`, `title`; nested `FileTree.Item`s / a `Collection` go in `children`.
//   `textValue` defaults to `title` when it is a string.
// - Drag and drop: `dragAndDropHooks` (cdk Tree DnD; `useFileTreeDrag` in `use-file-tree-drag.tsx` builds them over a
//   `createTreeData` manager). Draggable rows get a leading drag handle (`Button slot="drag"`, lucide `GripVertical` or
//   `dragIcon`; shown on row hover / focus via CSS; `dragIcon={false}` keeps it visually hidden for keyboard drags);
//   `[data-dragging]` / `[data-drop-target]` styles in CSS.
// - Not yet: sections (cdk `TreeSection` server render pending).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import { Tree as TreePrimitive, TreeItem as TreeItemPrimitive, TreeItemContent } from "@rivetjs/cdk/tree";
import type { TreeItemContentRenderProps, TreeItemProps as TreeItemPrimitiveProps, TreeProps as TreePrimitiveProps, TreeRenderProps } from "@rivetjs/cdk/tree";
import { Icon } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronRight, GripVertical } from "lucide";

import type { FileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";
import { fileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { CheckboxRoot } from "../checkbox/checkbox.tsx";

const SLOTS = fileTreeVariants();

/* -------------------------------------------------------------------------------------------------
 * FileTree Root
 * -----------------------------------------------------------------------------------------------*/
interface FileTreeRootProps<T extends object = object> extends TreePrimitiveProps<T>, FileTreeVariants {
  /** Vertical guide lines per nesting level: always, only while the tree is hovered / focused, or never. @default true */
  showGuideLines?: boolean | "hover";
  /** Turn off the tree's transitions (chevron turn, row hover / selection colour) regardless of `prefers-reduced-motion`. @default false */
  reduceMotion?: boolean;
}

function FileTreeRoot<T extends object>(props: FileTreeRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "size", "showGuideLines", "reduceMotion"]);
  const size = local.size ?? "md";
  const guides = local.showGuideLines === "hover" ? "hover" : local.showGuideLines === false ? "none" : "always";
  const cls = composeTwRenderProps(local.class as never, fileTreeVariants({ size }).base()) as string | ((values: TreeRenderProps) => string);
  return (
    <TreePrimitive
      data-slot="file-tree"
      data-size={size}
      data-guide-lines={guides}
      data-reduce-motion={local.reduceMotion ? "true" : undefined}
      {...(rest as object)}
      class={cls as never}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * FileTree Item
 * -----------------------------------------------------------------------------------------------*/
type FileTreeItemProps<T extends object = object> = Omit<TreeItemPrimitiveProps<T>, "textValue" | "children"> & {
  /** Row label. */
  title?: Content;
  /** Typeahead / accessible text. @default `title` when it is a string */
  textValue?: string;
  /** Leading icon (e.g. lucide `Folder` / `File`); a function gets the row's render props (accessors). */
  icon?: Content | ((values: TreeItemContentRenderProps) => Content);
  /** Expand button content in place of the rotating chevron; a function gets the row's render props. */
  indicator?: Content | ((values: TreeItemContentRenderProps) => Content);
  /** Drag handle content while the tree allows dragging (`dragAndDropHooks`); `false` hides it visually (keyboard drags
   * still start from it). @default lucide `GripVertical` */
  dragIcon?: Content | false;
  /** Nested `FileTree.Item`s or a `Collection` of them. */
  children?: Content;
};

function FileTreeItem<T extends object>(props: FileTreeItemProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "title", "textValue", "icon", "indicator", "dragIcon", "children"]);
  const title = local.title;
  const icon = local.icon;
  const indicator = local.indicator;
  const dragIcon = local.dragIcon;
  const textValue = local.textValue ?? (typeof title === "string" ? title : "");
  const cls = composeTwRenderProps(local.class as never, SLOTS.item()) as string;
  return (
    <TreeItemPrimitive data-slot="file-tree-item" {...(rest as object)} textValue={textValue} class={cls as never}>
      <TreeItemContent>
        {(values: TreeItemContentRenderProps) => (
          <div class={SLOTS.content()} data-slot="file-tree-item-content">
            {values.allowsDragging() ? (
              <ButtonPrimitive slot="drag" class={SLOTS.dragHandle()} data-slot="file-tree-drag-handle" data-hidden={dragIcon === false ? "true" : undefined}>
                {dragIcon == null || dragIcon === false ? <Icon icon={GripVertical} size={14} /> : dragIcon}
              </ButtonPrimitive>
            ) : null}
            <span class={SLOTS.indent()} aria-hidden="true" data-slot="file-tree-indent" />
            {values.hasChildItems() ? (
              <ButtonPrimitive slot="chevron" class={SLOTS.indicator()} data-slot="file-tree-indicator">
                {indicator == null ? (
                  <Icon icon={ChevronRight} size={14} class={SLOTS.indicatorIcon()} />
                ) : typeof indicator === "function" ? (
                  (indicator as (values: TreeItemContentRenderProps) => Content)(values)
                ) : (
                  indicator
                )}
              </ButtonPrimitive>
            ) : (
              <span class={SLOTS.indicator()} aria-hidden="true" data-slot="file-tree-indicator-spacer" />
            )}
            {values.selectionMode() !== "none" && values.selectionBehavior() === "toggle" ? (
              <span class={SLOTS.selectionCell()} data-slot="file-tree-selection-cell">
                <CheckboxRoot slot="selection" />
              </span>
            ) : null}
            {icon == null ? null : (
              <span class={SLOTS.icon()} data-slot="file-tree-icon">
                {typeof icon === "function" ? (icon as (values: TreeItemContentRenderProps) => Content)(values) : icon}
              </span>
            )}
            <span class={SLOTS.title()} data-slot="file-tree-title">
              {title}
            </span>
          </div>
        )}
      </TreeItemContent>
      {local.children}
    </TreeItemPrimitive>
  );
}

export { FileTreeRoot, FileTreeItem };
export type { FileTreeRootProps, FileTreeItemProps };
