import { GridList, GridListHeader, GridListItem, GridListSection } from "@rivetjs/cdk/grid-list";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "GridList: sections" };

const row = "grid rounded-md px-2 py-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

// #region demo
export default function Produce() {
  return (
    <GridList id="produce" aria-label="Produce" class="m-4 grid max-w-xs gap-2 rounded-lg border border-slate-200 p-1 text-sm outline-none">
      <GridListSection id="fruit" class="grid gap-0.5">
        <GridListHeader class="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Fruit</GridListHeader>
        <GridListItem id="apple" textValue="Apple" class={row}>
          <Text>Apple</Text>
          <Text slot="description" class="text-xs text-slate-500">
            PNG • 9/2/2021
          </Text>
        </GridListItem>
        <GridListItem id="peach" textValue="Peach" class={row}>
          <Text>Peach</Text>
          <Text slot="description" class="text-xs text-slate-500">
            JPEG • 1/16/2022
          </Text>
        </GridListItem>
      </GridListSection>
      <GridListSection id="vegetables" aria-label="Vegetables" class="grid gap-0.5 border-t border-slate-200 pt-1">
        <GridListItem id="broccoli" textValue="Broccoli" class={row}>
          <Text>Broccoli</Text>
          <Text slot="description" class="text-xs text-slate-500">
            PNG • 5/30/2023
          </Text>
        </GridListItem>
        <GridListItem id="peas" textValue="Peas" class={row}>
          <Text>Peas</Text>
          <Text slot="description" class="text-xs text-slate-500">
            PNG • 4/20/2020
          </Text>
        </GridListItem>
      </GridListSection>
    </GridList>
  );
}
// #endregion
