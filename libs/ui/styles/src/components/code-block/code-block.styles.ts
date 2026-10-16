// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no code block). Feature set inspired by HeroUI Pro's
// public CodeBlock docs; independent implementation on HeroUI tokens.
import "../../../out/code-block.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const codeBlockVariants = tv({
  slots: {
    base: "code-block",
    code: "code-block__code",
    copiedIcon: "code-block__copied-icon",
    copyButton: "code-block__copy-button",
    copyIcon: "code-block__copy-icon",
    header: "code-block__header",
    language: "code-block__language",
    pre: "code-block__pre",
    token: "code-block__token",
  },
});

export type CodeBlockVariants = VariantProps<typeof codeBlockVariants>;
