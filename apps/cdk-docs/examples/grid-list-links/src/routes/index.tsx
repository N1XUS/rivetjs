import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";

export const head = { title: "GridList: links" };

const row =
  "flex cursor-pointer justify-between rounded-md px-2 py-1.5 outline-none data-[hovered]:bg-slate-50 data-[selected]:bg-sky-700 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

// #region demo
export default function Bookmarks() {
  return (
    <GridList
      id="bookmarks"
      aria-label="Bookmarks"
      selectionMode="multiple"
      selectionBehavior="replace"
      class="m-4 grid max-w-sm gap-0.5 rounded-lg border border-slate-200 p-1 text-sm outline-none"
    >
      <GridListItem id="adobe" href="https://adobe.com/" target="_blank" class={row}>
        Adobe <span class="opacity-60">adobe.com</span>
      </GridListItem>
      <GridListItem id="google" href="https://google.com/" target="_blank" class={row}>
        Google <span class="opacity-60">google.com</span>
      </GridListItem>
      <GridListItem id="nyt" href="https://nytimes.com/" target="_blank" class={row}>
        New York Times <span class="opacity-60">nytimes.com</span>
      </GridListItem>
    </GridList>
  );
}
// #endregion
