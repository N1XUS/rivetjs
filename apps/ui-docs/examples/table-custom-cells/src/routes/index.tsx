// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/custom-cells.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { computed, signal } from "@rivetjs/reactivity";
import type { Selection, SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Copy, Eye, Pencil, Trash2 } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Chip } from "@rivetjs/ui/chip";
import { Table } from "@rivetjs/ui/table";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "Table: Custom Cells" };

// #region demo
interface User {
  id: number;
  name: string;
  image_url: string;
  role: string;
  status: "Active" | "Inactive" | "On Leave";
  email: string;
}

const statusColorMap: Record<string, "success" | "danger" | "warning"> = {
  Active: "success",
  Inactive: "danger",
  "On Leave": "warning",
};

const users: User[] = [
  {
    email: "kate@acme.com",
    id: 4586932,
    image_url: avatarRedImage.src,
    name: "Kate Moore",
    role: "Chief Executive Officer",
    status: "Active",
  },
  {
    email: "john@acme.com",
    id: 5273849,
    image_url: avatarGreenImage.src,
    name: "John Smith",
    role: "Chief Technology Officer",
    status: "Active",
  },
  {
    email: "sara@acme.com",
    id: 7492836,
    image_url: avatarBlueImage.src,
    name: "Sara Johnson",
    role: "Chief Marketing Officer",
    status: "On Leave",
  },
  {
    email: "michael@acme.com",
    id: 8293746,
    image_url: avatarPurpleImage.src,
    name: "Michael Brown",
    role: "Chief Financial Officer",
    status: "Active",
  },
  {
    email: "emily@acme.com",
    id: 1234567,
    image_url: avatarOrangeImage.src,
    name: "Emily Davis",
    role: "Product Manager",
    status: "Inactive",
  },
];

export function CustomCells() {
  const selectedKeys = signal<Selection>(new Set());
  const sortDescriptor = signal<SortDescriptor | null>({
    column: "name",
    direction: "ascending",
  });

  const sortedUsers = computed(() => {
    const descriptor = sortDescriptor();
    if (!descriptor) return users;
    return [...users].sort((a, b) => {
      const col = descriptor.column as keyof User;
      const first = String(a[col]);
      const second = String(b[col]);
      let cmp = first.localeCompare(second);

      if (descriptor.direction === "descending") {
        cmp *= -1;
      }

      return cmp;
    });
  });

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Table with custom cells"
          class="min-w-[800px]"
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          sortDescriptor={sortDescriptor}
        >
          <Table.Header>
            <Table.Column class="pe-0">
              <Checkbox aria-label="Select all" slot="selection">
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
            </Table.Column>
            <Table.Column allowsSorting isRowHeader class="after:hidden" id="id">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Worker ID</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Member</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="role">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Role</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="status">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Status</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column class="text-end">Actions</Table.Column>
          </Table.Header>
          <Table.Body items={sortedUsers}>
            {(user: User) => (
              <Table.Row id={user.id}>
                <Table.Cell class="pe-0">
                  <Checkbox aria-label={`Select ${user.name}`} slot="selection" variant="secondary">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Cell>
                <Table.Cell class="font-medium">
                  <div class="flex items-center gap-2">
                    #{user.id.toString()}{" "}
                    <Button isIconOnly aria-label={`Copy ID #${user.id}`} size="sm" variant="ghost">
                      <Icon class="size-4 text-muted" icon={Copy} />
                    </Button>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div class="flex items-center gap-3">
                    <Avatar size="sm">
                      <Avatar.Image src={user.image_url} />
                      <Avatar.Fallback>
                        {user.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </Avatar.Fallback>
                    </Avatar>
                    <div class="flex flex-col">
                      <span class="text-xs">{user.name}</span>
                      <span class="text-xs text-muted">{user.email}</span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell class="min-w-52">{user.role}</Table.Cell>
                <Table.Cell class="min-w-25">
                  <Chip color={statusColorMap[user.status]} size="sm" variant="soft">
                    {user.status}
                  </Chip>
                </Table.Cell>
                <Table.Cell>
                  <div class="flex items-center gap-1">
                    <Button isIconOnly aria-label={`View ${user.name}`} size="sm" variant="tertiary">
                      <Icon class="size-4" icon={Eye} />
                    </Button>
                    <Button isIconOnly aria-label={`Edit ${user.name}`} size="sm" variant="tertiary">
                      <Icon class="size-4" icon={Pencil} />
                    </Button>
                    <Button isIconOnly aria-label={`Delete ${user.name}`} size="sm" variant="danger-soft">
                      <Icon class="size-4" icon={Trash2} />
                    </Button>
                  </div>
                </Table.Cell>
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
      <CustomCells />
    </div>
  );
}
