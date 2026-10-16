// RAC `render` prop (react-aria-components DOMRenderProps) on the core parts.
// Ports RAC "should support custom render function" (Button, Link, Separator, Header, Label, Text, Heading, Keyboard tests):
// the returned element replaces the default one and keeps the part's attributes. Rivet: render props are accessors.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { signal } from "@rivetjs/reactivity";
import { Button } from "../button/index.tsx";
import { Link } from "../link/index.tsx";
import { Separator } from "../separator/index.tsx";
import { Header } from "../header/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { Heading } from "../heading/index.tsx";
import { Keyboard } from "../keyboard/index.tsx";

afterEach(cleanup);
const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;

describe("render prop", () => {
  it("Button: replaces <button>, keeps data/aria attrs, receives renderProps accessors", () => {
    const seen: boolean[] = [];
    const c = mount(() => (
      <Button
        data-testid="b"
        aria-label="lbl"
        render={(props, rp) => {
          seen.push(rp.isPressed());
          return <a {...(props as {})} href="#x" />;
        }}
      >
        go
      </Button>
    ));
    const el = c.querySelector("[data-testid=b]")!;
    expect(el.tagName).toBe("A");
    expect(el.textContent).toBe("go");
    expect(el.getAttribute("aria-label")).toBe("lbl");
    expect(el.getAttribute("class")).toBe("rv-Button");
    expect(c.querySelector("button")).toBeNull();
    expect(seen).toEqual([false]);
  });

  it("Button: ref reaches the rendered element", () => {
    let got: Element | undefined;
    const c = mount(() => (
      <Button ref={(e: HTMLElement) => (got = e)} render={(props) => <span {...(props as {})} />}>
        x
      </Button>
    ));
    expect(got).toBe(c.querySelector("span"));
  });

  it("Button: handlers run on the rendered element; isDisabled sets data-disabled", () => {
    let pressed = 0;
    const c = mount(() => (
      <Button onPress={() => pressed++} isDisabled={false} render={(props) => <div {...(props as {})} />}>
        x
      </Button>
    ));
    const el = c.querySelector("div")!;
    el.click();
    expect(pressed).toBe(1);
  });

  it("Link: <a> replaced keeps href / data-* state attrs", () => {
    const c = mount(() => (
      <Link href="/z" aria-current="page" render={(props, rp) => <b {...(props as {})} data-cur={String(rp.isCurrent())} />}>
        l
      </Link>
    ));
    const el = c.querySelector("b")!;
    expect(el.getAttribute("href")).toBe("/z");
    expect(el.getAttribute("data-cur")).toBe("true");
    expect(el.getAttribute("data-current")).toBe("true");
    expect(el.textContent).toBe("l");
  });

  it("Link: disabled link renders the span branch through render", () => {
    const c = mount(() => (
      <Link isDisabled render={(props) => <i {...(props as {})} />}>
        l
      </Link>
    ));
    expect(c.querySelector("i")!.getAttribute("role")).toBe("link");
  });

  it("Separator", () => {
    const c = mount(() => <Separator render={(props) => <hr {...(props as {})} data-r="1" />} />);
    expect(c.querySelector("hr[data-r='1']")).not.toBeNull();
  });

  it("Header", () => {
    const c = mount(() => (
      <Header data-testid="h" render={(p) => <h4 {...(p as {})} />}>
        t
      </Header>
    ));
    const el = c.querySelector("[data-testid=h]")!;
    expect(el.tagName).toBe("H4");
    expect(el.textContent).toBe("t");
  });

  it("Label", () => {
    const c = mount(() => <Label render={(p) => <span {...(p as {})} data-r="1" />}>n</Label>);
    const el = c.querySelector("span[data-r='1']")!;
    expect(el.textContent).toBe("n");
    expect(el.className).toBe("rv-Label");
  });

  it("Text", () => {
    const c = mount(() => <Text render={(p) => <em {...(p as {})} />}>t</Text>);
    expect(c.querySelector("em")!.textContent).toBe("t");
  });

  it("Heading", () => {
    const c = mount(() => (
      <Heading level={2} render={(p) => <div {...(p as {})} role="heading" />}>
        h
      </Heading>
    ));
    const el = c.querySelector("div[role=heading]")!;
    expect(el.textContent).toBe("h");
    expect(c.querySelector("h2")).toBeNull();
  });

  it("Keyboard", () => {
    const c = mount(() => <Keyboard render={(p) => <span {...(p as {})} data-r="1" />}>k</Keyboard>);
    const el = c.querySelector("span[data-r='1']")!;
    expect(el.textContent).toBe("k");
    expect(el.getAttribute("dir")).toBe("ltr");
  });

  it("Keyboard without class: render and default agree", () => {
    const a = mount(() => <Keyboard>k</Keyboard>).querySelector("kbd")!;
    const b = mount(() => <Keyboard render={(p) => <kbd {...(p as {})} />}>k</Keyboard>).querySelector("kbd")!;
    expect(b.getAttribute("class")).toBe(a.getAttribute("class"));
  });

  it("without render the default elements are unchanged", () => {
    const c = mount(() => (
      <div>
        <Button>b</Button>
        <Link href="/">l</Link>
        <Heading>h</Heading>
      </div>
    ));
    expect(c.querySelector("button")!.textContent).toBe("b");
    expect(c.querySelector("a")!.getAttribute("href")).toBe("/");
    expect(c.querySelector("h3")!.textContent).toBe("h");
  });
});

