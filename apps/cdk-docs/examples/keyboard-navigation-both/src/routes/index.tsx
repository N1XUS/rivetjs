import { signal } from "@rivetjs/reactivity";
import { navigationKeys, nextIndex } from "@rivetjs/cdk/keys";
import { roveFocus } from "@rivetjs/cdk/focus";

export const head = { title: "Both orientations" };

const colors = ["red", "green", "blue"];

// #region demo
const options = { orientation: "both", wrap: true, homeEnd: false } as const;

function move(event: KeyboardEvent & { currentTarget: HTMLElement }) {
  const items = [...event.currentTarget.querySelectorAll("button")];
  const to = nextIndex(items.length, items.indexOf(event.target as HTMLButtonElement), event.key, options);
  if (to === null) return;
  event.preventDefault();
  roveFocus(items, items[to]!);
}

export default function Both() {
  const picked = signal("none");
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div id="swatches" role="radiogroup" aria-label="Color" data-rk={navigationKeys(options)} onKeyDown={move} class="flex gap-2">
        {colors.map((color, i) => (
          <button
            type="button"
            role="radio"
            id={"sw-" + color}
            aria-checked={picked() === color ? "true" : "false"}
            tabIndex={i === 0 ? 0 : -1}
            onClick={() => picked.set(color)}
            class="size-8 rounded-full border-2 border-white ring-1 ring-slate-300 focus:ring-2 focus:ring-slate-900 aria-checked:ring-teal-600"
            style={{ background: color }}
            aria-label={color}
          />
        ))}
      </div>
      <p>
        Picked: <output id="sw-value">{picked()}</output>
      </p>
    </section>
  );
}
// #endregion
