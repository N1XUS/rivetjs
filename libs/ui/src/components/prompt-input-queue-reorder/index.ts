// Rivet addition (no HeroUI v3.2.6 counterpart): drag reordering for the `PromptInput` queue, API shape scoped from
// public docs of commercial UI kits (`values` / `onReorder` / `axis`), independent implementation (see
// `prompt-input-queue-reorder.tsx`). Own subpath, not on the `PromptInput` compound: a queue that does not reorder ships
// none of this code (zero-cost: a compound static, or a re-export from the `prompt-input` barrel, puts it in that chunk).
import { PromptInputQueueReorderItem, PromptInputQueueReorderList } from "./prompt-input-queue-reorder.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const PromptInputQueueReorder = {
  List: PromptInputQueueReorderList,
  Item: PromptInputQueueReorderItem,
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { PromptInputQueueReorderList, PromptInputQueueReorderItem } from "./prompt-input-queue-reorder.tsx";
export type { PromptInputQueueReorderListProps, PromptInputQueueReorderItemProps } from "./prompt-input-queue-reorder.tsx";
