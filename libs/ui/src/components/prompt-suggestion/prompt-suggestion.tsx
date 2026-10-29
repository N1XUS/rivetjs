// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no prompt suggestion). Feature set inspired by commercial UI kits' public
// PromptSuggestion docs (header Title / Description, Items, Item as a button with ItemTitle / ItemDescription / ItemMeta /
// ItemTags / ItemFooter slots, a card layout for richer starters); independent implementation, Rivet-authored styles.
// - `variant` `"pill"` (default: a wrapping row of pills) / `"card"` (a responsive grid of cards). `Item` = cdk Button
//   (press, hover / focus-visible data attributes, `isDisabled`); `onPress` sends the prompt (inline arrow).
// - Pure markup + the button's own handlers: nothing runs at load.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps } from "@rivetjs/cdk/button";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { PromptSuggestionVariants } from "../../../styles/src/components/prompt-suggestion/index.ts";
import { promptSuggestionVariants } from "../../../styles/src/components/prompt-suggestion/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

type PromptSuggestionVariant = NonNullable<PromptSuggestionVariants["variant"]>;

const PromptSuggestionContext = createContext<{ variant?: PromptSuggestionVariant }>({});

const SLOTS: Partial<Record<PromptSuggestionVariant, ReturnType<typeof promptSuggestionVariants>>> = {};
const slotsFor = (variant: PromptSuggestionVariant = "pill") => (SLOTS[variant] ??= promptSuggestionVariants({ variant }));

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

interface PromptSuggestionRootProps extends DivProps, PromptSuggestionVariants {}

const PromptSuggestionRoot = (props: PromptSuggestionRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "variant"]);
  const variant = local.variant ?? "pill";
  const content = () => (
    <div class={slotsFor(variant).base({ class: local.class })} data-slot="prompt-suggestion" data-variant={variant} {...rest}>
      {local.children}
    </div>
  );
  return (
    <Provider token={PromptSuggestionContext} value={{ variant }}>
      {content()}
    </Provider>
  );
};

type Slot = "header" | "title" | "description" | "items" | "itemTitle" | "itemDescription" | "itemMeta" | "itemTags" | "itemFooter";

const part = (slot: Slot, dataSlot: string, tag: "div" | "span" | "p" | "h2" = "div") =>
  function PromptSuggestionPart(props: DivProps): JSX.Element {
    const [local, rest] = splitLive(props, ["children", "class"]);
    const cls = composeSlotClassName(slotsFor(useContext(PromptSuggestionContext).variant)[slot], local.class);
    if (tag === "h2")
      return (
        <h2 class={cls} data-slot={dataSlot} {...(rest as {})}>
          {local.children}
        </h2>
      );
    if (tag === "p")
      return (
        <p class={cls} data-slot={dataSlot} {...(rest as {})}>
          {local.children}
        </p>
      );
    if (tag === "span")
      return (
        <span class={cls} data-slot={dataSlot} {...(rest as {})}>
          {local.children}
        </span>
      );
    return (
      <div class={cls} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const PromptSuggestionHeader = part("header", "prompt-suggestion-header");
const PromptSuggestionTitle = part("title", "prompt-suggestion-title", "h2");
const PromptSuggestionDescription = part("description", "prompt-suggestion-description", "p");
const PromptSuggestionItems = part("items", "prompt-suggestion-items");
const PromptSuggestionItemTitle = part("itemTitle", "prompt-suggestion-item-title", "span");
const PromptSuggestionItemDescription = part("itemDescription", "prompt-suggestion-item-description", "span");
const PromptSuggestionItemMeta = part("itemMeta", "prompt-suggestion-item-meta", "span");
const PromptSuggestionItemTags = part("itemTags", "prompt-suggestion-item-tags", "span");
const PromptSuggestionItemFooter = part("itemFooter", "prompt-suggestion-item-footer", "span");

interface PromptSuggestionItemProps extends Omit<ButtonPrimitiveProps, "class"> {
  class?: string;
}

const PromptSuggestionItem = (props: PromptSuggestionItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const cls = composeSlotClassName(slotsFor(useContext(PromptSuggestionContext).variant).item, local.class) ?? "";
  return (
    <ButtonPrimitive class={cls} data-slot="prompt-suggestion-item" {...rest}>
      {local.children}
    </ButtonPrimitive>
  );
};

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
};
export type { PromptSuggestionRootProps, PromptSuggestionItemProps, DivProps as PromptSuggestionPartProps };
