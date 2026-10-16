import { navigationKeys, nextIndex, typeahead } from "@rivetjs/cdk/keys";
import { roveFocus } from "@rivetjs/cdk/focus";

export const head = { title: "List with nextIndex and typeahead" };

const countries = ["Austria", "Belgium", "Croatia", "Cyprus", "Denmark", "Estonia", "Finland", "France", "Germany", "Italy"];

// #region demo
const options = { orientation: "vertical", wrap: false, pageSize: 3 } as const;
/** Typeahead buffers are kept per owner object: use one per widget. */
const owner = {};

function onKeyDown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=option]")];
  const from = items.indexOf(event.target as HTMLElement);
  const isDisabled = (i: number) => items[i]!.getAttribute("aria-disabled") === "true";
  let to = nextIndex(items.length, from, event.key, { ...options, isDisabled });
  if (to === null && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const found = typeahead(
      owner,
      items.map((item) => item.textContent!),
      from,
      event.key,
      event.timeStamp,
      isDisabled,
    );
    to = found < 0 ? null : found;
  }
  if (to === null) return;
  event.preventDefault();
  roveFocus(items, items[to]!);
}

export default function List() {
  return (
    <section class="m-4 max-w-xs text-sm">
      <div
        id="countries"
        role="listbox"
        aria-label="Country"
        data-rk={navigationKeys(options)}
        onKeyDown={onKeyDown}
        class="grid rounded border border-slate-300 p-1"
      >
        {countries.map((country, i) => (
          <div
            role="option"
            id={"c-" + country.toLowerCase()}
            tabIndex={i === 0 ? 0 : -1}
            aria-selected="false"
            aria-disabled={country === "Croatia" ? "true" : undefined}
            class="rounded px-2 py-0.5 outline-none focus:bg-teal-600 focus:text-white aria-disabled:opacity-40"
          >
            {country}
          </div>
        ))}
      </div>
    </section>
  );
}
// #endregion
