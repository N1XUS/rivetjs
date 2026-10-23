// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no item morph). iOS context-menu style preview of a list item: press
// and hold a ListBox / GridList / Menu item (or right click, Shift+F10, …: `trigger`) and it lifts out of the list into a panel
// (preview, settings, actions) over a dimmed page, then morphs back into the row. Rivet-authored styles on HeroUI tokens.
// - Behaviour + motion = `@rivetjs/cdk/morph/item` (`createItemMorph`, `itemMorphProps`, `ItemMorphPanel`; house motion on
//   `@rivetjs/cdk/morph` `morphRectTo`). One morph per list: `useItemMorph(options)` in the list's component, `{...itemMorphProps(m)}`
//   on each item, one `<ItemMorph morph={m}>{(key) => …}</ItemMorph>` (render function: nothing renders or loads until a trigger).
// - `ItemMorph.Close`: a ui Button that morphs the panel back (then runs its own `onPress`); `useItemMorphPanel()` inside the panel
//   returns `{ morph, key, close }`.
import { ItemMorphPanel, closeItemMorph, createItemMorph } from "@rivetjs/cdk/morph/item";
import type { ItemMorph, ItemMorphOptions } from "@rivetjs/cdk/morph/item";
import type { Key } from "@rivetjs/cdk/listbox";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemMorphVariants } from "../../../styles/src/components/item-morph/index.ts";
import { itemMorphVariants } from "../../../styles/src/components/item-morph/index.ts";
import { ButtonRoot } from "../button/index.ts";
import type { ButtonRootProps } from "../button/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * ItemMorph Context (inside the panel)
 * -----------------------------------------------------------------------------------------------*/
interface ItemMorphContext {
  morph?: ItemMorph;
  backdrop?: ItemMorphVariants["backdrop"];
}

const ItemMorphContext = createContext<ItemMorphContext>({});

type ItemMorphSlots = ReturnType<typeof itemMorphVariants>;
const SLOTS: Record<string, ItemMorphSlots> = {};
const slotsFor = (backdrop: ItemMorphVariants["backdrop"] = "blur"): ItemMorphSlots => (SLOTS[backdrop] ??= itemMorphVariants({ backdrop }));

/* -------------------------------------------------------------------------------------------------
 * useItemMorph
 * -----------------------------------------------------------------------------------------------*/
/** The morph shared by a list's items (cdk `createItemMorph`): spread `itemMorphProps(morph)` on each item. */
function useItemMorph(options?: ItemMorphOptions): ItemMorph {
  return createItemMorph(options);
}

/* -------------------------------------------------------------------------------------------------
 * ItemMorph Root (the panel)
 * -----------------------------------------------------------------------------------------------*/
interface ItemMorphRootProps extends ItemMorphVariants {
  /** The list's morph (`useItemMorph`). */
  morph: ItemMorph;
  /** Accessible name of the panel (default: named by the item that opened it). */
  "aria-label"?: string;
  /** Classes of the morphing surface. */
  class?: string;
  /** Classes of the panel content box (set its width here, e.g. `w-80`). */
  panelClass?: string;
  /** No backdrop. */
  hideBackdrop?: boolean;
  /** The panel content for the item that opened it (`key()` = its collection key). */
  children: (key: () => Key | null) => Content;
}

const ItemMorphRoot = (props: ItemMorphRootProps): JSX.Element => {
  portalTheme();
  const morph = props.morph;
  const backdrop = props.backdrop ?? "blur";
  const slots = slotsFor(backdrop);
  const children = props.children;
  const value: ItemMorphContext = { morph, backdrop };
  return (
    <ItemMorphPanel
      morph={morph}
      aria-label={props["aria-label"]}
      class={slots.base({ class: props.class })}
      panelClass={slots.panel({ class: props.panelClass })}
      backdropClass={slots.backdrop()}
      hideBackdrop={props.hideBackdrop}
    >
      {(key: () => Key | null) => (
        <Provider token={ItemMorphContext} value={value}>
          {children(key)}
        </Provider>
      )}
    </ItemMorphPanel>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Close
 * -----------------------------------------------------------------------------------------------*/
type ItemMorphCloseProps = ButtonRootProps;

/** A ui Button inside the panel that morphs it back into the row (then runs its own `onPress`). */
const ItemMorphClose = (props: ItemMorphCloseProps): JSX.Element => {
  const context = useContext(ItemMorphContext);
  const morph = context.morph;
  const [local, rest] = splitLive(props, ["onPress", "class"]);
  const onPress = local.onPress;
  return (
    <ButtonRoot
      data-slot="item-morph-close"
      class={composeSlotClassName(slotsFor(context.backdrop).close, local.class as string | undefined) as never}
      {...(rest as object)}
      onPress={(e) => {
        if (morph) closeItemMorph(morph);
        onPress?.(e);
      }}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * useItemMorphPanel
 * -----------------------------------------------------------------------------------------------*/
interface UseItemMorphPanelReturn {
  morph: ItemMorph | undefined;
  /** The key of the item the panel shows (tracked). */
  key: () => Key | null;
  /** Morphs the panel back into its row. */
  close: () => void;
}

/** Inside an `ItemMorph` panel: its morph, the item key and `close()`. */
function useItemMorphPanel(): UseItemMorphPanelReturn {
  const morph = useContext(ItemMorphContext).morph;
  return {
    morph,
    key: () => (morph ? morph.key() : null),
    close: () => {
      if (morph) closeItemMorph(morph);
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ItemMorphRoot, ItemMorphClose, ItemMorphContext, useItemMorph, useItemMorphPanel };
export type { ItemMorphRootProps, ItemMorphCloseProps, UseItemMorphPanelReturn };
