// iOS Safari touch presses on collection items (THEME-IOS 2026-10-27). A tap on iOS fires pointerover / pointerdown
// (touch, real size), then a ZERO-SIZE pointerup (width = height = 0), then mousedown / mouseup and a `click` that is a
// PointerEvent with pointerType "mouse" (1×1, detail 1) — recorded in the iOS 26.4 simulator (Safari, real HID taps).
// `isVirtualPointerEvent` reads a 0×0 pointer as a screen reader: a pointerup classified that way dropped the press, so
// a tapped menu item closed its menu without selecting (docs theme menu: the theme never switched on iPhones).
// Chromium / Playwright WebKit taps report a sized pointerup, so the events are dispatched here as iOS sends them.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, waitFor, within } from "@testing-library/dom";
import { Button } from "../button/index.tsx";
import { Popover } from "../popover/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { Menu, MenuItem, MenuTrigger, type Selection } from "../menu/index.tsx";

afterEach(cleanup);

const screen = () => within(document.body);

/** One iOS Safari tap on `el`, event for event (pointer id, sizes and pointer types as iOS 26.4 reports them). */
function iosTap(el: Element): void {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  const touch = { ...at, pointerId: -229701493, pointerType: "touch", isPrimary: true, width: 40, height: 40, pressure: 0 };
  el.dispatchEvent(new PointerEvent("pointerover", { ...touch, button: -1, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerdown", { ...touch, button: 0, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerup", { ...touch, width: 0, height: 0, button: 0, buttons: 0 }));
  el.dispatchEvent(new PointerEvent("pointerout", { ...touch, width: 0, height: 0, button: -1, buttons: 0 }));
  el.dispatchEvent(new MouseEvent("mouseover", at));
  el.dispatchEvent(new MouseEvent("mousedown", { ...at, button: 0, buttons: 1, detail: 1 }));
  el.dispatchEvent(new MouseEvent("mouseup", { ...at, button: 0, detail: 1 }));
  el.dispatchEvent(
    new PointerEvent("click", { ...at, pointerId: touch.pointerId, pointerType: "mouse", width: 1, height: 1, pressure: 0, button: 0, detail: 1 }),
  );
}

describe("iOS Safari touch presses (zero-size pointerup)", () => {
  it("a tapped single-select menu item selects before the menu closes", async () => {
    const choice = signal<Selection>(new Set(["system"]));
    const onSelectionChange = vi.fn((keys: Selection) => choice.set(keys));
    const onAction = vi.fn();
    render(() => (
      <MenuTrigger>
        <Button aria-label="Theme">Theme</Button>
        <Popover>
          <Menu
            aria-label="Theme"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={choice}
            onSelectionChange={onSelectionChange}
            onAction={onAction}
          >
            <MenuItem id="system">System</MenuItem>
            <MenuItem id="light">Light</MenuItem>
            <MenuItem id="dark">Dark</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    ));
    iosTap(screen().getByRole("button", { name: "Theme" }));
    flush();
    const dark = await screen().findByRole("menuitemradio", { name: "Dark" });
    iosTap(dark);
    flush();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect([...(onSelectionChange.mock.calls[0]![0] as Set<string>)]).toEqual(["dark"]);
    expect(onAction).toHaveBeenCalledWith("dark");
    await waitFor(() => expect(screen().queryByRole("menu")).toBeNull());
  });

  it("a tapped listbox item reports press up with the touch pointer type and selects", () => {
    const onPressUp = vi.fn();
    const onSelectionChange = vi.fn();
    render(() => (
      <ListBox aria-label="Animals" selectionMode="single" onSelectionChange={onSelectionChange}>
        <ListBoxItem id="cat" onPressUp={onPressUp}>
          Cat
        </ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
      </ListBox>
    ));
    const cat = screen().getByRole("option", { name: "Cat" });
    iosTap(cat);
    flush();
    expect(onPressUp).toHaveBeenCalledTimes(1);
    expect(onPressUp.mock.calls[0]![0]).toMatchObject({ pointerType: "touch" });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(cat).toHaveAttribute("aria-selected", "true");
  });

  it("a zero-size pointer press without a sized pointerdown stays virtual (VoiceOver): the click selects", () => {
    const onSelectionChange = vi.fn();
    render(() => (
      <ListBox aria-label="Animals" selectionMode="single" onSelectionChange={onSelectionChange}>
        <ListBoxItem id="cat">Cat</ListBoxItem>
      </ListBox>
    ));
    const cat = screen().getByRole("option", { name: "Cat" });
    const virtual = { bubbles: true, cancelable: true, pointerId: 3, pointerType: "touch", width: 0, height: 0, button: 0 };
    cat.dispatchEvent(new PointerEvent("pointerdown", virtual));
    cat.dispatchEvent(new PointerEvent("pointerup", virtual));
    fireEvent.click(cat, { detail: 1 });
    flush();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(cat).toHaveAttribute("aria-selected", "true");
  });
});
