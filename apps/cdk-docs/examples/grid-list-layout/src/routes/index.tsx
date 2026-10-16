import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";

export const head = { title: "GridList: layouts" };

const photos = [
  { id: "sunset", title: "Desert Sunset" },
  { id: "trail", title: "Hiking Trail" },
  { id: "lion", title: "Lion" },
  { id: "sunrise", title: "Mountain Sunrise" },
  { id: "giraffe", title: "Giraffe tongue" },
  { id: "golden", title: "Golden Hour" },
];

const card =
  "grid h-14 cursor-default place-items-center rounded-md border border-slate-200 px-2 text-center text-xs outline-none data-[selected]:border-sky-600 data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

// #region demo
export default function Layouts() {
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <GridList
        id="grid-photos"
        aria-label="Photos (grid)"
        layout="grid"
        items={photos}
        selectionMode="multiple"
        class="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(photo: (typeof photos)[number]) => (
          <GridListItem textValue={photo.title} class={card}>
            {photo.title}
          </GridListItem>
        )}
      </GridList>
      <GridList
        id="strip"
        aria-label="Photos (horizontal)"
        layout="grid"
        orientation="horizontal"
        items={photos}
        selectionMode="single"
        class="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(photo: (typeof photos)[number]) => (
          <GridListItem textValue={photo.title} class={card + " w-24 shrink-0"}>
            {photo.title}
          </GridListItem>
        )}
      </GridList>
    </section>
  );
}
// #endregion
