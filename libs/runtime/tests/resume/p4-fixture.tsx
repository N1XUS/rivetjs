// Lane LIVE-PROPS P4 fixture (`../resume-p4-browser.test.ts`): one resumable page per case (a failing server render of one
// case leaves the others testable). Each button toggles a signal; the case's output must follow on the resumed page.
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { Provider, Show, ref } from "@rivetjs/runtime/dom";
import { splitProps } from "@rivetjs/runtime/props";
import { resumableContext } from "@rivetjs/runtime/resume-format";

/** Gap 3: a `ref()` object reaching the element only through a spread (`dom.*` tags). */
const Tag = (props: Record<string, unknown>) => <div {...props} />;
export function SpreadRef() {
  const r = ref<HTMLDivElement>();
  return (
    <section>
      <Tag id="target" ref={r} />
      <button class="go" onClick={() => (r()!.dataset.hit = "yes")}>
        go
      </button>
    </section>
  );
}

/** Gap 1: a lone identifier spread of a `splitProps` rest over live props (ui radix Avatar `<span {...rest}>`). */
function Lone(props: { title?: string; tone?: string }) {
  const [, rest] = splitProps(props, ["tone"]);
  return <span {...rest} />;
}
export function LoneSpread() {
  const v = signal("a");
  return (
    <section>
      <Lone title={v()} tone="t" />
      <button class="go" onClick={() => v.set(v() === "a" ? "b" : "a")}>
        go
      </button>
    </section>
  );
}

/** Gap 2a: a component-local const arrow escaping as a value through a conditional (ui Button `isDisabled`). */
function Hit(props: { read: (() => string) | string }) {
  const out = signal("");
  return (
    <button class="go" onClick={() => out.set(typeof props.read === "function" ? props.read() : props.read)}>
      {out()}
    </button>
  );
}
export function ConstArrow(props: { live: boolean }) {
  const v = signal("x");
  const read = () => v() + "!";
  const value = props.live ? read : read();
  return <Hit read={value} />;
}

/** Gap 2b: an inline arrow passed as a call argument to a local helper returning a closure over it (ui `cdkClass`). */
function plus(compute: () => number) {
  return () => compute() + 1;
}
export function CallArg() {
  const n = signal(1);
  const next = plus(() => n() * 10);
  const out = signal(0);
  return (
    <button class="go" onClick={() => out.set(next())}>
      {out()}
    </button>
  );
}

/** Gap 2c: a getter object literal in a conditional initializer branch (ui ButtonGroup context value): only a framework
 * `Provider` receives it, a consumer in another component captures the context value. */
const Ctx = createContext<{ x: string }>({ x: "none" });
function Reader() {
  const ctx = useContext(Ctx);
  return <p class="out">{String(ctx.x)}</p>;
}
export function CondGetters(props: { live: boolean }) {
  const v = signal("a");
  const value = props.live
    ? {
        get x() {
          return v();
        },
      }
    : { x: "static" };
  return (
    <Provider token={Ctx} value={value}>
      <Reader />
      <button class="go" onClick={() => v.set(v() === "a" ? "b" : "a")}>
        go
      </button>
    </Provider>
  );
}

/** Gap 6 (ui AvatarGroup shape): children render through a component-level `Show` whose `when` reads the group's live
 * `max` through a resumable context (ui Avatar `<Show when={() => group.isVisible(id)}>`). */
interface Group {
  visible(index: number): boolean;
}
const GroupCtx = resumableContext(createContext<Group | null>(null, { id: "p4-group" }));
function Item(props: { name: string; index: number }) {
  const group = useContext(GroupCtx)!;
  return <Show when={() => group.visible(props.index)}>{() => <i class={"item " + props.name}>{props.name}</i>}</Show>;
}
function Grouped(props: { max: number; children?: unknown }) {
  const value: Group = { visible: (index: number) => index < props.max };
  return (
    <Provider token={GroupCtx} value={value}>
      <div class="group">{props.children}</div>
    </Provider>
  );
}
const NAMES = ["a", "b", "c"];
export function Groups() {
  const max = signal(2);
  return (
    <section>
      <Grouped max={max()}>
        {NAMES.map((name, index) => (
          <Item name={name} index={index} />
        ))}
      </Grouped>
      <button class="go" onClick={() => max.set(max() === 2 ? 3 : 2)}>
        go
      </button>
    </section>
  );
}
