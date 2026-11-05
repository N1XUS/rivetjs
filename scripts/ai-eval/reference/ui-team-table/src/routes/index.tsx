import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Table } from "@rivetjs/ui/table";
import { TextField } from "@rivetjs/ui/textfield";
import { Trash2 } from "lucide";

export const head = { title: "Team" };

type Member = { id: number; name: string; role: string };
const ROLES: Record<string, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };

export default function Home() {
  const members = signal<Member[]>([
    { id: 1, name: "Ada Lovelace", role: "admin" },
    { id: 2, name: "Linus Torvalds", role: "viewer" },
  ]);
  const open = signal(false);
  const name = signal("");
  const role = signal<string | number | null>("viewer");

  const save = () => {
    const text = name().trim();
    if (!text) return;
    members.update((list) => [...list, { id: Math.max(0, ...list.map((m) => m.id)) + 1, name: text, role: String(role() ?? "viewer") }]);
    name.set("");
    role.set("viewer");
    open.set(false);
  };

  return (
    <main class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Team</h1>
        <Button id="add" onPress={() => open.set(true)}>
          Add member
        </Button>
      </header>
      <p id="count">{members().length} members</p>
      <Table aria-label="Team">
        <Table.Header>
          <Table.Column isRowHeader>Name</Table.Column>
          <Table.Column>Role</Table.Column>
          <Table.Column>Actions</Table.Column>
        </Table.Header>
        <Table.Body items={members}>
          {(member: Member) => (
            <Table.Row id={member.id}>
              <Table.Cell>{member.name}</Table.Cell>
              <Table.Cell>{ROLES[member.role]}</Table.Cell>
              <Table.Cell>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${member.name}`}
                  onPress={() => members.update((list) => list.filter((m) => m.id !== member.id))}
                >
                  <Icon icon={Trash2} size={16} />
                </Button>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      <Drawer.Content isOpen={open} placement="right">
        <Drawer.Header>
          <Drawer.Heading>Add member</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body class="flex flex-col gap-4">
          <TextField name="name" value={name}>
            <Label>Name</Label>
            <Input id="member-name" placeholder="Full name" />
          </TextField>
          <Select value={role}>
            <Label>Role</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="admin" textValue="Admin">
                  Admin
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="editor" textValue="Editor">
                  Editor
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="viewer" textValue="Viewer">
                  Viewer
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Drawer.Body>
        <Drawer.Footer>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button id="save" onPress={save}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </main>
  );
}
