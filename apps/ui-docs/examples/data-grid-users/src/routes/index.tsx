// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set inspired by HeroUI Pro's public docs, own data).
import { DataGrid } from "@rivetjs/ui/data-grid";
import { Link } from "@rivetjs/ui/link";

export const head = { title: "DataGrid: Users" };

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  location: string;
}

const USERS: User[] = [
  { id: 1, name: "Amara Okoye", email: "amara@fernwood.io", role: "Owner", location: "Lagos" },
  { id: 2, name: "Jonas Weber", email: "jonas@fernwood.io", role: "Admin", location: "Berlin" },
  { id: 3, name: "Priya Raman", email: "priya@fernwood.io", role: "Editor", location: "Bengaluru" },
  { id: 4, name: "Lucas Moreau", email: "lucas@fernwood.io", role: "Editor", location: "Lyon" },
  { id: 5, name: "Hana Sato", email: "hana@fernwood.io", role: "Viewer", location: "Osaka" },
  { id: 6, name: "Diego Alvarez", email: "diego@fernwood.io", role: "Viewer", location: "Bogotá" },
];

// #region demo
export function DataGridUsers() {
  // Plain columns read the row value by `accessorKey`; only the action column renders a cell.
  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const },
    { id: "email", header: "Email", accessorKey: "email" as const },
    { id: "role", header: "Role", accessorKey: "role" as const },
    { id: "location", header: "Location", accessorKey: "location" as const },
    {
      id: "actions",
      header: "Actions",
      cell: (user: User) => (
        <Link href={`#user-${user.id}`} aria-label={`Edit ${user.name}`}>
          Edit
        </Link>
      ),
    },
  ];
  return (
    <div class="w-[640px]">
      <DataGrid<User> aria-label="Users" variant="secondary" data={USERS} columns={columns} />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridUsers />
    </div>
  );
}
