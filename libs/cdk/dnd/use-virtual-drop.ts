// Ported from react-spectrum (packages/react-aria/src/dnd/useVirtualDrop.ts), Apache-2.0, © Adobe.
// Rivet: `aria-describedby` is an accessor (only during a drag session: browser-rendered); `onClick` is the no-op
// handler Mobile Safari needs to bubble clicks to the document (the DragManager handles them there).
import * as DragManager from "./drag-manager.ts";
import type { DragFormat } from "./drag-manager.ts";
import { descriptionId, useDragModality } from "./utils.ts";

export interface VirtualDropResult {
  dropProps: { "aria-describedby": () => string | undefined; onClick: () => void };
}

const MESSAGES = {
  keyboard: "dropDescriptionKeyboard",
  touch: "dropDescriptionTouch",
  virtual: "dropDescriptionVirtual",
};

export function useVirtualDrop(stringFormatter: DragFormat): VirtualDropResult {
  const modality = useDragModality();
  const dragSession = DragManager.useDragSession();
  return {
    dropProps: {
      "aria-describedby": () => descriptionId(dragSession() ? stringFormatter(MESSAGES[modality()]) : ""),
      // Mobile Safari does not properly bubble click events on elements except links or inputs unless there is an
      // onclick handler bound directly to the element itself. By adding this handler, we are able to handle document
      // level click events in the DragManager. See https://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
      onClick: () => {},
    },
  };
}
