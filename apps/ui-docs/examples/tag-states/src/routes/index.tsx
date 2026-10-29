// Rivet-authored Tag demo (own content): rich tags with textValue, a disabled tag, a render function and removal.
import { createListData } from "@rivetjs/cdk/data";
import type { Key, Selection, TagRenderProps } from "@rivetjs/cdk/tag-group";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { Check, Leaf, Wheat } from "lucide";

export const head = { title: "Tag: Content and States" };

// #region demo
type Filter = { id: string; name: string };

export function ContentAndStates() {
  const diets = signal<Selection>(new Set(["vegetarian"]));
  const filters = createListData<Filter>({
    initialItems: [
      { id: "under-30", name: "Under 30 min" },
      { id: "one-pot", name: "One pot" },
      { id: "budget", name: "Budget" },
    ],
  });

  return (
    <div class="flex w-full max-w-md flex-col gap-8">
      {/* Size and variant are set on the group: every tag follows them. */}
      <TagGroup id="tag-diets" selectionMode="multiple" selectedKeys={diets} size="lg" variant="surface">
        <Label>Diet</Label>
        <TagGroup.List>
          <Tag id="vegetarian" textValue="Vegetarian">
            <Icon icon={Leaf} size={16} />
            Vegetarian
          </Tag>
          <Tag id="gluten-free" textValue="Gluten free">
            {(state: TagRenderProps) => (
              <>
                <Icon icon={state.isSelected() ? Check : Wheat} size={16} />
                Gluten free
              </>
            )}
          </Tag>
          <Tag id="halal" isDisabled>
            Halal
          </Tag>
        </TagGroup.List>
        <Description>Halal recipes are coming soon</Description>
      </TagGroup>

      <TagGroup id="tag-filters" onRemove={(keys: Set<Key>) => filters.remove(...keys)}>
        <Label>Active filters</Label>
        <TagGroup.List items={filters.items} renderEmptyState={() => <span class="text-sm text-muted">No filters</span>}>
          {(filter: Filter) => (
            <Tag id={filter.id} textValue={filter.name}>
              {filter.name}
            </Tag>
          )}
        </TagGroup.List>
      </TagGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ContentAndStates />
    </div>
  );
}
