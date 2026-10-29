// DOM-target suite (happy-dom): `PromptInput` token input (Rivet-authored; feature set inspired by the "Token Input"
// section of HeroUI Pro's public PromptInput docs): a trigger opens the caret-anchored suggestions filtered by the query,
// arrows move the highlight (aria-activedescendant) while focus stays in the textarea, Enter / click insert a token with
// a trailing space (mirror pill, onChange segments), Backspace removes a token whole, Escape dismisses for the current
// trigger, blur closes, Enter without a menu submits the flattened text and clears an uncontrolled composer, Send follows
// the token text, `close()` hides until the next edit, Enter replayed in its input's task picks the first option.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { For } = await import("@rivetjs/runtime/dom");
const ui = await import("../src/components/prompt-input-tokens/index.ts");
const { PromptInput } = await import("../src/components/prompt-input/index.ts");
const { PromptInputTokenInput, PromptInputTokens, PromptInputTokenSuggestions, PromptInputTokenSuggestion, PromptInputToken, usePromptInputTokens } = ui;
type Segments = import("../src/components/prompt-input-tokens/index.ts").PromptSegment[];
const W = window as unknown as { KeyboardEvent: typeof KeyboardEvent; Event: typeof Event; FocusEvent: typeof FocusEvent; MouseEvent: typeof MouseEvent };
const flush = () => new Promise((r) => setTimeout(r, 20));

const type = (el: HTMLTextAreaElement, value: string, caret = value.length) => {
  el.value = value;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new W.Event("input", { bubbles: true }));
};
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  const event = new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  el.dispatchEvent(new W.KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true, ...init }));
  return event;
};
const focus = (el: HTMLTextAreaElement) => {
  el.focus();
  el.dispatchEvent(new W.FocusEvent("focus"));
};

const USERS = [
  { id: "u1", name: "ana" },
  { id: "u2", name: "bob" },
  { id: "u3", name: "bea" },
];

function setup(
  options: { onSubmit?: (text: string) => void; onChange?: (value: Segments) => void; expose?: (tokens: ReturnType<typeof usePromptInputTokens>) => void } = {},
) {
  const r = render(() => {
    const tokens = usePromptInputTokens({ triggers: ["@"], onChange: options.onChange });
    options.expose?.(tokens);
    const matches = () => USERS.filter((user) => user.name.startsWith(tokens.query().toLowerCase()));
    return (
      <PromptInput onSubmit={options.onSubmit}>
        <PromptInput.Shell>
          <PromptInputTokens tokens={tokens}>
            <PromptInput.Content>
              <PromptInputTokenInput aria-label="Prompt" />
            </PromptInput.Content>
            <PromptInputTokenSuggestions aria-label="People">
              <For each={matches} by={(user: (typeof USERS)[number]) => user.id}>
                {(user: () => (typeof USERS)[number]) => (
                  <PromptInputTokenSuggestion id={user().id} token={`@${user().name}`}>
                    {user().name}
                  </PromptInputTokenSuggestion>
                )}
              </For>
            </PromptInputTokenSuggestions>
          </PromptInputTokens>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    );
  });
  const textarea = r.container.querySelector("textarea")!;
  const listbox = r.container.querySelector("[role=listbox]") as HTMLElement;
  const send = r.container.querySelector("[data-slot=prompt-input-send]") as HTMLButtonElement;
  const mirror = r.container.querySelector("[data-slot=prompt-input-token-mirror]") as HTMLElement;
  return { r, textarea, listbox, send, mirror };
}

test("prompt-input tokens: exports", () => {
  // Named exports only: the compound stays token-free (zero-cost).
  assert.equal((PromptInput as unknown as Record<string, unknown>).TokenInput, undefined);
  assert.equal(typeof PromptInputTokenInput, "function");
  assert.equal(typeof PromptInputTokens, "function");
  assert.equal(typeof PromptInputTokenSuggestions, "function");
  assert.equal(typeof PromptInputTokenSuggestion, "function");
  assert.equal(typeof PromptInputToken, "function");
  assert.equal(typeof usePromptInputTokens, "function");
});

