// Rivet addition (no HeroUI v3.2.6 counterpart): file / folder tree on `@rivetjs/cdk/tree`; feature set inspired by HeroUI
// Pro's public File Tree docs, independent implementation (see `file-tree.tsx`).
import { FileTreeItem, FileTreeRoot } from "./file-tree.tsx";
import type { FileTreeItemProps, FileTreeRootProps } from "./file-tree.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const FileTree = Object.assign(FileTreeRoot, {
  Root: FileTreeRoot,
  Item: FileTreeItem,
});

export type FileTree = {
  Props: FileTreeRootProps;
  RootProps: FileTreeRootProps;
  ItemProps: FileTreeItemProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FileTreeRoot, FileTreeItem } from "./file-tree.tsx";
export type { FileTreeRootProps, FileTreeRootProps as FileTreeProps, FileTreeItemProps } from "./file-tree.tsx";
export { useFileTreeDrag } from "./use-file-tree-drag.tsx";
export type { UseFileTreeDragOptions, UseFileTreeDragResult } from "./use-file-tree-drag.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { fileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";

export type { FileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";
