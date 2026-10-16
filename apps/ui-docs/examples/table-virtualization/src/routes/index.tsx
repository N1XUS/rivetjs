// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/virtualization.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Virtualization" };

// #region demo
interface User {
  id: number;
  name: string;
  role: string;
  email: string;
}

const roles = [
  "Software Engineer",
  "Senior Engineer",
  "Staff Engineer",
  "Product Manager",
  "Designer",
  "Data Analyst",
  "QA Engineer",
  "DevOps Engineer",
  "Marketing Manager",
  "Sales Representative",
];

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

function generateUsers(count: number): User[] {
  const users: User[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const name = `${firstName} ${lastName}`;

    users.push({
      email: `${firstName?.toLowerCase()}.${lastName?.toLowerCase()}@acme.com`,
      id: i + 1,
      name,
      role: roles[i % roles.length] || "",
    });
  }

  return users;
}

const virtualizedUsers = generateUsers(1000);

export function Virtualization() {
  // Not yet ported: cdk Table inside the cdk Virtualizer (TableLayout); all 1000 rows render.
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Virtualized table with 1000 rows" class="h-[300px] min-w-[700px] overflow-auto">
          <Table.Header class="h-full w-full">
            <Table.Column isRowHeader id="name" minWidth={160}>
              Name
            </Table.Column>
            <Table.Column id="role" minWidth={220}>
              Role
            </Table.Column>
            <Table.Column id="email" minWidth={240}>
              Email
            </Table.Column>
          </Table.Header>
          <Table.Body items={virtualizedUsers}>
            {(user: User) => (
              <Table.Row>
                <Table.Cell>{user.name}</Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                <Table.Cell>{user.email}</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
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
