// Ported from angular/components src/cdk/bidi/dir.ts (MIT, © Google LLC).
// `<Dir dir="rtl">`: the `[dir]` directive as a wrapper element. Renders `dir` exactly as given
// (`auto` stays `auto`) and provides its normalized direction as the subtree's `Directionality`.
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Provider } from "@rivetjs/runtime/dom";
import { computed, effect, untrack } from "@rivetjs/reactivity";
import { _resolveDirectionality, DirectionalityContext, type Direction, type Directionality } from "./index.ts";
import { renderSlot } from "@rivetjs/runtime/slot";

export interface DirProps {
  /** `"ltr"`, `"rtl"` or `"auto"` (case-insensitive); an accessor for a changing value. */
  dir: string | (() => string);
  /**
   * Angular `(dirChange)`: called when the normalized direction changes after the first render.
   * Client-rendered trees only — on a resumed page no component code runs, so read the
   * `Directionality` signal (`injectDirectionality().valueSignal`) in a binding instead.
   */
  onDirChange?: (dir: Direction) => void;
  /** Element to render (default `div`). */
  as?: "div" | "span" | "section";
  class?: string;
  id?: string;
  /**
   * Content. Plain JSX children are lazy (a compiler slot rendered inside the provider), so
   * descendants that read the `Directionality` (`injectDirectionality()`) see it; a render function
   * `{() => <Child />}` works too.
   */
  children?: Content | (() => Content);
}

export function Dir(props: DirProps) {
  const source = props.dir;
  const rawDir = typeof source === "function" ? source : () => source;
  const valueSignal = computed(() => _resolveDirectionality(rawDir()));
  const state: Directionality = { valueSignal, rawDir };
  const onDirChange = props.onDirChange;
  if (onDirChange) {
    let previous = untrack(valueSignal);
    effect(() => {
      const next = valueSignal();
      if (next !== previous) {
        previous = next;
        untrack(() => onDirChange(next));
      }
    });
  }
  const children = props.children;
  const content = (
    <Provider token={DirectionalityContext} value={state}>
      {renderSlot(children)}
    </Provider>
  );
  if (props.as === "span")
    return (
      <span id={props.id} class={props.class} dir={rawDir() as "auto"}>
        {content}
      </span>
    );
  if (props.as === "section")
    return (
      <section id={props.id} class={props.class} dir={rawDir() as "auto"}>
        {content}
      </section>
    );
  return (
    <div id={props.id} class={props.class} dir={rawDir() as "auto"}>
      {content}
    </div>
  );
}
