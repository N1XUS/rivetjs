// FocusScope restore target by id (Rivet addition, `focus-scope.tsx` `current()`): a resumed page re-creates the
// region holding the trigger, so the scope restores to the same-id replacement. Only a replacement made while the
// scope was mounted counts: when the trigger and the scope leave together (client navigation with a popover open,
// a test's cleanup) the next page's element with the same id is no restore target — React Aria restores only to the
// connected original (RESUME-BUGS #6, 2026-10-09).
import { afterEach, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { FocusScope } from "../focus/focus-scope.tsx";

afterEach(() => cleanup());
const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

it("restores to the same-id replacement of the trigger made while the scope was open", async () => {
  const gen = signal(1);
  const open = signal(false);
  render(() => (
    <div>
      <Show when={gen()} keyed>
        {(g: () => number) => <button id="trigger">trigger {g()}</button>}
      </Show>
      <Show when={open()}>
        <FocusScope restoreFocus autoFocus>
          <input id="inside" />
        </FocusScope>
      </Show>
    </div>
  ));
  await flush();
  (document.getElementById("trigger") as HTMLElement).focus();
  open.set(true);
  await flush();
  expect(document.activeElement?.id).toBe("inside");
  gen.set(2); // the trigger's region is re-created (a resumed page's first change)
  await flush();
  open.set(false);
  await flush();
  await frames();
  expect(document.activeElement?.textContent).toBe("trigger 2");
});

it("does not restore to a same-id element of the next page (trigger and scope removed together)", async () => {
  const page = signal("a");
  const open = signal(false);
  render(() => (
    <div>
      <Show when={page() === "a"} fallback={<button id="trigger">page b</button>}>
        <button id="trigger">page a</button>
        <Show when={open()}>
          <FocusScope restoreFocus autoFocus>
            <input id="inside" />
          </FocusScope>
        </Show>
      </Show>
    </div>
  ));
  await flush();
  (document.getElementById("trigger") as HTMLElement).focus();
  open.set(true);
  await flush();
  expect(document.activeElement?.id).toBe("inside");
  page.set("b"); // client navigation with the popover open
  await flush();
  await frames();
  expect(document.getElementById("trigger")?.textContent).toBe("page b");
  expect(document.activeElement).toBe(document.body);
});
