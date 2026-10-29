// Rivet addition (no HeroUI v3.2.6 counterpart): file / folder tree on `@rivetjs/cdk/tree`; feature set inspired by HeroUI
// Pro's public File Tree docs, independent implementation (see `file-tree.tsx`).
import { FileTreeHeader, FileTreeItem, FileTreeRoot, FileTreeSection } from "./file-tree.tsx";
import type { FileTreeHeaderProps, FileTreeItemProps, FileTreeRootProps, FileTreeSectionProps } from "./file-tree.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const FileTree = Object.assign(FileTreeRoot, {
  Root: FileTreeRoot,
  Item: FileTreeItem,
  Section: FileTreeSection,
  Header: FileTreeHeader,
});

export type FileTree = {
  Props: FileTreeRootProps;
  RootProps: FileTreeRootProps;
  ItemProps: FileTreeItemProps;
  SectionProps: FileTreeSectionProps;
  HeaderProps: FileTreeHeaderProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FileTreeRoot, FileTreeItem, FileTreeSection, FileTreeHeader } from "./file-tree.tsx";
export type { FileTreeRootProps, FileTreeRootProps as FileTreeProps, FileTreeItemProps, FileTreeSectionProps, FileTreeHeaderProps } from "./file-tree.tsx";
export { useFileTreeDrag } from "./use-file-tree-drag.tsx";
export type { UseFileTreeDragOptions, UseFileTreeDragResult } from "./use-file-tree-drag.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { fileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";

export type { FileTreeVariants } from "../../../styles/src/components/file-tree/index.ts";
