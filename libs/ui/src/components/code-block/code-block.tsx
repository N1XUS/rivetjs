// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no code block). Feature set inspired by commercial UI kits' public CodeBlock
// docs (parts `Header` / `Code` (`code`, `language` default "plaintext") / `CopyButton` (`code`, aria-label "Copy code",
// check icon after copying)); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Highlighting = `@rivetjs/cdk/highlight` (Rivet regex tokenizer, synchronous, identical on the server and in the
//   browser) instead of Shiki: no grammar / WASM download, no async flash. the commercial kit's `theme` prop is dropped: token
//   colours are CSS variables on HeroUI tokens, so light / dark follow the page theme.
// - `Code` takes `code` as a value or an accessor (streaming): the token spans re-render when it changes.
// - Rivet extra `CodeBlock.Language` (the header label, `languageLabel(language)` unless children are given).
// - `CopyButton` = ui Button (ghost, sm, icon-only), behaviour `../../utils/copy-feedback.tsx` (nothing before the press).
import { highlight, languageLabel } from "@rivetjs/cdk/highlight";
import { Icon } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Check, Copy } from "lucide";

import { codeBlockVariants } from "../../../styles/src/components/code-block/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { copyWithFeedback } from "../../utils/copy-feedback.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import type { ButtonRootProps } from "../button/button.tsx";

const SLOTS = codeBlockVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

const CodeBlockRoot = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.base, local.class)} data-slot="code-block" {...rest}>
      {local.children}
    </div>
  );
};

const CodeBlockHeader = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.header, local.class)} data-slot="code-block-header" {...rest}>
      {local.children}
    </div>
  );
};

interface CodeBlockLanguageProps extends Omit<JSX.IntrinsicElements["span"], "class" | "children"> {
  /** Language id; the label is its display name ("ts" → "TypeScript"). */
  language?: string;
  class?: string;
  children?: Content;
}

const CodeBlockLanguage = (props: CodeBlockLanguageProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "language"]);
  return (
    <span class={composeSlotClassName(SLOTS.language, local.class)} data-slot="code-block-language" {...rest}>
      {local.children ?? languageLabel(local.language)}
    </span>
  );
};

/** Token spans of `code` (a plain-text token stays a text node). */
const renderTokens = (code: string, language: string | undefined, tokenClass: string): JSX.Element[] =>
  highlight(code, language).map((token) =>
    token.type === "plain" ? (token.value as unknown as JSX.Element) : <span class={`${tokenClass} ${tokenClass}--${token.type}`}>{token.value}</span>,
  );

interface CodeBlockCodeProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children"> {
  /** Code to render (value or accessor). */
  code: string | (() => string);
  /** Language id or alias (`ts`, `tsx`, `json`, `css`, `html`, `bash`, `py`, `sql`, `yaml`, `diff`, `rust`, `go` …). @default "plaintext" */
  language?: string;
  /** Wrap long lines instead of scrolling horizontally. */
  wrap?: boolean;
  /** Accessible name of the scrollable region. @default the language label + " code" */
  "aria-label"?: string;
  class?: string;
}

const CodeBlockCode = (props: CodeBlockCodeProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "code", "language", "wrap", "aria-label"]);
  const language = local.language ?? "plaintext";
  const code = local.code;
  const tokenClass = SLOTS.token();
  return (
    <div
      class={composeSlotClassName(SLOTS.code, local.class)}
      data-slot="code-block-code"
      data-language={language}
      data-wrap={local.wrap ? "true" : undefined}
      role="region"
      tabIndex={0}
      aria-label={local["aria-label"] ?? `${languageLabel(language)} code`}
      {...rest}
    >
      <pre class={SLOTS.pre()}>
        <code>{typeof code === "function" ? () => renderTokens(code(), language, tokenClass) : renderTokens(code, language, tokenClass)}</code>
      </pre>
    </div>
  );
};

interface CodeBlockCopyButtonProps extends Omit<ButtonRootProps, "children" | "onPress"> {
  /** Code copied to the clipboard (value or accessor). */
  code: string | (() => string);
  /** @default "Copy code" */
  "aria-label"?: string;
  /** Accessible name while the check shows. @default "Copied" */
  copiedLabel?: string;
  onCopy?: (copied: boolean) => void;
}

const CodeBlockCopyButton = (props: CodeBlockCopyButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "code", "aria-label", "copiedLabel", "onCopy"]);
  const label = local["aria-label"] ?? "Copy code";
  const copiedLabel = local.copiedLabel ?? "Copied";
  const onCopy = local.onCopy;
  const code = local.code;
  return (
    <ButtonRoot
      variant="ghost"
      size="sm"
      isIconOnly
      class={composeSlotClassName(SLOTS.copyButton, typeof local.class === "string" ? local.class : undefined)}
      aria-label={label}
      data-slot="code-block-copy-button"
      data-copy-button=""
      onPress={(event: { target: EventTarget | null }) =>
        copyWithFeedback(event.target, typeof code === "function" ? code() : code, { label, copiedLabel }, onCopy)
      }
      {...rest}
    >
      <Icon icon={Copy} size={14} class={SLOTS.copyIcon()} aria-hidden="true" />
      <Icon icon={Check} size={14} class={SLOTS.copiedIcon()} aria-hidden="true" />
    </ButtonRoot>
  );
};

export { CodeBlockRoot, CodeBlockHeader, CodeBlockLanguage, CodeBlockCode, CodeBlockCopyButton };
export type { DivProps as CodeBlockRootProps, DivProps as CodeBlockHeaderProps, CodeBlockLanguageProps, CodeBlockCodeProps, CodeBlockCopyButtonProps };
