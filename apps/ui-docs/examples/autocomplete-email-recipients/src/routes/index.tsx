// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/email-recipients.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
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

export const head = { title: "Autocomplete: Email Recipients" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function EmailRecipients() {
  const emails = [
    { email: "alice@example.com", id: "alice@example.com", name: "Alice Johnson" },
    { email: "bob@example.com", id: "bob@example.com", name: "Bob Smith" },
    { email: "charlie@example.com", id: "charlie@example.com", name: "Charlie Brown" },
    { email: "diana@example.com", id: "diana@example.com", name: "Diana Prince" },
    { email: "eve@example.com", id: "eve@example.com", name: "Eve Wilson" },
  ];

  const selectedKeys = signal<readonly Key[]>([]);

  const onRemoveTags = (keys: Set<Key>) => {
    selectedKeys.update((prev) => prev.filter((key) => !keys.has(key)));
  };

  return (
    <Autocomplete class="w-[256px]" placeholder="Add recipients" selectionMode="multiple" value={selectedKeys}>
      <Label>To</Label>
      <Autocomplete.Trigger>
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
                    const email = emails.find((e) => e.id === selectedItemKey);

                    if (!email) return null;

                    return <Tag id={email.id}>{email.email}</Tag>;
                  })}
                </TagGroup.List>
              </TagGroup>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search emails" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search emails..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No recipients found</EmptyState>}>
            {emails.map((email) => (
              <ListBox.Item id={email.id} textValue={email.email}>
                <div class="flex flex-col">
                  <Label>{email.name}</Label>
                  <Description>{email.email}</Description>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <EmailRecipients />
    </div>
  );
}
