// Rivet-authored demo (DataGrid is a Rivet addition: @rivetjs/cdk/data-grid behaviour, HeroUI table look; feature set scoped from public docs of commercial UI kits, own data).
import { computed, signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { DataGrid } from "@rivetjs/ui/data-grid";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "DataGrid: Team members" };

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  team: string;
  status: "active" | "invited" | "suspended";
  joined: string;
}

const MEMBERS: Member[] = [
  { id: 1, name: "Mara Quinn", email: "mara@northwind.dev", role: "Staff engineer", team: "Platform", status: "active", joined: "2021-03-14" },
  { id: 2, name: "Ilya Brandt", email: "ilya@northwind.dev", role: "Product designer", team: "Design", status: "active", joined: "2022-07-01" },
  { id: 3, name: "Tomasz Ek", email: "tomasz@northwind.dev", role: "SRE", team: "Platform", status: "invited", joined: "2024-01-22" },
  { id: 4, name: "Noor Haddad", email: "noor@northwind.dev", role: "Controller", team: "Finance", status: "active", joined: "2019-11-05" },
  { id: 5, name: "Celia Varga", email: "celia@northwind.dev", role: "Researcher", team: "Design", status: "suspended", joined: "2023-05-30" },
  { id: 6, name: "Bo Lindqvist", email: "bo@northwind.dev", role: "Support lead", team: "Support", status: "active", joined: "2020-09-18" },
];
const STATUS_COLOR = { active: "success", invited: "accent", suspended: "danger" } as const;

const MANY: Member[] = Array.from({ length: 4 }, (_, round) =>
  MEMBERS.map((m) => ({ ...m, id: m.id + round * 10, name: round ? `${m.name} ${round + 1}` : m.name })),
).flat();

// #region demo
export function DataGridTeamMembers() {
  const query = signal("");
  const status = signal<"all" | Member["status"]>("all");
  const showEmail = signal(true);
  const page = signal(1);
  const PAGE_SIZE = 6;
  const filter = (m: Member) => (status() === "all" || m.status === status()) && (query() === "" || m.name.toLowerCase().includes(query().toLowerCase()));
  const matching = computed(() => MANY.filter(filter).length);
  const pages = computed(() => Math.max(1, Math.ceil(matching() / PAGE_SIZE)));
  const nameColumn = { id: "name", header: "Name", accessorKey: "name" as const, allowsSorting: true };
  const emailColumn = { id: "email", header: "Email", accessorKey: "email" as const };
  const statusColumn = {
    id: "status",
    header: "Status",
    cell: (m: Member) => (
      <Chip size="sm" variant="soft" color={STATUS_COLOR[m.status]}>
        {m.status}
      </Chip>
    ),
  };
  // Column visibility: the column list is an accessor (no JSX inside the computed).
  const columns = computed(() => (showEmail() ? [nameColumn, emailColumn, statusColumn] : [nameColumn, statusColumn]));
  return (
    <div class="flex w-[640px] flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <SearchField
          aria-label="Search members"
          onChange={(value) => {
            query.set(value);
            page.set(1);
          }}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input class="w-48" placeholder="Search…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <div class="flex gap-1">
          {(["all", "active", "invited", "suspended"] as const).map((s) => (
            <Button
              size="sm"
              variant={status() === s ? "primary" : "tertiary"}
              onPress={() => {
                status.set(s);
                page.set(1);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
        <Checkbox isSelected={showEmail} onChange={(on) => showEmail.set(on)}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Email column
          </Checkbox.Content>
        </Checkbox>
      </div>
      <DataGrid<Member>
        aria-label="Team members"
        data={MANY}
        columns={columns}
        filter={filter}
        pageSize={PAGE_SIZE}
        page={page}
        selectionMode="multiple"
        showSelectionCheckboxes
      />
      <div class="flex items-center justify-between text-sm text-muted">
        <span id="data-grid-team-members-count">{matching()} members</span>
        <div class="flex items-center gap-2">
          <Button size="sm" variant="tertiary" isDisabled={() => page() <= 1} onPress={() => page.set(page() - 1)}>
            Previous
          </Button>
          <span>
            Page {page()} of {pages()}
          </span>
          <Button size="sm" variant="tertiary" isDisabled={() => page() >= pages()} onPress={() => page.set(page() + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DataGridTeamMembers />
    </div>
  );
}
