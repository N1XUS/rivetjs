// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/autocomplete/virtualization.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "Autocomplete: Virtualization" };

// #region demo
const { contains } = createFilter({ sensitivity: "base" });

interface User {
  email: string;
  id: number;
  name: string;
}

function generateUsers(n: number): User[] {
  const firstNames = [
    "Emma",
    "Liam",
    "Olivia",
    "Noah",
    "Ava",
    "James",
    "Sophia",
    "Oliver",
    "Isabella",
    "Lucas",
    "Mia",
    "Ethan",
    "Charlotte",
    "Mason",
    "Amelia",
    "Logan",
    "Harper",
    "Alexander",
    "Ella",
    "Benjamin",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Anderson",
    "Taylor",
    "Thomas",
    "Jackson",
    "White",
    "Harris",
    "Clark",
    "Lewis",
    "Robinson",
    "Walker",
  ];
  const users: User[] = [];

  for (let i = 0; i < n; i++) {
    const firstName = firstNames[i % firstNames.length]!;
    const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length]!;
    const name = `${firstName} ${lastName}`;

    users.push({
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@acme.com`,
      id: i + 1,
      name,
    });
  }

  return users;
}

// Rivet: no Virtualizer around a ListBox yet (cdk `Virtualizer` is standalone): the 1000 options render in a scrolling list.
const allUsers = generateUsers(1000);

export function Virtualization() {
  const selectedKey = signal<Key | null>(null);
  const searchQuery = signal("");

  const filteredUsers = () => {
    const query = searchQuery();

    if (!query) return allUsers;

    return allUsers.filter((user) => contains(user.name, query) || contains(user.email, query));
  };

  return (
    <Autocomplete allowsEmptyCollection class="w-[300px]" placeholder="Select a user" selectionMode="single" value={selectedKey}>
      <Label>User</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter inputValue={searchQuery}>
          <SearchField autoFocus aria-label="Search users" class="sticky top-0 z-10" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search users..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox class="max-h-[300px] overflow-y-auto" items={filteredUsers} renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            {(user: User) => (
              <ListBox.Item id={user.id} textValue={user.name}>
                <div class="flex flex-col">
                  <Label>{user.name}</Label>
                  <Description>{user.email}</Description>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
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
      <Virtualization />
    </div>
  );
}
