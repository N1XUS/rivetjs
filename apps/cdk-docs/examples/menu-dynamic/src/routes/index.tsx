import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, SubmenuTrigger, type Key } from "@rivetjs/cdk/menu";

export const head = { title: "Menu dynamic items" };

interface Entry {
  id: string;
  name: string;
  children?: Entry[];
}

// #region demo
export default function Dynamic() {
  const last = signal<Key | null>(null);
  const items: Entry[] = [
    { id: "new", name: "New file…" },
    { id: "open", name: "Open…" },
    {
      id: "recent",
      name: "Open recent",
      children: [
        { id: "notes", name: "notes.md" },
        {
          id: "projects",
          name: "Projects",
          children: [
            { id: "rivet", name: "rivet" },
            { id: "site", name: "site" },
          ],
        },
      ],
    },
    { id: "save", name: "Save" },
  ];
  // Items with children render a SubmenuTrigger whose Menu renders its items the same way.
  const renderItem = (item: Entry): unknown =>
    item.children ? (
      <SubmenuTrigger>
        <MenuItem id={item.id}>{item.name}</MenuItem>
        <Popover>
          <Menu items={item.children} onAction={(key) => last.set(key)}>
            {(child: Entry) => renderItem(child)}
          </Menu>
        </Popover>
      </SubmenuTrigger>
    ) : (
      <MenuItem id={item.id}>{item.name}</MenuItem>
    );
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="dy-trigger">File</Button>
        <Popover>
          {/* items + a render function: a dynamic collection. */}
          <Menu id="dy" items={items} onAction={(key) => last.set(key)}>
            {(item: Entry) => renderItem(item)}
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Last action: <output id="dy-value">{last() ?? "nothing yet"}</output>
      </p>
    </section>
  );
}
// #endregion
