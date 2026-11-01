// Named controls shadow HTMLFormElement members (<input name="elements">, <button name="reset">): read and call them
// through the prototype, never as properties of the element. No imports: bindings, handlers and lazy chunks share it.
let controlsGetter: (() => HTMLFormControlsCollection) | undefined;
/** The form's controls (`form.elements`), safe from a control named `elements`. */
export const controlsOf = (element: HTMLFormElement): HTMLFormControlsCollection =>
  (controlsGetter ??= Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "elements")!.get as () => HTMLFormControlsCollection).call(element);
/** `form.reset()`, safe from a control named `reset`. */
export const resetForm = (element: HTMLFormElement): void => HTMLFormElement.prototype.reset.call(element);
/** `form.requestSubmit(submitter)`, safe from a control named `requestSubmit`. */
export const requestSubmitOf = (element: HTMLFormElement, submitter: HTMLElement | null): void =>
  HTMLFormElement.prototype.requestSubmit.call(element, submitter as HTMLButtonElement | null);
