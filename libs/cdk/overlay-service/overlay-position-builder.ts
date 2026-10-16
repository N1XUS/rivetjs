// Builder for overlay position strategies (Angular CDK `OverlayPositionBuilder`).
//
// Ported from @angular/cdk/overlay (position/overlay-position-builder.ts), MIT, © Google LLC.
import {
  createFlexibleConnectedPositionStrategy,
  type FlexibleConnectedPositionStrategy,
  type FlexibleConnectedPositionStrategyOrigin,
} from "./connected-position.ts";
import { createGlobalPositionStrategy, type GlobalPositionStrategy } from "./global-position.ts";

export class OverlayPositionBuilder {
  /** A strategy positioning the overlay relative to the viewport. */
  global(): GlobalPositionStrategy {
    return createGlobalPositionStrategy();
  }

  /** A strategy positioning the overlay relative to `origin`. */
  flexibleConnectedTo(origin: FlexibleConnectedPositionStrategyOrigin): FlexibleConnectedPositionStrategy {
    return createFlexibleConnectedPositionStrategy(origin);
  }
}
