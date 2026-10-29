// Rivet addition (no HeroUI v3.2.6 counterpart): highlighted code with a language label and a copy button; feature set
// scoped from public docs of commercial UI kits, independent implementation (see `code-block.tsx`).
import { CodeBlockCode, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockRoot } from "./code-block.tsx";
import type { CodeBlockCodeProps, CodeBlockCopyButtonProps, CodeBlockHeaderProps, CodeBlockLanguageProps, CodeBlockRootProps } from "./code-block.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const CodeBlock = Object.assign(CodeBlockRoot, {
  Root: CodeBlockRoot,
  Header: CodeBlockHeader,
  Language: CodeBlockLanguage,
  Code: CodeBlockCode,
  CopyButton: CodeBlockCopyButton,
});

export type CodeBlock = {
  Props: CodeBlockRootProps;
  RootProps: CodeBlockRootProps;
  HeaderProps: CodeBlockHeaderProps;
  LanguageProps: CodeBlockLanguageProps;
  CodeProps: CodeBlockCodeProps;
  CopyButtonProps: CodeBlockCopyButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { CodeBlockRoot, CodeBlockHeader, CodeBlockLanguage, CodeBlockCode, CodeBlockCopyButton } from "./code-block.tsx";
export type {
  CodeBlockRootProps,
  CodeBlockRootProps as CodeBlockProps,
  CodeBlockHeaderProps,
  CodeBlockLanguageProps,
  CodeBlockCodeProps,
  CodeBlockCopyButtonProps,
} from "./code-block.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { codeBlockVariants } from "../../../styles/src/components/code-block/index.ts";

export type { CodeBlockVariants } from "../../../styles/src/components/code-block/index.ts";
