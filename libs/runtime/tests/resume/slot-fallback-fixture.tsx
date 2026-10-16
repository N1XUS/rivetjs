// Slot fallback fixture (`../resume-slot-fallback-browser.test.ts`): a user slot passed on through a `{children ?? <Default/>}`
// child expression into a component whose root Show renders nothing on the server and first switches on the client (ui
// ScrollArea Scrollbar → cdk Scrollbar, `hover` type); `.flip` switches the user part's own Show once it is inserted.
import { signal } from "@rivetjs/reactivity";
import { Provider, Show } from "@rivetjs/runtime/dom";
import { createContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";

const Ctx = createContext<string>("ctx", { id: "slot-ctx" });
function Inner(props: { visible: Signal<boolean>; children?: unknown }) {
  const children = props.children;
  return (
    <Show when={() => props.visible()}>
      {() => (
        <div class="bar">
          <Provider token={Ctx} value="v">
            {children}
          </Provider>
        </div>
      )}
    </Show>
  );
}
function Bar(props: { active: Signal<boolean>; visible: Signal<boolean>; children?: unknown }) {
  return <Show when={props.active}>{() => <Inner visible={props.visible}>{props.children}</Inner>}</Show>;
}
/** A user part whose root Show switches after it was inserted (cdk Thumb `Presence` `data-state`). */
function Knob(props: { on: Signal<boolean> }) {
  return (
    <Show when={props.on} fallback={<b class="user off">off</b>}>
      {() => <b class="user on">on</b>}
    </Show>
  );
}
function Thumb() {
  return <i class="thumb">t</i>;
}
function UiBar(props: { active: Signal<boolean>; visible: Signal<boolean>; children?: unknown }) {
  return (
    <Bar active={props.active} visible={props.visible}>
      {props.children ?? <Thumb />}
    </Bar>
  );
}

export function Page() {
  const active = signal(false);
  const visible = signal(true);
  const on = signal(true);
  return (
    <section>
      <UiBar active={active} visible={visible}>
        <Knob on={on} />
      </UiBar>
      <UiBar active={active} visible={visible} />
      <button class="go" onClick={() => active.set(!active())}>
        go
      </button>
      <button class="flip" onClick={() => on.set(!on())}>
        flip
      </button>
      <button class="hide" onClick={() => visible.update((_visible) => !_visible)}>
        hide
      </button>
    </section>
  );
}