describe("Button render parity and watchers", () => {
  const attrsOf = (el: Element) => Object.fromEntries([...el.attributes].filter((a) => a.name !== "id").map((a) => [a.name, a.value]));
  const states: [string, Record<string, unknown>][] = [
    ["plain", {}],
    ["disabled", { isDisabled: true }],
    ["pending", { isPending: true }],
    ["aria", { "aria-label": "L", "aria-expanded": true, "aria-haspopup": "dialog", "aria-controls": "x", "aria-pressed": false, excludeFromTabOrder: true }],
    ["submit pending", { type: "submit", isPending: true }],
    ["data+form", { name: "n", value: "v", "data-x": "1", slot: undefined, autoFocus: false }],
  ];
  for (const [name, extra] of states)
    it(`render attrs equal the default <button> attrs: ${name}`, () => {
      const a = mount(() => <Button {...(extra as {})}>t</Button>).querySelector("button")!;
      const b = mount(() => (
        <Button {...(extra as {})} render={(p) => <button {...(p as {})} />}>
          t
        </Button>
      )).querySelector("button")!;
      expect(attrsOf(b)).toEqual(attrsOf(a));
    });

  it("pressed state: data-pressed equal while pressed", async () => {
    const mk = (r: boolean) =>
      mount(() => (
        <Button {...(r ? { render: (p: unknown) => <button {...(p as {})} /> } : {})} onPress={() => {}}>
          t
        </Button>
      )).querySelector("button")!;
    const a = mk(false);
    const b = mk(true);
    for (const el of [a, b]) el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse", isPrimary: true }));
    expect(attrsOf(b)).toEqual(attrsOf(a));
  });

  it("render Button: flipping isDisabled while pressed cancels the press", () => {
    const disabled = signal(false);
    const events: string[] = [];
    const el = mount(() => (
      <Button
        isDisabled={disabled}
        onPressStart={() => events.push("start")}
        onPressEnd={() => events.push("end")}
        onPressChange={(p) => events.push("change:" + p)}
        render={(p) => <button {...(p as {})} />}
      >
        t
      </Button>
    )).querySelector("button")!;
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse", isPrimary: true }));
    disabled.set(true);
    expect(events).toEqual(["start", "change:true", "end", "change:false"]);
  });
});
