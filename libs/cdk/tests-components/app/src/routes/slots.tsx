// RAC slot contracts on a resumed page (`@rivetjs/cdk/slots` + parts): slot contexts provided outside a
// region reach parts re-created inside it; `createSlotId` drives aria-describedby in the server HTML and
// after resume; accessor context values (Heading children, Input aria-invalid) update reactively;
// PressResponder + Pressable press handlers resume.
import { signal } from "@rivetjs/reactivity";
import { Provider as TokenProvider, Show } from "@rivetjs/runtime/dom";
import { Provider, createSlot, createSlotId, slotIdRef } from "@rivetjs/cdk/slots";
import { Heading, HeadingContext } from "@rivetjs/cdk/heading";
import { Text, TextContext } from "@rivetjs/cdk/text";
import { Input, InputContext } from "@rivetjs/cdk/input";
import { Separator } from "@rivetjs/cdk/separator";
import { Keyboard } from "@rivetjs/cdk/keyboard";
import { PressResponder, Pressable } from "@rivetjs/cdk/interactions/pressable";

function Described(props: { id: string; initial: boolean }) {
  const show = signal(props.initial);
  // RA useSlotId: the id starts present; after mount (and when `show` changes) it is kept only while an
  // element with it exists. The described input renders BEFORE the description.
  const slotId = createSlotId(props.id + "-desc", show);
  const id = props.id;
  return (
    <div>
      <button id={id + "-toggle"} type="button" onClick={() => show.set(!show())}>
        toggle
      </button>
      <TokenProvider token={TextContext} value={{ slots: { description: { id: slotId } } }}>
        <input id={id + "-input"} aria-label="Field" aria-describedby={slotIdRef(slotId)} />
        <Show when={() => show()}>
          <Text slot="description">Help text</Text>
        </Show>
      </TokenProvider>
    </div>
  );
}

function NoDescription() {
  const slotId = createSlotId("nd-desc");
  return <input id="nd-input" aria-label="No description" aria-describedby={slotIdRef(slotId)} />;
}

function SlottedRegion() {
  const open = signal(false);
  return (
    <div>
      <button id="sr-toggle" type="button" onClick={() => open.set(!open())}>
        toggle
      </button>
      <Show when={() => open()}>
        <Heading id="sr-heading">Recreated</Heading>
        <Text slot="description">Recreated description</Text>
      </Show>
    </div>
  );
}

// createSlot: `hasSlot` captured by a reactive binding must resume (C4c Meter with an accessor value).
function HasSlot() {
  const [labelRef, hasLabel] = createSlot(true);
  const value = signal(0);
  const showLabel = signal(true);
  return (
    <div>
      <button id="hs-inc" type="button" onClick={() => value.set(value() + 1)}>
        inc
      </button>
      <button id="hs-toggle" type="button" onClick={() => showLabel.set(!showLabel())}>
        toggle label
      </button>
      <Show when={() => showLabel()}>
        <span id="hs-label" ref={labelRef}>
          Label
        </span>
      </Show>
      <div id="hs-target" role="meter" aria-valuenow={value()} aria-labelledby={hasLabel() && value() >= 0 ? "hs-label" : undefined}>
        {value()}
      </div>
    </div>
  );
}

// contextProps style merge: a context style function + an own style object → merged style function
// captured by the part's resumed style binding (C5 ColorSlider SliderTrack).
function MergedStyle() {
  const hue = signal(0);
  return (
    <div>
      <button id="ms-next" type="button" onClick={() => hue.set(hue() + 120)}>
        hue
      </button>
      <TokenProvider token={InputContext} value={{ style: () => ({ color: `hsl(${hue()} 50% 40%)` }) }}>
        <Input id="ms-input" aria-label="Styled" style={{ width: "120px" }} />
      </TokenProvider>
    </div>
  );
}

export const head = { title: "Slots" };

export default function Slots() {
  const title = signal("October");
  const invalid = signal(false);
  const presses = signal(0);
  return (
    <section>
      <h1>Slots</h1>
      <Provider
        values={[
          [HeadingContext, { level: 2, class: "sr-h" }],
          [TextContext, { slots: { description: { id: "sr-desc" } } }],
        ]}
      >
        <SlottedRegion />
      </Provider>
      <Described id="d1" initial={true} />
      <Described id="d2" initial={false} />
      <NoDescription />
      <HasSlot />
      <MergedStyle />
      <button id="title-next" type="button" onClick={() => title.set("November")}>
        next
      </button>
      <TokenProvider token={HeadingContext} value={{ "aria-hidden": true, level: 4, id: "acc-heading", children: () => title() }}>
        <Heading />
      </TokenProvider>
      <button id="invalid-toggle" type="button" onClick={() => invalid.set(!invalid())}>
        invalid
      </button>
      <TokenProvider token={InputContext} value={{ id: "ctx-input", "aria-label": "Name", "aria-invalid": () => invalid() }}>
        <Input />
      </TokenProvider>
      <Separator id="sep" />
      <Keyboard id="kbd">⌘K</Keyboard>
      <PressResponder onPress={() => presses.set(presses() + 1)}>
        <Pressable>
          {(p) => (
            <span {...p} ref={p.ref as never} id="pressable" role="button">
              Press me
            </span>
          )}
        </Pressable>
      </PressResponder>
      <output id="presses">{presses()}</output>
    </section>
  );
}
