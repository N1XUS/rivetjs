// Ported from HeroUI v3.2.6 packages/react/src/hooks/use-overlay-state.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - Built on the cdk overlay trigger state (`@rivetjs/cdk/state/overlays`, react-stately `useOverlayTriggerState`): `isOpen`
//   is a plain value OR a two-way Signal, `defaultOpen`, `onOpenChange` (upstream: React state + `useCallback`s).
// - `isOpen` on the result is a read-only accessor of the state (upstream: a boolean read on each render): read
//   `state.isOpen()` in bindings; `isOpen={state.isOpen} onOpenChange={state.setOpen}` on an overlay = upstream's controlled
//   pair (an accessor is controlled and never written by the cdk: dismissing calls `onOpenChange` → `setOpen` → this hook's
//   `onOpenChange`). The accessor and methods are object-literal functions in a `.tsx` module: compiler-registered
//   resumable functions (the state serializes on resumed pages).
// - `toggle` reads the latest value set in the same task (upstream: the `isOpen` captured at render).
import { closeOverlay, createOverlayTriggerState, openOverlay, setOpen, toggleOverlay } from "@rivetjs/cdk/state/overlays";
import type { Signal } from "@rivetjs/reactivity";

export interface UseOverlayStateProps {
  /**
   * Whether the overlay is currently open (controlled): a plain value, or a two-way Signal.
   */
  isOpen?: boolean | Signal<boolean>;
  /**
   * Whether the overlay is open by default (uncontrolled)
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Handler that is called when the overlay's open state changes
   */
  onOpenChange?: (isOpen: boolean) => void;
}

export interface UseOverlayStateReturn {
  /**
   * Whether the overlay is currently open (Rivet: a read-only accessor; read `isOpen()`).
   */
  readonly isOpen: () => boolean;
  /**
   * Sets the overlay's open state
   */
  setOpen(isOpen: boolean): void;
  /**
   * Opens the overlay
   */
  open(): void;
  /**
   * Closes the overlay
   */
  close(): void;
  /**
   * Toggles the overlay's open state
   */
  toggle(): void;
}

/**
 * Manages overlay trigger state (Modal, AlertDialog, Popover, etc.)
 * Provides methods to open, close, and toggle the overlay
 *
 * @example
 * ```tsx
 * const state = useOverlayState();
 *
 * <Button onPress={() => state.open()}>Open Dialog</Button>
 * <Modal state={state}>
 *   <Modal.Content>…</Modal.Content>
 * </Modal>
 * ```
 */
export const useOverlayState = (props: UseOverlayStateProps = {}): UseOverlayStateReturn => {
  const state = createOverlayTriggerState({ defaultOpen: props.defaultOpen ?? false, isOpen: props.isOpen, onOpenChange: props.onOpenChange });

  return {
    isOpen: () => state.isOpen(),
    setOpen(isOpen: boolean) {
      setOpen(state, isOpen);
    },
    open() {
      openOverlay(state);
    },
    close() {
      closeOverlay(state);
    },
    toggle() {
      toggleOverlay(state);
    },
  };
};