test("prompt-input tokens: trigger, filter, arrows, Enter inserts a token", async () => {
  const changes: Segments[] = [];
  const { r, textarea, listbox, send, mirror } = setup({ onChange: (value) => changes.push(value) });
  assert.equal(textarea.getAttribute("aria-autocomplete"), "list");
  assert.equal(textarea.getAttribute("aria-controls"), listbox.id);
  assert.equal(listbox.hidden, true);
  assert.equal(send.disabled, true);
  focus(textarea);
  type(textarea, "Ask @b");
  await flush();
  assert.equal(listbox.hidden, false);
  const options = () => Array.from(listbox.querySelectorAll("[role=option]")) as HTMLElement[];
  assert.deepEqual(
    options().map((o) => o.textContent),
    ["bob", "bea"],
  );
  assert.equal(textarea.getAttribute("aria-activedescendant"), options()[0]!.id);
  assert.equal(options()[0]!.getAttribute("aria-selected"), "true");
  // Arrows move the highlight; focus stays in the textarea.
  assert.equal(key(textarea, "ArrowDown").defaultPrevented, true);
  await flush();
  assert.equal(textarea.getAttribute("aria-activedescendant"), options()[1]!.id);
  assert.equal(options()[1]!.getAttribute("data-focused"), "true");
  key(textarea, "ArrowDown");
  await flush();
  assert.equal(textarea.getAttribute("aria-activedescendant"), options()[0]!.id);
  key(textarea, "ArrowUp");
  await flush();
  // Enter picks the highlighted option (bea), not submit.
  assert.equal(key(textarea, "Enter").defaultPrevented, true);
  await flush();
  assert.equal(textarea.value, "Ask @bea ");
  assert.equal(textarea.selectionStart, 9);
  assert.equal(listbox.hidden, true);
  assert.deepEqual(changes.at(-1), [
    { type: "text", text: "Ask " },
    { type: "token", text: "@bea", value: "u3", trigger: "@" },
    { type: "text", text: " " },
  ]);
  const pill = mirror.querySelector(".prompt-input__token") as HTMLElement;
  assert.equal(pill.textContent, "@bea");
  assert.equal(pill.getAttribute("data-token"), "@");
  assert.equal(pill.getAttribute("data-value"), "u3");
  assert.equal(mirror.textContent, "Ask @bea ​");
  assert.equal(send.disabled, false);
  r.unmount();
});

test("prompt-input tokens: Backspace removes a token whole, arrows step over it", async () => {
  const { r, textarea, mirror } = setup();
  focus(textarea);
  type(textarea, "Hi @a");
  await flush();
  key(textarea, "Enter");
  await flush();
  assert.equal(textarea.value, "Hi @ana ");
  // Caret right after the token.
  textarea.setSelectionRange(7, 7);
  key(textarea, "ArrowLeft");
  assert.equal(textarea.selectionStart, 3);
  key(textarea, "ArrowRight");
  assert.equal(textarea.selectionStart, 7);
  assert.equal(key(textarea, "Backspace").defaultPrevented, true);
  await flush();
  assert.equal(textarea.value, "Hi  ");
  assert.equal(textarea.selectionStart, 3);
  assert.equal(mirror.querySelector(".prompt-input__token"), null);
  // A plain character: native Backspace.
  assert.equal(key(textarea, "Backspace").defaultPrevented, false);
  r.unmount();
});

test("prompt-input tokens: click inserts, Escape dismisses, blur closes, close() until the next edit", async () => {
  let tokens!: ReturnType<typeof usePromptInputTokens>;
  const { r, textarea, listbox } = setup({ expose: (t) => (tokens = t) });
  focus(textarea);
  type(textarea, "@");
  await flush();
  assert.equal(listbox.hidden, false);
  assert.equal(tokens.trigger(), "@");
  assert.equal(tokens.query(), "");
  // Escape dismisses for this trigger, also while typing on.
  assert.equal(key(textarea, "Escape").defaultPrevented, true);
  await flush();
  assert.equal(listbox.hidden, true);
  type(textarea, "@b");
  await flush();
  assert.equal(listbox.hidden, true);
  // A new trigger opens again.
  type(textarea, "@b @");
  await flush();
  assert.equal(listbox.hidden, false);
  // close(): hidden until the next edit.
  tokens.close();
  await flush();
  assert.equal(listbox.hidden, true);
  type(textarea, "@b @a");
  await flush();
  assert.equal(listbox.hidden, false);
  // Blur closes.
  textarea.dispatchEvent(new W.FocusEvent("blur"));
  await flush();
  assert.equal(listbox.hidden, true);
  focus(textarea);
  await flush();
  assert.equal(listbox.hidden, false);
  // Click on an option inserts its token.
  (listbox.querySelector("[role=option]") as HTMLElement).dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true }));
  await flush();
  assert.equal(textarea.value, "@b @ana ");
  r.unmount();
});

test("prompt-input tokens: Enter submits the flattened text and clears", async () => {
  const submitted: string[] = [];
  let tokens!: ReturnType<typeof usePromptInputTokens>;
  const { r, textarea, send, mirror } = setup({ onSubmit: (text) => submitted.push(text), expose: (t) => (tokens = t) });
  focus(textarea);
  type(textarea, "Ping @b");
  await flush();
  key(textarea, "Enter");
  await flush();
  type(textarea, "Ping @bob now", 13);
  await flush();
  assert.equal(tokens.value().length, 3);
  assert.equal(key(textarea, "Enter", { shiftKey: true }).defaultPrevented, false);
  assert.equal(key(textarea, "Enter").defaultPrevented, true);
  await flush();
  assert.deepEqual(submitted, ["Ping @bob now"]);
  assert.equal(textarea.value, "");
  assert.deepEqual(tokens.value(), []);
  assert.equal(mirror.querySelector(".prompt-input__token"), null);
  assert.equal(send.disabled, true);
  r.unmount();
});

test("prompt-input tokens: Enter in the same task as its input picks the first option (cold replay)", async () => {
  const submitted: string[] = [];
  const { r, textarea } = setup({ onSubmit: (text) => submitted.push(text) });
  focus(textarea);
  type(textarea, "Hi @bo");
  // No await: the highlight has not settled yet.
  assert.equal(key(textarea, "Enter").defaultPrevented, true);
  await flush();
  assert.equal(textarea.value, "Hi @bob ");
  assert.deepEqual(submitted, []);
  r.unmount();
});
