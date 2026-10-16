import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Input } from "@rivetjs/cdk/input";
import { Text } from "@rivetjs/cdk/text";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "GridList: keyboard navigation" };

const files = [
  { id: "sunset", title: "Desert Sunset", description: "PNG • 2/3/2024" },
  { id: "trail", title: "Hiking Trail", description: "JPEG • 1/10/2022" },
  { id: "lion", title: "Lion", description: "JPEG • 8/28/2021" },
];

// #region demo
export default function SharedFiles() {
  return (
    <GridList
      id="shared"
      aria-label="Shared files"
      keyboardNavigationBehavior="tab"
      selectionMode="multiple"
      items={files}
      class="m-4 grid max-w-sm gap-1 rounded-lg border border-slate-200 p-1 text-sm outline-none"
    >
      {(file: (typeof files)[number]) => (
        <GridListItem
          textValue={file.title}
          class="grid gap-1 rounded-md px-2 py-1.5 outline-none data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500"
        >
          <TextField aria-label="Title" defaultValue={file.title}>
            <Input class="w-full rounded border border-slate-300 px-2 py-0.5 outline-none focus:ring-2 focus:ring-sky-500" />
          </TextField>
          <Text slot="description" class="text-xs text-slate-500">
            {file.description}
          </Text>
        </GridListItem>
      )}
    </GridList>
  );
}
// #endregion
