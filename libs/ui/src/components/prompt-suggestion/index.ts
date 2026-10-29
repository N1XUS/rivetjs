// Rivet addition (no HeroUI v3.2.6 counterpart): suggested prompts for empty chats; feature set inspired by commercial UI kits'
// public PromptSuggestion docs, independent implementation (see `prompt-suggestion.tsx`).
import {
  PromptSuggestionDescription,
  PromptSuggestionHeader,
  PromptSuggestionItem,
  PromptSuggestionItemDescription,
  PromptSuggestionItemFooter,
  PromptSuggestionItemMeta,
  PromptSuggestionItemTags,
  PromptSuggestionItemTitle,
  PromptSuggestionItems,
  PromptSuggestionRoot,
  PromptSuggestionTitle,
} from "./prompt-suggestion.tsx";
import type { PromptSuggestionItemProps, PromptSuggestionPartProps, PromptSuggestionRootProps } from "./prompt-suggestion.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const PromptSuggestion = Object.assign(PromptSuggestionRoot, {
  Root: PromptSuggestionRoot,
  Header: PromptSuggestionHeader,
  Title: PromptSuggestionTitle,
  Description: PromptSuggestionDescription,
  Items: PromptSuggestionItems,
  Item: PromptSuggestionItem,
  ItemTitle: PromptSuggestionItemTitle,
  ItemDescription: PromptSuggestionItemDescription,
  ItemMeta: PromptSuggestionItemMeta,
  ItemTags: PromptSuggestionItemTags,
  ItemFooter: PromptSuggestionItemFooter,
});

export type PromptSuggestion = {
  Props: PromptSuggestionRootProps;
  RootProps: PromptSuggestionRootProps;
  ItemProps: PromptSuggestionItemProps;
  PartProps: PromptSuggestionPartProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  PromptSuggestionContext,
  PromptSuggestionRoot,
  PromptSuggestionHeader,
  PromptSuggestionTitle,
  PromptSuggestionDescription,
  PromptSuggestionItems,
  PromptSuggestionItem,
  PromptSuggestionItemTitle,
  PromptSuggestionItemDescription,
  PromptSuggestionItemMeta,
  PromptSuggestionItemTags,
  PromptSuggestionItemFooter,
} from "./prompt-suggestion.tsx";
export type {
  PromptSuggestionRootProps,
  PromptSuggestionRootProps as PromptSuggestionProps,
  PromptSuggestionItemProps,
  PromptSuggestionPartProps,
} from "./prompt-suggestion.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { promptSuggestionVariants } from "../../../styles/src/components/prompt-suggestion/index.ts";

export type { PromptSuggestionVariants } from "../../../styles/src/components/prompt-suggestion/index.ts";
