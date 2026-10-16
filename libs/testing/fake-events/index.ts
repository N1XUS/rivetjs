// Ported from Angular Components (src/cdk/testing/testbed/fake-events/index.ts), MIT, © Google LLC.
// These are private APIs that are used both by the public APIs inside of this package, as well
// as in unit tests of other entry-points, hence why we need to re-export them through here.
export * from './dispatch-events.ts';
export * from './event-objects.ts';
export * from './element-focus.ts';
export * from './type-in-element.ts';
export type {ModifierKeys} from './test-element.ts';
