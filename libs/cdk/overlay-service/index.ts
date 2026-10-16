// The overlay service (Angular CDK `Overlay`): create overlays, build position strategies, pick
// scroll strategies. Deviation: a lazily created singleton (`overlayService()`) instead of DI;
// `new Overlay(options)` for custom container / dispatchers.
//
// Ported from @angular/cdk/overlay (overlay.ts), MIT, © Google LLC.
import { createOverlayRef, type CreateOverlayOptions, type OverlayConfig, type OverlayRef } from "./overlay-ref.ts";
import { OverlayPositionBuilder } from "./overlay-position-builder.ts";
import { ScrollStrategyOptions } from "./scroll-strategies.ts";

export class Overlay {
  readonly scrollStrategies = new ScrollStrategyOptions();
  private readonly _options: CreateOverlayOptions;
  private _positionBuilder: OverlayPositionBuilder | undefined;

  constructor(options: CreateOverlayOptions = {}) {
    this._options = options;
  }

  /** Create an overlay (browser only). */
  create(config?: Partial<OverlayConfig>): OverlayRef {
    return createOverlayRef(config, this._options);
  }

  /** Position strategy builder. */
  position(): OverlayPositionBuilder {
    return (this._positionBuilder ??= new OverlayPositionBuilder());
  }
}

let shared: Overlay | undefined;
/** The shared `Overlay` service (created on first use). */
export const overlayService = (): Overlay => (shared ??= new Overlay());
