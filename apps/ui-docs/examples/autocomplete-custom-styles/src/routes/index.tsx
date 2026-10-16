// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { selectedKeys as keysOf, type Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

export const head = { title: "Autocomplete: Tailwind CSS" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

const TEAMMATES = [
  { id: "sarah", name: "Sarah Chen", role: "Product Design" },
  { id: "marcus", name: "Marcus Lee", role: "Engineering" },
  { id: "priya", name: "Priya Patel", role: "Data Science" },
  { id: "jordan", name: "Jordan Kim", role: "Customer Success" },
  { id: "alex", name: "Alex Rivera", role: "Marketing" },
] as const;

export function CustomStyles() {
  const selectedKeys = signal<readonly Key[]>([]);

  const onRemoveTags = (keys: Set<Key>) => {
    selectedKeys.update((prev) => prev.filter((key) => !keys.has(key)));
  };

  return (
    <div class="w-full max-w-sm pt-6">
      <Autocomplete class="w-full gap-1.5" placeholder="Search teammates..." selectionMode="multiple" value={selectedKeys}>
        <Label class="font-medium text-foreground">Assignees</Label>
        <Description>People who will be notified when this task updates.</Description>
        <Autocomplete.Trigger class="rounded-xl border border-border/80 bg-surface shadow-sm ring-1 ring-accent/5 transition-[box-shadow,border-color] focus-within:border-accent/25 focus-within:ring-2 focus-within:ring-accent/15 dark:border-border/90 dark:bg-surface dark:ring-accent/10 dark:focus-within:border-accent/35">
          <Autocomplete.Value>
            {({ defaultChildren, isPlaceholder, state }) => {
              if (isPlaceholder() || keysOf(state).length === 0) {
                return defaultChildren;
              }

              const selectedItemsKeys = keysOf(state);

              return (
                <TagGroup size="sm" onRemove={onRemoveTags}>
                  <TagGroup.List>
                    {selectedItemsKeys.map((selectedItemKey) => {
                      const teammate = TEAMMATES.find((member) => member.id === selectedItemKey);

                      if (!teammate) return null;

                      return (
                        <Tag class="border border-accent/15 bg-accent/8 text-foreground dark:border-accent/25 dark:bg-accent/12" id={teammate.id}>
                          {teammate.name}
                        </Tag>
                      );
                    })}
                  </TagGroup.List>
                </TagGroup>
              );
            }}
          </Autocomplete.Value>
          <Autocomplete.ClearButton />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover class="overflow-hidden rounded-xl border border-border/80 bg-surface shadow-xl ring-1 ring-black/3 dark:border-border/90 dark:bg-surface dark:ring-white/5">
          <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
            <SearchField autoFocus aria-label="Search by name or role" name="search" variant="secondary">
              <SearchField.Group class="border-b border-separator bg-surface-secondary/50">
                <SearchField.SearchIcon class="text-muted" />
                <SearchField.Input placeholder="Search by name or role..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox class="p-1.5" renderEmptyState={() => <EmptyState>No teammates found</EmptyState>}>
              {TEAMMATES.map((teammate) => (
                <ListBox.Item
                  class="rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:bg-accent/5 dark:data-[focused=true]:bg-accent/15 dark:data-[selected=true]:bg-accent/8"
                  id={teammate.id}
                  textValue={`${teammate.name} ${teammate.role}`}
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium text-foreground">{teammate.name}</span>
                    <span class="text-xs text-muted">{teammate.role}</span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
