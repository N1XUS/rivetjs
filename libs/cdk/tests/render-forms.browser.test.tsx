// RAC `render` prop (DOMRenderProps) on the field and form parts.
// Ports RAC "should support custom render function" (Input, TextArea, TextField, SearchField, NumberField, ColorField, Checkbox, Switch,
// Slider, Form, FieldError, Group, ToggleButtonGroup): the returned element replaces the default one and keeps the part's attributes.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Input } from "../input/index.tsx";
import { TextArea } from "../text-area/index.tsx";
import { TextField } from "../text-field/index.tsx";
import { SearchField } from "../search-field/index.tsx";
import { NumberField } from "../number-field/index.tsx";
import { ColorField } from "../color-field/index.tsx";
import { CheckboxGroup, CheckboxField, CheckboxButton } from "../checkbox/index.tsx";
import { Switch, SwitchField, SwitchButton } from "../switch/index.tsx";
import { Slider, SliderOutput, SliderTrack, SliderFill, SliderThumb } from "../slider/index.tsx";
import { Form, FieldError } from "../form/index.tsx";
import { Group } from "../group/index.tsx";
import { ToggleButtonGroup } from "../toggle-button-group/index.tsx";
import { ToggleButton } from "../toggle-button/index.tsx";
import { Label } from "../label/index.tsx";

afterEach(cleanup);
const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;
/** Stable attributes (ids differ per instance). */
const sig = (el: Element) =>
  [...el.attributes]
    .filter((a) => a.name === "class" || a.name === "role" || a.name === "type" || a.name.startsWith("data-"))
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join(" ");

describe("render prop: fields", () => {
  it("Input", () => {
    const seen: boolean[] = [];
    const c = mount(() => (
      <Input
        placeholder="p"
        render={(p, rp) => {
          seen.push(rp.isHovered());
          return <input {...(p as {})} data-r="1" />;
        }}
      />
    ));
    const el = c.querySelector("input[data-r='1']")!;
    expect(el.getAttribute("class")).toBe("rv-Input");
    expect(el.getAttribute("placeholder")).toBe("p");
    expect(seen).toEqual([false]);
  });

  it("Input: parity with the default element across focus", () => {
    const a = mount(() => <Input />).querySelector("input")!;
    const c = mount(() => <Input render={(p) => <input {...(p as {})} />} />);
    const b = c.querySelector("input")!;
    expect(sig(b)).toBe(sig(a));
    b.focus();
    expect(b.getAttribute("data-focused")).toBe("true");
  });

  it("TextArea", () => {
    const c = mount(() => <TextArea render={(p) => <textarea {...(p as {})} data-r="1" />} />);
    expect(c.querySelector("textarea[data-r='1']")!.getAttribute("class")).toBe("rv-TextArea");
  });

  it("TextField: root replaced, parts inside see the field contexts", () => {
    const c = mount(() => (
      <TextField isRequired render={(p) => <section {...(p as {})} data-r="1" />}>
        <Label>Name</Label>
        <Input />
      </TextField>
    ));
    const root = c.querySelector("section[data-r='1']")!;
    expect(root.getAttribute("class")).toBe("rv-TextField");
    expect(root.getAttribute("data-required")).toBe("true");
    expect(root.querySelector("label")!.getAttribute("for")).toBe(root.querySelector("input")!.id);
    expect(c.querySelector("div.rv-TextField")).toBeNull();
  });

  it("SearchField", () => {
    const c = mount(() => (
      <SearchField render={(p) => <section {...(p as {})} data-r="1" />}>
        <Input />
      </SearchField>
    ));
    const root = c.querySelector("section[data-r='1']")!;
    expect(root.getAttribute("data-empty")).toBe("true");
    expect(root.querySelector("input")).not.toBeNull();
  });

  it("NumberField keeps the hidden form input as sibling", () => {
    const c = mount(() => (
      <NumberField name="n" defaultValue={3} render={(p) => <section {...(p as {})} data-r="1" />}>
        <Input />
      </NumberField>
    ));
    expect(c.querySelector("section[data-r='1']")).not.toBeNull();
    expect((c.querySelector("input[type=hidden]") as HTMLInputElement).value).toBe("3");
  });

  it("ColorField", () => {
    const c = mount(() => (
      <ColorField name="c" defaultValue="#ff0000" render={(p) => <section {...(p as {})} data-r="1" />}>
        <Input />
      </ColorField>
    ));
    const root = c.querySelector("section[data-r='1']")!;
    expect(root.getAttribute("data-channel")).toBe("hex");
    expect(root.querySelector("input")).not.toBeNull();
  });

  it("Group: parity and focus-within state", () => {
    const a = mount(() => <Group>x</Group>).firstElementChild!;
    const c = mount(() => (
      <Group render={(p) => <section {...(p as {})} />}>
        <Input />
      </Group>
    ));
    const el = c.querySelector("section")!;
    expect(sig(el)).toBe(sig(a));
    expect(el.getAttribute("role")).toBe("group");
  });
});

