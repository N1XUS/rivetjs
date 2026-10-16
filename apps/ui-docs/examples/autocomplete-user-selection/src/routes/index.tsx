// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/user-selection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { selectedKeys as keysOf, type Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "Autocomplete: User Selection" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

export function UserSelection() {
  const users = [
    {
      avatarUrl: avatarBlueImage.src,
      email: "bob@acme.com",
      fallback: "B",
      id: "1",
      name: "Bob",
    },
    {
      avatarUrl: avatarGreenImage.src,
      email: "fred@acme.com",
      fallback: "F",
      id: "2",
      name: "Fred",
    },
    {
      avatarUrl: avatarPurpleImage.src,
      email: "martha@acme.com",
      fallback: "M",
      id: "3",
      name: "Martha",
    },
    {
      avatarUrl: avatarRedImage.src,
      email: "john@acme.com",
      fallback: "J",
      id: "4",
      name: "John",
    },
    {
      avatarUrl: avatarOrangeImage.src,
      email: "jane@acme.com",
      fallback: "J",
      id: "5",
      name: "Jane",
    },
  ];

  const selectedKey = signal<Key | null>(null);

  return (
    <Autocomplete class="w-[256px]" placeholder="Select a user" selectionMode="single" value={selectedKey}>
      <Label>User</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder, state }) => {
            if (isPlaceholder() || keysOf(state).length === 0) {
              return defaultChildren;
            }

            const selectedItems = keysOf(state);

            if (selectedItems.length > 1) {
              return `${selectedItems.length} users selected`;
            }

            const selectedItem = users.find((user) => user.id === selectedItems[0]);

            if (!selectedItem) {
              return defaultChildren;
            }

            return (
              <div class="flex items-center gap-2">
                <Avatar class="size-4" size="sm">
                  <Avatar.Image src={selectedItem.avatarUrl} />
                  <Avatar.Fallback>{selectedItem.fallback}</Avatar.Fallback>
                </Avatar>
                <span>{selectedItem.name}</span>
              </div>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search users" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search users..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            {users.map((user) => (
              <ListBox.Item id={user.id} textValue={user.name}>
                <Avatar size="sm">
                  <Avatar.Image src={user.avatarUrl} />
                  <Avatar.Fallback>{user.fallback}</Avatar.Fallback>
                </Avatar>
                <div class="flex flex-col">
                  <Label>{user.name}</Label>
                  <Description>{user.email}</Description>
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
      <UserSelection />
    </div>
  );
}
