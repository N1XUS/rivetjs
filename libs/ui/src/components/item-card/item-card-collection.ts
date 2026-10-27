// Rivet addition (SHOWCASE-1 2026-10-27): the light link between `ItemCard` and the interactive `ItemCardGroupCollection`
// (cdk GridList), so a static card / group never imports the GridList (measured: +41 KB gz on the item-card(-group)
// frames with a Switch inside when ItemCard imported the row form directly).
// - `ItemCardCollectionContext` `{ inCollection: true }` (plain data) is provided by `ItemCardGroupCollection`; an
//   `ItemCard` reading it renders the row form.
// - `ITEM_CARD_ROW.Row` = the row form (`item-card-row.tsx`, a cdk `GridListItem`), set by `ItemCardGroupCollection`'s
//   body before its rows render (server and browser), so only a page with a collection group loads it.
import { createContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

interface ItemCardCollectionContextValue {
  inCollection?: boolean;
}

const ItemCardCollectionContext = createContext<ItemCardCollectionContextValue>({});

/** The row form of `ItemCard`, registered by `ItemCardGroupCollection`. */
const ITEM_CARD_ROW: { Row?: (props: any) => JSX.Element } = {};

export { ItemCardCollectionContext, ITEM_CARD_ROW };
export type { ItemCardCollectionContextValue };
