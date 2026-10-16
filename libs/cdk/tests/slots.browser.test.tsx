// Tests of the RAC slot / context / render-prop contract (`slots/`) and the simple RAC parts built on it.
// Ported from react-aria-components test/Separator.test.js (react-spectrum, Apache-2.0, © Adobe);
// the utils / Heading / Text / Header / Keyboard / Label / Input / TextArea cases are Rivet tests of the
// RAC `utils.tsx` behaviour (upstream has no dedicated utils test file).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `getByRole` → `@testing-library/dom`
// `within(container)`; `className` → `class`; `SeparatorContext.Provider value` → runtime `<Provider token value>`.
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { computed, createRoot, provide, signal } from "@rivetjs/reactivity";
import { Provider as TokenProvider, Show, ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import {
  Provider,
  composeRenderProps,
  contextProps,
  createContext,
  createSlot,
  createSlotId,
  removeDataAttributes,
  renderProps,
  slotIdRef,
  slottedContext,
  type ContextValue,
  type SlotProps,
} from "../slots/index.tsx";
import { mergeRefs } from "../interactions/merge-props.tsx";
import { buildCollectionFrom } from "../collections/components.tsx";
import { Heading, HeadingContext } from "../heading/index.tsx";
import { Text, TextContext } from "../text/index.tsx";
import { Header, HeaderContext } from "../header/index.tsx";
import { Keyboard, KeyboardContext } from "../keyboard/index.tsx";
import { Separator, SeparatorContext } from "../separator/index.tsx";
import { Label, LabelContext } from "../label/index.tsx";
import { Input, InputContext } from "../input/index.tsx";
import { TextArea, TextAreaContext } from "../text-area/index.tsx";

afterEach(cleanup);

const q = (container: Element | DocumentFragment) => within(container as HTMLElement);

interface ProbeProps extends SlotProps {
  id?: string;
  class?: string;
  style?: Record<string, string>;
  title?: string;
  onClick?: (e: MouseEvent) => void;
}
const ProbeContext = createContext<ContextValue<ProbeProps, HTMLElement>>({});

function Probe(props: ProbeProps & { ref?: any }) {
  const [merged, r] = contextProps(props, props.ref, ProbeContext);
  const { id, class: cls, style, title, onClick } = merged;
  return <span data-testid="probe" id={id} class={cls} style={style} title={title} ref={r as never} onClick={onClick} />;
}

describe("slottedContext", () => {
  it("returns the plain context value", () => {
    let seen: unknown;
    function Read() {
      seen = slottedContext(ProbeContext);
      return null;
    }
    render(() => (
      <TokenProvider token={ProbeContext} value={{ title: "x" }}>
        <Read />
      </TokenProvider>
    ));
    expect(seen).toEqual({ title: "x" });
  });

  it("returns null for an explicit null slot", () => {
    let seen: unknown = "unset";
    function Read() {
      seen = slottedContext(ProbeContext, null);
      return null;
    }
    render(() => (
      <TokenProvider token={ProbeContext} value={{ title: "x" }}>
        <Read />
      </TokenProvider>
    ));
    expect(seen).toBeNull();
  });

  it("throws for an unknown slot and for a missing slot prop", () => {
    const errors: string[] = [];
    function Read(props: { slot?: string }) {
      try {
        slottedContext(ProbeContext, props.slot);
      } catch (e) {
        errors.push((e as Error).message);
      }
      return null;
    }
    render(() => (
      <TokenProvider token={ProbeContext} value={{ slots: { a: { title: "a" }, b: { title: "b" } } }}>
        <Read slot="c" />
        <Read />
      </TokenProvider>
    ));
    expect(errors).toEqual(['Invalid slot "c". Valid slot names are "a" and "b".', 'A slot prop is required. Valid slot names are "a" and "b".']);
  });
});

describe("contextProps", () => {
  it("merges context props under own props (own win, classes join, handlers chain)", async () => {
    const order: string[] = [];
    const { container } = render(() => (
      <TokenProvider token={ProbeContext} value={{ title: "ctx", class: "a", id: "ctx-id", onClick: () => order.push("ctx") }}>
        <Probe title="own" class="b" onClick={() => order.push("own")} />
      </TokenProvider>
    ));
    const el = q(container).getByTestId("probe");
    expect(el).toHaveAttribute("title", "own");
    expect(el).toHaveAttribute("class", "a b");
    expect(el).toHaveAttribute("id", "ctx-id");
    el.click();
    expect(order).toEqual(["ctx", "own"]);
  });

  it("selects the slot's props", () => {
    const { container } = render(() => (
      <TokenProvider token={ProbeContext} value={{ slots: { title: { title: "T" }, description: { title: "D" } } }}>
        <Probe slot="description" />
      </TokenProvider>
    ));
    expect(q(container).getByTestId("probe")).toHaveAttribute("title", "D");
  });

  it("uses the DEFAULT_SLOT entry when no slot is given", async () => {
    const { DEFAULT_SLOT } = await import("../slots/index.tsx");
    const { container } = render(() => (
      <TokenProvider token={ProbeContext} value={{ slots: { [DEFAULT_SLOT]: { title: "default" }, other: { title: "o" } } }}>
        <Probe />
      </TokenProvider>
    ));
    expect(q(container).getByTestId("probe")).toHaveAttribute("title", "default");
  });

  it("ignores the context with slot={null}", () => {
    const { container } = render(() => (
      <TokenProvider token={ProbeContext} value={{ title: "ctx" }}>
        <Probe slot={null} />
      </TokenProvider>
    ));
    expect(q(container).getByTestId("probe")).not.toHaveAttribute("title");
  });

  it("merges style objects and composes style functions", () => {
    const [objects] = (() => {
      let out: unknown;
      function Read(props: { style?: unknown }) {
        out = contextProps(props as ProbeProps, undefined, ProbeContext)[0];
        return null;
      }
      render(() => (
        <TokenProvider token={ProbeContext} value={{ style: { color: "red", margin: "1px" } }}>
          <Read style={{ color: "blue" }} />
        </TokenProvider>
      ));
      return [out as { style: unknown }];
    })();
    expect(objects.style).toEqual({ color: "blue", margin: "1px" });

    let merged: { style: (rp: object) => object } | undefined;
    function ReadFn(props: { style?: unknown }) {
      merged = contextProps(props as never, undefined, ProbeContext)[0] as never;
      return null;
    }
    render(() => (
      <TokenProvider token={ProbeContext} value={{ style: ((rp: { defaultStyle: object }) => ({ ...rp.defaultStyle, color: "red" })) as never }}>
        <ReadFn style={(rp: { defaultStyle: Record<string, string> }) => ({ padding: rp.defaultStyle.color === "red" ? "2px" : "0" })} />
      </TokenProvider>
    ));
    expect(merged!.style({ defaultStyle: { margin: "0" } })).toEqual({ margin: "0", color: "red", padding: "2px" });
  });

  it("returns the own ref, the context ref, or a ref feeding both", async () => {
    const own = ref<HTMLElement>();
    const fromContext = ref<HTMLElement>();
    let cb: HTMLElement | null = null;
    const { container } = render(() => (
      <>
        <TokenProvider token={ProbeContext} value={{ ref: fromContext } as never}>
          <Probe title="both" ref={own} />
        </TokenProvider>
        <TokenProvider token={ProbeContext} value={{ ref: ((el: HTMLElement) => (cb = el)) as never }}>
          <Probe title="ctx-only" />
        </TokenProvider>
      </>
    ));
    await flush();
    const [both, ctxOnly] = q(container).getAllByTestId("probe");
    expect(own()).toBe(both);
    expect(fromContext()).toBe(both);
    expect(cb).toBe(ctxOnly);
  });
});

describe("Provider", () => {
  it("provides several contexts", () => {
    const { container } = render(() => (
      <Provider
        values={[
          [HeadingContext, { level: 2, id: "h" }],
          [TextContext, { slots: { description: { id: "d" } } }],
        ]}
      >
        <Heading>Title</Heading>
        <Text slot="description">Desc</Text>
      </Provider>
    ));
    const heading = q(container).getByRole("heading");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveAttribute("id", "h");
    expect(q(container).getByText("Desc")).toHaveAttribute("id", "d");
  });
});

describe("renderProps", () => {
  it("resolves class / style / children functions with the render props and defaults", () => {
    const hovered = signal(false);
    let rp!: ReturnType<typeof renderProps>;
    function Read() {
      rp = renderProps({
        class: ({ isHovered, defaultClassName }: { isHovered: () => boolean; defaultClassName: string | undefined }) =>
          `${defaultClassName} ${isHovered() ? "on" : "off"}`,
        style: ({ defaultStyle }: { defaultStyle: object }) => ({ ...defaultStyle, color: "red" }),
        children: ({ defaultChildren }: { defaultChildren: unknown }) => ["x", defaultChildren] as never,
        values: { isHovered: hovered },
        defaultClassName: "rv-X",
        defaultStyle: { margin: "0" },
        defaultChildren: "d",
      });
      return null;
    }
    render(() => <Read />);
    expect(rp.class()).toBe("rv-X off");
    hovered.set(true);
    expect(rp.class()).toBe("rv-X on");
    expect(rp.style()).toEqual({ margin: "0", color: "red" });
    expect(rp.children()).toEqual(["x", "d"]);
  });

  it("falls back to the defaults", () => {
    let rp!: ReturnType<typeof renderProps>;
    function Read() {
      rp = renderProps({ values: {}, defaultClassName: "rv-X", defaultChildren: "d" });
      return null;
    }
    render(() => <Read />);
    expect(rp.class()).toBe("rv-X");
    expect(rp.style()).toBeUndefined();
    expect(rp.children()).toBe("d");
  });

  it("composeRenderProps wraps static and function values", () => {
    const wrap = (prev: string, rp: { on: boolean }) => `${prev}${rp.on ? "!" : ""}`;
    expect(composeRenderProps("a" as string, wrap)({ on: true })).toBe("a!");
    expect(composeRenderProps(((rp: { on: boolean }) => (rp.on ? "b" : "c")) as never, wrap)({ on: false })).toBe("c");
  });
});

describe("createSlot / createSlotId", () => {
  it("createSlot: hasSlot follows the attached element", async () => {
    const show = signal(true);
    let hasSlot!: () => boolean;
    function Owner() {
      const [slotRef, has] = createSlot();
      hasSlot = has;
      return (
        <Show when={show}>
          <span ref={slotRef as never}>slot</span>
        </Show>
      );
    }
    render(() => <Owner />);
    await flush();
    expect(hasSlot()).toBe(true);
    show.set(false);
    await flush();
    expect(hasSlot()).toBe(false);
  });

  it("createSlot: a Label slot through LabelContext sets aria-labelledby on a client render", async () => {
    function Field() {
      const [labelRef, hasLabel] = createSlot(true);
      return (
        <TokenProvider token={LabelContext} value={{ id: "l1", ref: labelRef }}>
          <TokenProvider token={InputContext} value={{ "aria-labelledby": () => (hasLabel() ? "l1" : undefined) }}>
            <Label>Name</Label>
            <Input />
          </TokenProvider>
        </TokenProvider>
      );
    }
    const { container } = render(() => <Field />);
    await flush();
    expect(container.querySelector("input")).toHaveAttribute("aria-labelledby", "l1");
  });

  it("createSlotId: rendered while a part consumes the id; the owner's aria attribute follows", async () => {
    const show = signal(true);
    function Owner() {
      const slotId = createSlotId("desc");
      const content = (
        <TokenProvider token={TextContext} value={{ slots: { description: { id: slotId } } }}>
          <Show when={show}>
            <Text slot="description">Help</Text>
          </Show>
        </TokenProvider>
      );
      return (
        <div role="group" aria-describedby={slotIdRef(slotId)}>
          {content}
        </div>
      );
    }
    const { container } = render(() => <Owner />);
    const group = q(container).getByRole("group");
    expect(group).toHaveAttribute("aria-describedby", "desc");
    expect(q(container).getByText("Help")).toHaveAttribute("id", "desc");
    show.set(false);
    await flush();
    expect(group).not.toHaveAttribute("aria-describedby");
    show.set(true);
    await flush();
    expect(group).toHaveAttribute("aria-describedby", "desc");
  });

  it("createSlotId: kept when the part renders after the consumer; dropped after mount when no part renders", async () => {
    function Field(props: { withDescription: boolean; id: string }) {
      const slotId = createSlotId(props.id);
      const withDescription = props.withDescription;
      return (
        <TokenProvider token={TextContext} value={{ slots: { description: { id: slotId } } }}>
          <input data-testid={props.id} aria-describedby={slotIdRef(slotId)} />
          {withDescription ? <Text slot="description">Help</Text> : null}
        </TokenProvider>
      );
    }
    const { container } = render(() => (
      <>
        <Field id="with" withDescription={true} />
        <Field id="without" withDescription={false} />
      </>
    ));
    const withInput = q(container).getByTestId("with");
    const withoutInput = q(container).getByTestId("without");
    // First render keeps the id (RA useSlotId), the effect after mount drops the missing one.
    expect(withInput).toHaveAttribute("aria-describedby", "with");
    await flush();
    expect(withInput).toHaveAttribute("aria-describedby", "with");
    expect(withoutInput).not.toHaveAttribute("aria-describedby");
  });

  it("createSlotId: deps re-run the check", async () => {
    const extra = signal(false);
    let slotId!: ReturnType<typeof createSlotId>;
    function Owner() {
      slotId = createSlotId("late", () => extra());
      return (
        <div>
          <Show when={() => extra()}>
            <span id="late">late</span>
          </Show>
        </div>
      );
    }
    render(() => <Owner />);
    await flush();
    expect(slotId.rendered()).toBe(false);
    extra.set(true);
    await flush();
    expect(slotId.rendered()).toBe(true);
  });

  it("removeDataAttributes drops data-* keys", () => {
    expect(removeDataAttributes({ a: 1, "data-x": 2, "aria-label": "l" } as Record<string, unknown>)).toEqual({ a: 1, "aria-label": "l" });
  });
});

describe("mergeRefs with ref() signals", () => {
  it("sets a ref() signal instead of calling it", () => {
    const r = ref<HTMLElement>();
    const el = document.createElement("div");
    let other: Element | null = null;
    const merged = mergeRefs<HTMLElement>(r as never, (v) => void (other = v)) as (v: HTMLElement | null) => void;
    merged(el);
    expect(r()).toBe(el);
    expect(other).toBe(el);
  });
});

describe("Heading", () => {
  it("renders an h3 with the default class", () => {
    const { container } = render(() => <Heading>Title</Heading>);
    const heading = q(container).getByRole("heading");
    expect(heading.tagName).toBe("H3");
    expect(heading).toHaveAttribute("class", "rv-Heading");
  });

  it("supports level, class and DOM props", () => {
    const { container } = render(() => (
      <Heading level={1} class="h" data-foo="bar">
        T
      </Heading>
    ));
    const heading = q(container).getByRole("heading");
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveAttribute("class", "h");
    expect(heading).toHaveAttribute("data-foo", "bar");
  });

  it("takes reactive children from its context (accessor)", async () => {
    const title = signal("October");
    const { container } = render(() => (
      <TokenProvider token={HeadingContext} value={{ "aria-hidden": true, level: 2, children: () => title() } as never}>
        <Heading />
      </TokenProvider>
    ));
    const heading = container.querySelector("h2")!;
    expect(heading).toHaveTextContent("October");
    expect(heading).toHaveAttribute("aria-hidden", "true");
    title.set("November");
    await flush();
    expect(heading).toHaveTextContent("November");
  });
});

describe("Text / Header / Keyboard / Label", () => {
  it("Text: span with rv-Text, elementType, slot", () => {
    const { container } = render(() => (
      <TokenProvider token={TextContext} value={{ slots: { description: { id: "d" } } }}>
        <Text slot="description" elementType="p">
          Desc
        </Text>
      </TokenProvider>
    ));
    const text = q(container).getByText("Desc");
    expect(text.tagName).toBe("P");
    expect(text).toHaveAttribute("class", "rv-Text");
    expect(text).toHaveAttribute("slot", "description");
    expect(text).toHaveAttribute("id", "d");
  });

  it("style (object, from context) on Text / Label / Heading / Keyboard / Header", () => {
    const { container } = render(() => (
      <TokenProvider token={TextContext} value={{ style: { color: "red" } }}>
        <Text>T</Text>
        <Label style={{ color: "red" }}>L</Label>
        <Heading style={{ color: "red" }}>H</Heading>
        <Keyboard style={{ color: "red" }}>K</Keyboard>
        <Header style={{ color: "red" }}>R</Header>
      </TokenProvider>
    ));
    for (const t of ["T", "L", "H", "K", "R"]) expect((q(container).getByText(t) as HTMLElement).style.color).toBe("red");
  });

  it("Header: header with rv-Header and context props", () => {
    const { container } = render(() => (
      <TokenProvider token={HeaderContext} value={{ id: "hd" }}>
        <Header>Section</Header>
      </TokenProvider>
    ));
    const header = q(container).getByText("Section");
    expect(header.tagName).toBe("HEADER");
    expect(header).toHaveAttribute("class", "rv-Header");
    expect(header).toHaveAttribute("id", "hd");
  });

  it("Keyboard: kbd dir=ltr", () => {
    const { container } = render(() => (
      <TokenProvider token={KeyboardContext} value={{ class: "kb" }}>
        <Keyboard>⌘V</Keyboard>
      </TokenProvider>
    ));
    const kbd = container.querySelector("kbd")!;
    expect(kbd).toHaveAttribute("dir", "ltr");
    expect(kbd).toHaveAttribute("class", "kb");
  });

  it("Label: label with rv-Label, context id / for, elementType span", () => {
    const { container } = render(() => (
      <>
        <TokenProvider token={LabelContext} value={{ id: "l", for: "f" }}>
          <Label>Name</Label>
        </TokenProvider>
        <Label elementType="span">Group</Label>
      </>
    ));
    const label = q(container).getByText("Name");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveAttribute("id", "l");
    expect(label).toHaveAttribute("for", "f");
    expect(q(container).getByText("Group").tagName).toBe("SPAN");
  });
});

describe("Separator", () => {
  it("should render a separator with default class", () => {
    const { container } = render(() => <Separator />);
    const separator = q(container).getByRole("separator");
    expect(separator.tagName).toBe("HR");
    expect(separator).toHaveAttribute("class", "rv-Separator");
  });

  it("should render a separator with custom class", () => {
    const { container } = render(() => <Separator class="test" />);
    expect(q(container).getByRole("separator")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { container } = render(() => <Separator data-foo="bar" />);
    expect(q(container).getByRole("separator")).toHaveAttribute("data-foo", "bar");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support slot", () => {
    const { container } = render(() => (
      <TokenProvider token={SeparatorContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Separator slot="test" />
      </TokenProvider>
    ));
    const separator = q(container).getByRole("separator");
    expect(separator).toHaveAttribute("slot", "test");
    expect(separator).toHaveAttribute("aria-label", "test");
  });

  it("should support accessibility props", () => {
    const { container } = render(() => <Separator aria-label="label" />);
    expect(q(container).getByRole("separator")).toHaveAttribute("aria-label", "label");
  });

  it("vertical: div with aria-orientation", () => {
    const { container } = render(() => <Separator orientation="vertical" />);
    const separator = q(container).getByRole("separator");
    expect(separator.tagName).toBe("DIV");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
  });
});

describe("Input / TextArea", () => {
  it("Input: default class, context props, focus / hover / invalid state", async () => {
    const user = userEvent.setup();
    const invalid = signal(false);
    const { container } = render(() => (
      <TokenProvider token={InputContext} value={{ id: "i", "aria-invalid": () => invalid() } as never}>
        <Input class={({ isFocused, defaultClassName }) => `${defaultClassName}${isFocused() ? " focused" : ""}`} />
      </TokenProvider>
    ));
    const input = q(container).getByRole("textbox");
    expect(input).toHaveAttribute("id", "i");
    expect(input).toHaveAttribute("class", "rv-Input");
    expect(input).not.toHaveAttribute("data-invalid");
    await user.click(input);
    expect(input).toHaveAttribute("data-focused", "true");
    expect(input).toHaveAttribute("class", "rv-Input focused");
    await user.hover(input);
    expect(input).toHaveAttribute("data-hovered", "true");
    invalid.set(true);
    await flush();
    expect(input).toHaveAttribute("data-invalid", "true");
    await user.keyboard("{Tab}");
    expect(input).not.toHaveAttribute("data-focused");
  });

  it("Input: data-focus-visible on keyboard focus, data-disabled", async () => {
    const user = userEvent.setup();
    const { container } = render(() => (
      <>
        <Input aria-label="a" />
        <Input aria-label="b" disabled />
      </>
    ));
    const [a, b] = q(container).getAllByRole("textbox");
    await user.keyboard("{Tab}");
    expect(a).toHaveFocus();
    expect(a).toHaveAttribute("data-focus-visible", "true");
    expect(b).toHaveAttribute("data-disabled", "true");
  });

  it("Input: autoFocus focuses an input created after load (React mount autoFocus)", async () => {
    const open = signal(false);
    const r = ref<HTMLInputElement>();
    const { container } = render(() => (
      <>
        <button type="button">before</button>
        <Show when={open}>{() => <Input aria-label="later" autoFocus ref={r} />}</Show>
      </>
    ));
    q(container).getByRole("button").focus();
    open.set(true);
    await flush();
    const input = q(container).getByRole("textbox");
    expect(input).toHaveFocus();
    expect(r()).toBe(input);
  });

  it("TextArea: default class and context", () => {
    const { container } = render(() => (
      <TokenProvider token={TextAreaContext} value={{ id: "t", rows: 3 }}>
        <TextArea />
      </TokenProvider>
    ));
    const area = q(container).getByRole("textbox");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("class", "rv-TextArea");
    expect(area).toHaveAttribute("id", "t");
    expect(area).toHaveAttribute("rows", "3");
  });
});

void vi;

describe("hideable parts (RAC createHideableComponent)", () => {
  it("Text / Label / Input / TextArea / Keyboard render nothing in the collection build pass, outside their providers", () => {
    // A slotted Text outside its TextContext would throw "Invalid slot" if it read its context.
    const parts = [
      () => <Text slot="errorMessage" />,
      () => <Label slot="x" />,
      () => <Input slot="x" />,
      () => <TextArea slot="x" />,
      () => <Keyboard slot="x" />,
    ];
    const slotted = { slots: { other: {} } };
    for (const part of parts) {
      const collection = provide(TextContext, slotted, () =>
        provide(LabelContext, slotted, () =>
          provide(InputContext, slotted, () => provide(TextAreaContext, slotted, () => provide(KeyboardContext, slotted, () => buildCollectionFrom(part)))),
        ),
      );
      expect([...collection.getKeys()]).toEqual([]);
    }
  });

  it("a SlotId part rendered during a computed evaluation defers its rendered write", async () => {
    const { value: slotId, dispose } = createRoot(() => createSlotId("cd"));
    await flush();
    slotId.rendered.set(false);
    const read = createRoot(() => computed(() => provide(TextContext, { id: slotId }, () => (Text({ children: "x" }), 1)))).value;
    expect(() => read()).not.toThrow();
    await Promise.resolve();
    expect(slotId.rendered()).toBe(true);
    dispose();
  });
});
