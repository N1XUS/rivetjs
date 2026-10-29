// Rivet addition (no HeroUI v3.2.6 counterpart): token input for `PromptInput` (mentions / commands / tags), feature set
// inspired by the "Token Input" section of commercial UI kits' public PromptInput docs, independent implementation (see
// `prompt-input-tokens.tsx`). Own subpath, not on the `PromptInput` compound: a composer without tokens ships none of
// this code (zero-cost: a compound static, or a re-export from the `prompt-input` barrel, puts it in that chunk).
export {
  usePromptInputTokens,
  PromptInputTokenInput,
  PromptInputTokens,
  PromptInputTokenSuggestions,
  PromptInputTokenSuggestion,
  PromptInputToken,
} from "./prompt-input-tokens.tsx";
export type {
  PromptInputTokensOptions,
  PromptInputTokensState,
  PromptInputTokensProps,
  PromptInputTokenInputProps,
  PromptInputTokenSuggestionsProps,
  PromptInputTokenSuggestionProps,
  PromptInputTokenProps,
  PromptTokenAnchor,
  PromptTokenPlacement,
} from "./prompt-input-tokens.tsx";
export type { PromptSegment, PromptTextSegment, PromptTokenSegment, PromptTokenValue } from "@rivetjs/cdk/chat";
