// Resume hook slot of the spread takeover (K3-rt-1): `dom-v2-spread.ts` installs its `TAKEOVER` here when a resumed
// `_spread` binds (pay-per-use); `dom-resume.ts` only reads it. Its own module so the resume runtime does not import
// the spread module: that import put `_spread` / `_attrs` and `style.ts` in the resume runtime's graph on every page
// (DIET-CODE 2026-10-22).

export interface Takeover {
  add(el: Element, type: string): void;
  /** Run `call` after the handler of the outermost element between the event's target and `ancestor` (exclusive)
   * that took `type` over (unless it stopped propagation); false when there is none. */
  defer(event: Event, ancestor: Element, type: string, call: () => void): boolean;
}
/** Event types an activated spread took over per element, and the deferral of an ancestor's resumed bubbling handler
 * behind such a descendant (the loader's capture-phase walk would run it first); unset until a resumed spread binds. */
export let _takeover: Takeover | undefined;
export const _setTakeover = (takeover: Takeover): void => {
  _takeover = takeover;
};
