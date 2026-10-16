import { computed, signal } from "@rivetjs/reactivity";
import { ChevronUp } from "lucide";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import type { SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Table with Tailwind" };

interface Track {
  id: string;
  title: string;
  artist: string;
  length: string;
}

const tracks: Track[] = [
  { id: "blue", title: "Blue in Green", artist: "Miles Davis", length: "5:37" },
  { id: "naima", title: "Naima", artist: "John Coltrane", length: "4:21" },
  { id: "peace", title: "Peace Piece", artist: "Bill Evans", length: "6:42" },
  { id: "take5", title: "Take Five", artist: "Dave Brubeck", length: "5:24" },
];

// #region demo
export default function Tracks() {
  const sort = signal<SortDescriptor | null>({ column: "title", direction: "ascending" });
  const sorted = computed(() => {
    const s = sort();
    if (!s) return tracks;
    const key = s.column as keyof Track;
    return tracks.toSorted((a, b) => (a[key] < b[key] ? -1 : 1) * (s.direction === "descending" ? -1 : 1));
  });
  return (
    <div class="m-4 max-w-lg overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <Table
        id="tracks"
        aria-label="Tracks"
        selectionMode="multiple"
        sortDescriptor={sort}
        class={({ isFocusVisible }) => `w-full border-collapse text-sm outline-none ${isFocusVisible() ? "ring-2 ring-inset ring-emerald-500" : ""}`}
      >
        <TableHeader class="bg-slate-50 text-slate-600">
          <Column
            id="title"
            isRowHeader
            allowsSorting
            class={({ isFocusVisible, sortDirection }) =>
              `cursor-pointer px-3 py-2 text-left font-semibold outline-none ${sortDirection() ? "text-emerald-700" : ""} ${isFocusVisible() ? "ring-2 ring-inset ring-emerald-500" : ""}`
            }
          >
            {({ sortDirection }) => (
              <span class="flex items-center gap-1">
                Title
                <Icon icon={ChevronUp} size={14} class={sortDirection() === "descending" ? "rotate-180" : sortDirection() ? "" : "invisible"} />
              </span>
            )}
          </Column>
          <Column id="artist" class="px-3 py-2 text-left font-semibold">
            Artist
          </Column>
          <Column id="length" class="px-3 py-2 text-right font-semibold">
            Length
          </Column>
        </TableHeader>
        <TableBody items={sorted}>
          {(track: Track) => (
            <Row
              class={({ isSelected, isFocusVisible }) =>
                `cursor-default border-t border-slate-100 outline-none ${isSelected() ? "bg-emerald-600 text-white" : "hover:bg-slate-50"} ${
                  isFocusVisible() ? "ring-2 ring-inset ring-emerald-500" : ""
                }`
              }
            >
              <Cell class="px-3 py-2 font-medium">{track.title}</Cell>
              <Cell class="px-3 py-2">{track.artist}</Cell>
              <Cell class={({ isSelected }) => `px-3 py-2 text-right tabular-nums ${isSelected() ? "" : "text-slate-500"}`}>{track.length}</Cell>
            </Row>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
// #endregion
