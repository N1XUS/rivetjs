// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/virtualization.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ListBox: Virtualization" };

// #region demo
interface User {
  id: number;
  name: string;
  email: string;
}

export function Virtualization() {
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

  function generateUsers(n: number): User[] {
    const users: User[] = [];

    for (let i = 0; i < n; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      const name = `${firstName} ${lastName}`;

      users.push({
        email: `${firstName?.toLowerCase()}.${lastName?.toLowerCase()}@acme.com`,
        id: i + 1,
        name,
      });
    }

    return users;
  }

  const users = generateUsers(1000);

  return (
    <ListBox aria-label="Virtualized list with 1000 items" class="h-[400px] w-[300px] overflow-y-auto" items={users}>
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
