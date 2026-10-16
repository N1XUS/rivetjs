// Ported from @angular/cdk/collections (data-source.ts, array-data-source.ts, collection-viewer.ts),
// MIT, © Google LLC.
//
// rxjs Observables → Rivet accessors: `connect` returns `() => readonly T[]` (a signal or computed:
// read it in a binding / `For each` to track changes). `viewChange` is an accessor of the rendered
// range (virtual lists write it).

/** A range of numbers: `start` inclusive, `end` exclusive. */
export type ListRange = { start: number; end: number };

/** A component that provides a view of some data collection (CDK `CollectionViewer`). */
export interface CollectionViewer {
  /** The portion of the data the viewer currently looks at. */
  viewChange: () => ListRange;
}

/** Source of data for a collection viewer (table, tree, virtual list). */
export abstract class DataSource<T> {
  /** Connects a collection viewer; returns an accessor of the current data. */
  abstract connect(collectionViewer: CollectionViewer): () => readonly T[];
  /** Disconnects a collection viewer (clean-up / tear-down). */
  abstract disconnect(collectionViewer: CollectionViewer): void;
}

/** Checks whether an object is a data source (has a `connect` function). */
export function isDataSource(value: any): value is DataSource<any> {
  // Cannot be checked as `instanceof DataSource`: sources may match the interface without extending it.
  return !!value && typeof value.connect === "function";
}

/** DataSource wrapper for a native array or an accessor of one. */
export class ArrayDataSource<T> extends DataSource<T> {
  private _data: readonly T[] | (() => readonly T[]);

  constructor(_data: readonly T[] | (() => readonly T[])) {
    super();
    this._data = _data;
  }

  connect(): () => readonly T[] {
    const data = this._data;
    return typeof data === "function" ? data : () => data;
  }

  disconnect(): void {}
}
