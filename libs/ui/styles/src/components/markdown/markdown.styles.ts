// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no markdown renderer). Feature set inspired by
// HeroUI Pro's public Markdown docs; independent implementation on HeroUI tokens.
// Rivet: the stylesheets of the classes these slots compose (TWEAKS.md TW-122), in components/index.css order.
import "../../../out/code-block.css";
import "../../../out/markdown.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const markdownVariants = tv({
  slots: {
    base: "markdown",
    blockquote: "markdown__blockquote",
    caret: "markdown__caret",
    codeBlock: "markdown__code-block",
    del: "markdown__del",
    em: "markdown__em",
    heading: "markdown__heading",
    hr: "markdown__hr",
    image: "markdown__image",
    inlineCode: "markdown__inline-code",
    link: "markdown__link",
    list: "markdown__list",
    listItem: "markdown__list-item",
    live: "markdown__live",
    paragraph: "markdown__paragraph",
    strong: "markdown__strong",
    table: "markdown__table",
    tableWrapper: "markdown__table-wrapper",
    tail: "markdown__tail",
    taskCheckbox: "markdown__task-checkbox",
    word: "markdown__word",
  },
});

export type MarkdownVariants = VariantProps<typeof markdownVariants>;
