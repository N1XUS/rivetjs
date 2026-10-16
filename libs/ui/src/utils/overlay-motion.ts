// The cdk motion token (`--rv-motion-spring`, theme `motion: { overlays: "spring" }`) for the ui overlays on cdk Modal
// (Modal, Drawer, AlertDialog, Sheet): registered when one of them is in the bundle (cdk `modalHooks.open`), so cdk
// alone ships none of it. Each overlay module imports `overlayMotion` and calls it in its body.
import { applyMotionToken, modalHooks } from "@rivetjs/cdk/modal";

const open = (overlay: HTMLElement, modal: HTMLElement): void => {
  applyMotionToken(overlay);
  applyMotionToken(modal);
};
/** Registers the motion token on cdk Modal (idempotent). */
export function overlayMotion(): void {
  modalHooks.open ??= open;
}
// Module evaluation registers it too: a resumed page's effect reads the hook through the module object.
overlayMotion();
