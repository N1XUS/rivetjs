// LIVE-PROPS P3 fixture (`../resume-live-props-browser.test.ts`): component calls with dynamic props on a resumed
// page update in place — the component never re-runs, its server nodes stay — through `_rProps` recipes, props
// helpers' forwards (`splitProps`) and nested forwarding. Each component counts its runs in `__runs` (browser runs
// must stay 0).
import { signal } from "@rivetjs/reactivity";
import { splitProps } from "@rivetjs/runtime/props";

const ran = (name: string) => {
  const runs = ((globalThis as { __runs?: Record<string, number> }).__runs ??= {});
  runs[name] = (runs[name] ?? 0) + 1;
};

/** Attribute + text bindings over the props (calls: `_rAttr` / `_rBind` sites). */
function Leaf(props: { cls?: string; label?: string }) {
  ran("Leaf");
  return <p class={"leaf " + String(props.cls)}>{String(props.label)}</p>;
}

/** `splitProps` forwarding into a native spread (cdk / ui shape); the lazy children stay their own site. */
function Box(props: { tone?: string; children?: unknown }) {
  ran("Box");
  const [local, rest] = splitProps(props, ["tone"]);
  return <div {...rest} class={"box " + String(local.tone)} />;
}

/** A component forwarding a derived prop to another component (nested recipe). */
function Nested(props: { cls?: string; label?: string }) {
  ran("Nested");
  return <Leaf cls={String(props.cls) + "!"} label={props.label} />;
}

export function LiveProps(props: { id: string }) {
  const v = signal("a");
  return (
    <section id={props.id}>
      <button class="next" onClick={() => v.set(v() === "a" ? "b" : "a")}>
        next
      </button>
      <div class="direct">
        <Leaf cls={v()} label={"L" + v()} />
      </div>
      <div class="forward">
        <Box tone={v()}>
          <span class="kid">kid</span>
        </Box>
      </div>
      <div class="nested">
        <Nested cls={v()} label={"N" + v()} />
      </div>
    </section>
  );
}
