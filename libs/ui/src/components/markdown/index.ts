// Rivet addition (no HeroUI v3.2.6 counterpart): safe, streaming-friendly Markdown for AI responses; feature set inspired
// by commercial UI kits' public Markdown docs, independent implementation (see `markdown.tsx`).
import { MarkdownRoot } from "./markdown.tsx";
import type { MarkdownProps } from "./markdown.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Markdown = Object.assign(MarkdownRoot, { Root: MarkdownRoot });

export type Markdown = {
  Props: MarkdownProps;
  RootProps: MarkdownProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { MarkdownRoot } from "./markdown.tsx";
export type { MarkdownProps, MarkdownProps as MarkdownRootProps, MarkdownComponents, MarkdownElementProps } from "./markdown.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { markdownVariants } from "../../../styles/src/components/markdown/index.ts";

export type { MarkdownVariants } from "../../../styles/src/components/markdown/index.ts";
