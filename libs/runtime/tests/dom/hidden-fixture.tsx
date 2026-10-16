// `hidden` is enumerated (`until-found`): dynamic and spread values in both lowerings (dom-hidden-browser.test.ts).
import { signal } from "@rivetjs/reactivity";

export const state = signal<unknown>("until-found");

export function Panels() {
  return (
    <div>
      <p id="bound" hidden={state() as string}>
        bound
      </p>
      <p id="spread" {...{ hidden: state() }}>
        spread
      </p>
    </div>
  );
}
