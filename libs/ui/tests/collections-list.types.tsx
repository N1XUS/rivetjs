// Type-level suite (`tsc -p libs/ui` only): `ListBox` / `TagGroup` / `Tag` props (cdk props + variants + `class`), signal
// `selectedKeys`, accessor render props, compound statics.
import type { Selection } from "@rivetjs/cdk/listbox";
import { signal } from "@rivetjs/reactivity";
import { ListBox } from "../src/components/list-box/index.ts";
import { Tag } from "../src/components/tag/index.ts";
import { TagGroup } from "../src/components/tag-group/index.ts";

const sel = signal<Selection>(new Set());

export const list = () => (
  <ListBox aria-label="l" variant="danger" selectionMode="multiple" selectedKeys={sel} class="x">
    <ListBox.Section>
      <ListBox.Item id="a" textValue="A" variant="danger">
        A<ListBox.ItemIndicator>{({ isSelected }) => (isSelected() ? "on" : null)}</ListBox.ItemIndicator>
      </ListBox.Item>
    </ListBox.Section>
  </ListBox>
);

export const tags = () => (
  <TagGroup aria-label="t" size="lg" variant="surface" selectionMode="single" onRemove={(keys) => void keys}>
    <TagGroup.List>
      <Tag id="a" textValue="A">
        A
        <Tag.RemoveButton />
      </Tag>
    </TagGroup.List>
  </TagGroup>
);

const lp: ListBox["Props"] = { "aria-label": "x" };
const tp: TagGroup["Props"] = { size: "sm" };
const ip: Tag["Props"] = { id: "a" };
void lp;
void tp;
void ip;

// @ts-expect-error bad variant
export const badVariant = () => <ListBox variant="loud" aria-label="x" />;
// @ts-expect-error bad size
export const badSize = () => <TagGroup size="xl" />;
