// Ported from @angular/cdk/collections (unique-selection-dispatcher.ts), MIT, © Google LLC.
//
// Coordinates unique selection by name (radio-like items that live in different components):
// native radio change events only fire on the newly selected item, so the others need a
// notification to uncheck. Angular provides it as a root service; Rivet: create one per scope
// (`new UniqueSelectionDispatcher()`, or provide it through context).

export type UniqueSelectionDispatcherListener = (id: string, name: string) => void;

export class UniqueSelectionDispatcher {
  private _listeners: UniqueSelectionDispatcherListener[] = [];

  /** Notify other items that selection for the given name has been set. */
  notify(id: string, name: string): void {
    for (const listener of this._listeners) listener(id, name);
  }

  /** Listen for future changes to item selection. Returns a function that deregisters the listener. */
  listen(listener: UniqueSelectionDispatcherListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((registered) => listener !== registered);
    };
  }

  /** Drop all listeners (Angular `ngOnDestroy`). */
  destroy(): void {
    this._listeners = [];
  }
}
