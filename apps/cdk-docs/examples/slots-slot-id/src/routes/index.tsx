import { signal } from "@rivetjs/reactivity";
import { Provider as TokenProvider, Show } from "@rivetjs/runtime/dom";
import { createSlotId, slotIdRef } from "@rivetjs/cdk/slots";
import { Text, TextContext } from "@rivetjs/cdk/text";

export const head = { title: "Slots: createSlotId" };

// #region demo
export default function SlotIdDemo() {
  const show = signal(true);
  // `deps`: re-check whether the description exists when `show` changes (RA useSlotId depArray).
  const description = createSlotId("sid-desc", show);
  return (
    <div class="demo">
      <button id="sid-toggle" type="button" onClick={() => show.set(!show())}>
        Toggle description
      </button>
      <div id="sid-group" role="group" aria-label="Options" aria-describedby={slotIdRef(description)}>
        <TokenProvider token={TextContext} value={{ slots: { description: { id: description } } }}>
          <button type="button">Option A</button>
          <button type="button">Option B</button>
          <Show when={() => show()}>
            <Text slot="description">Pick one option</Text>
          </Show>
        </TokenProvider>
      </div>
    </div>
  );
}
// #endregion