describe("render prop: toggles", () => {
  it("CheckboxField + CheckboxButton render the label wrapper and keep the input", () => {
    const c = mount(() => (
      <CheckboxField render={(p) => <section {...(p as {})} data-f="1" />}>
        <CheckboxButton render={(p, rp) => <label {...(p as {})} data-b={String(rp.isSelected())} />}>
          <span>t</span>
        </CheckboxButton>
      </CheckboxField>
    ));
    expect(c.querySelector("section[data-f='1']")).not.toBeNull();
    const label = c.querySelector("label[data-b='false']")!;
    const input = label.querySelector("input")!;
    input.click();
    expect(label.getAttribute("data-selected")).toBe("true");
    expect(label.textContent).toBe("t");
  });

  it("CheckboxGroup", () => {
    const c = mount(() => <CheckboxGroup render={(p) => <section {...(p as {})} data-r="1" />}>x</CheckboxGroup>);
    expect(c.querySelector("section[data-r='1']")!.getAttribute("class")).toBe("rv-CheckboxGroup");
  });

  it("Switch / SwitchField / SwitchButton", () => {
    const s = mount(() => <Switch render={(p) => <label {...(p as {})} data-r="1" />}>on</Switch>);
    const label = s.querySelector("label[data-r='1']")!;
    label.querySelector("input")!.click();
    expect(label.getAttribute("data-selected")).toBe("true");
    const f = mount(() => (
      <SwitchField render={(p) => <section {...(p as {})} data-f="1" />}>
        <SwitchButton render={(p) => <label {...(p as {})} data-b="1" />}>x</SwitchButton>
      </SwitchField>
    ));
    expect(f.querySelector("section[data-f='1'] label[data-b='1'] input")).not.toBeNull();
  });
});

describe("render prop: slider", () => {
  it("each part gets render", () => {
    const c = mount(() => (
      <Slider defaultValue={30} render={(p) => <section {...(p as {})} data-s="1" />}>
        <SliderOutput render={(p) => <b {...(p as {})} data-o="1" />} />
        <SliderTrack render={(p) => <i {...(p as {})} data-t="1" />}>
          <SliderFill render={(p) => <u {...(p as {})} data-fill="1" />} />
          <SliderThumb render={(p, rp) => <em {...(p as {})} data-th={String(rp.isDragging())} />} />
        </SliderTrack>
      </Slider>
    ));
    expect(c.querySelector("section[data-s='1']")!.getAttribute("data-orientation")).toBe("horizontal");
    expect(c.querySelector("b[data-o='1']")!.textContent).toBe("30");
    expect(c.querySelector("i[data-t='1'] u[data-fill='1']")).not.toBeNull();
    const thumb = c.querySelector("em[data-th='false']")!;
    expect(thumb.querySelector("input[type=range]")).not.toBeNull();
    expect((thumb as HTMLElement).style.left || (thumb as HTMLElement).style.insetInlineStart).toBeTruthy();
  });
});

describe("render prop: form", () => {
  it("Form: submit handler runs on the rendered element", () => {
    let submitted = 0;
    const c = mount(() => (
      <Form
        aria-label="f"
        onSubmit={(e) => {
          e.preventDefault();
          submitted++;
        }}
        render={(p) => <form {...(p as {})} data-r="1" />}
      >
        <Input name="a" />
      </Form>
    ));
    const form = c.querySelector("form[data-r='1']") as HTMLFormElement;
    expect(form.getAttribute("class")).toBe("rv-Form");
    expect(form.getAttribute("aria-label")).toBe("f");
    form.requestSubmit();
    expect(submitted).toBe(1);
  });

  it("Form: fields inside see the form validation context", () => {
    const c = mount(() => (
      <Form validationErrors={{ a: "bad" }} validationBehavior="aria" render={(p) => <form {...(p as {})} />}>
        <TextField name="a">
          <Input />
          <FieldError />
        </TextField>
      </Form>
    ));
    expect(c.querySelector("form")!.hasAttribute("novalidate")).toBe(true);
    expect(c.textContent).toContain("bad");
  });

  it("FieldError renders the custom element while invalid", () => {
    const c = mount(() => (
      <Form validationErrors={{ a: "bad" }} validationBehavior="aria">
        <TextField name="a">
          <Input />
          <FieldError render={(p) => <div {...(p as {})} data-r="1" />} />
        </TextField>
      </Form>
    ));
    const el = c.querySelector("div[data-r='1']")!;
    expect(el.getAttribute("class")).toBe("rv-FieldError");
    expect(el.textContent).toBe("bad");
  });

  it("FieldError renders nothing while valid", () => {
    const c = mount(() => (
      <TextField>
        <Input />
        <FieldError render={(p) => <div {...(p as {})} data-r="1" />} />
      </TextField>
    ));
    expect(c.querySelector("[data-r]")).toBeNull();
  });

  it("ToggleButtonGroup", () => {
    const c = mount(() => (
      <ToggleButtonGroup selectionMode="single" render={(p, rp) => <section {...(p as {})} data-o={rp.orientation()} />}>
        <ToggleButton id="a">A</ToggleButton>
      </ToggleButtonGroup>
    ));
    const el = c.querySelector("section[data-o='horizontal']")!;
    expect(el.getAttribute("role")).toBe("radiogroup");
    expect(el.querySelector("button")).not.toBeNull();
  });
});

describe("render prop absent", () => {
  it("default elements unchanged", () => {
    const c = mount(() => (
      <div>
        <Input />
        <TextArea />
        <Group>g</Group>
        <Form>f</Form>
      </div>
    ));
    expect(c.querySelector("input.rv-Input")).not.toBeNull();
    expect(c.querySelector("textarea.rv-TextArea")).not.toBeNull();
    expect(c.querySelector("div.rv-Group")).not.toBeNull();
    expect(c.querySelector("form.rv-Form")).not.toBeNull();
  });
});
