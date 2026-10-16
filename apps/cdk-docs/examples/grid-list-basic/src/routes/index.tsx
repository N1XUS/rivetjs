import { Check, FileImage, FileText, Film, Music } from "lucide";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Text } from "@rivetjs/cdk/text";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "GridList" };

const row =
  "flex cursor-default items-center gap-3 rounded-md px-2 py-1.5 outline-none data-[hovered]:bg-slate-50 data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";
const box =
  "grid size-4 place-items-center rounded border border-slate-400 text-white data-[selected]:border-sky-600 data-[selected]:bg-sky-600 [&_svg]:invisible data-[selected]:[&_svg]:visible";

// #region demo
export default function Files() {
  return (
    <GridList id="files" aria-label="Files" selectionMode="multiple" class="m-4 grid max-w-sm gap-0.5 rounded-lg border border-slate-200 p-1 outline-none">
      <GridListItem id="sunset" textValue="Desert Sunset" class={row}>
        <Checkbox slot="selection" class={box}>
          <Icon icon={Check} size={12} strokeWidth={3} />
        </Checkbox>
        <Icon icon={FileImage} size={20} class="text-slate-500" />
        <div class="grid">
          <Text class="text-sm font-medium">Desert Sunset</Text>
          <Text slot="description" class="text-xs text-slate-500">
            PNG • 2/3/2024
          </Text>
        </div>
      </GridListItem>
      <GridListItem id="notes" textValue="Meeting notes" class={row}>
        <Checkbox slot="selection" class={box}>
          <Icon icon={Check} size={12} strokeWidth={3} />
        </Checkbox>
        <Icon icon={FileText} size={20} class="text-slate-500" />
        <div class="grid">
          <Text class="text-sm font-medium">Meeting notes</Text>
          <Text slot="description" class="text-xs text-slate-500">
            DOCX • 1/10/2022
          </Text>
        </div>
      </GridListItem>
      <GridListItem id="trailer" textValue="Trailer" class={row}>
        <Checkbox slot="selection" class={box}>
          <Icon icon={Check} size={12} strokeWidth={3} />
        </Checkbox>
        <Icon icon={Film} size={20} class="text-slate-500" />
        <div class="grid">
          <Text class="text-sm font-medium">Trailer</Text>
          <Text slot="description" class="text-xs text-slate-500">
            MP4 • 8/28/2021
          </Text>
        </div>
      </GridListItem>
      <GridListItem id="theme" textValue="Theme song" class={row}>
        <Checkbox slot="selection" class={box}>
          <Icon icon={Check} size={12} strokeWidth={3} />
        </Checkbox>
        <Icon icon={Music} size={20} class="text-slate-500" />
        <div class="grid">
          <Text class="text-sm font-medium">Theme song</Text>
          <Text slot="description" class="text-xs text-slate-500">
            MP3 • 3/15/2015
          </Text>
        </div>
      </GridListItem>
    </GridList>
  );
}
// #endregion
