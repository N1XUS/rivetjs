// Contracts between `OverlayRef` (./overlay-ref.ts) and its position / scroll strategies
// (./connected-position.ts, ./global-position.ts, ./scroll-strategies.ts). Types only.
//
// Ported from @angular/cdk/overlay (position/position-strategy.ts, scroll/scroll-strategy.ts), MIT, © Google LLC.
import type { Direction } from "../bidi/index.ts";

/** What strategies see of an `OverlayRef`. */
export interface OverlayReference {
  /** The pane (`.cdk-overlay-pane`) holding the attached content. */
  readonly overlayElement: HTMLElement;
  /** Wrapper of the pane (the host / bounding box parent). */
  readonly hostElement: HTMLElement;
  readonly backdropElement: HTMLElement | null;
  getConfig(): OverlayStrategyConfig;
  getDirection(): Direction;
  hasAttached(): boolean;
  updatePosition(): void;
  updateSize(sizeConfig: { width?: number | string; height?: number | string }): void;
  detach(): unknown;
}

/** Config fields strategies read. */
export interface OverlayStrategyConfig {
  width?: number | string | undefined;
  height?: number | string | undefined;
  minWidth?: number | string | undefined;
  minHeight?: number | string | undefined;
  maxWidth?: number | string | undefined;
  maxHeight?: number | string | undefined;
  panelClass?: string | string[] | undefined;
  direction?: Direction | undefined;
}

/** Strategy for setting the position of an overlay. */
export interface PositionStrategy {
  /** Attach to an overlay. */
  attach(overlayRef: OverlayReference): void;
  /** Update the position of the overlay element. */
  apply(): void;
  /** The overlay was detached. */
  detach?(): void;
  /** Clean up DOM changes. */
  dispose(): void;
}

/** How an overlay reacts to scrolling while open. */
export interface ScrollStrategy {
  enable(): void;
  disable(): void;
  attach(overlayRef: OverlayReference): void;
  detach?(): void;
}

export function getMatScrollStrategyAlreadyAttachedError(): Error {
  return Error(`Scroll strategy has already been attached.`);
}
