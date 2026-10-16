import { signal } from "@rivetjs/reactivity";
import { GridList, GridListItem, type Key, type Selection } from "@rivetjs/cdk/grid-list";

export const head = { title: "GridList: selection and actions" };

const list = "grid content-start gap-0.5 rounded-lg border border-slate-200 p-1 outline-none";
const row =
  "cursor-default rounded-md px-2 py-1.5 outline-none data-[selected]:bg-sky-700 data-[selected]:text-white data-[disabled]:opacity-40 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";
const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].join(", ") || "none");

// #region demo
export default function Nature() {
  const toggled = signal<Selection>(new Set<Key>());
  const replaced = signal<Selection>(new Set<Key>());
  const action = signal("none");
  return (
    <section class="m-4 grid max-w-lg grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <GridList
        id="toggle"
        aria-label="Nature photos (toggle)"
        selectionMode="multiple"
        selectedKeys={toggled}
        onAction={(key) => action.set("toggle " + String(key))}
        class={list}
      >
        <GridListItem id="sunset" class={row}>
          Desert Sunset
        </GridListItem>
        <GridListItem id="trail" isDisabled class={row}>
          Hiking Trail
        </GridListItem>
        <GridListItem id="lion" class={row}>
          Lion
        </GridListItem>
        <GridListItem id="sunrise" class={row}>
          Mountain Sunrise
        </GridListItem>
      </GridList>
      <GridList
        id="replace"
        aria-label="Nature photos (replace)"
        selectionMode="multiple"
        selectionBehavior="replace"
        selectedKeys={replaced}
        onAction={(key) => action.set("replace " + String(key))}
        class={list}
      >
        <GridListItem id="sunset" class={row}>
          Desert Sunset
        </GridListItem>
        <GridListItem id="lion" class={row}>
          Lion
        </GridListItem>
        <GridListItem id="sunrise" class={row}>
          Mountain Sunrise
        </GridListItem>
      </GridList>
      <p id="toggle-selected">Selected: {show(toggled())}</p>
      <p id="replace-selected">Selected: {show(replaced())}</p>
      <p id="nature-action" class="col-span-2">
        Last action: {action()}
      </p>
    </section>
  );
}
// #endregion
