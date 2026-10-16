// ItemMorph on a resumed page (Rivet addition; behaviour `@rivetjs/cdk/morph/item`): `#contacts` ListBox (single selection)
// whose items open a contact card on a long press / right click (`trigger: ["longPress", "contextMenu"]`) / Shift+F10 (`#card-*` actions, Close `#card-close`);
// `#chosen` shows the selection (a long press never selects); `#settings` a ListBox (no selection) whose rows open an inline
// settings panel on a press (`trigger="press"`), `#wifi` switch inside.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ItemMorph, itemMorphProps, useItemMorph } from "@rivetjs/ui/item-morph";
import { ListBox } from "@rivetjs/ui/list-box";
import { Mail, MessageCircle, Phone } from "lucide";

const PEOPLE = [
  { id: "ada", name: "Ada Lovelace", role: "Analyst" },
  { id: "alan", name: "Alan Turing", role: "Cryptographer" },
  { id: "grace", name: "Grace Hopper", role: "Rear admiral" },
  { id: "linus", name: "Linus Torvalds", role: "Maintainer" },
];

export default function ItemMorphStories() {
  const selected = signal<"all" | Set<string | number>>(new Set());
  const called = signal("");
  const contacts = useItemMorph({ trigger: ["longPress", "contextMenu"] });
  const settings = useItemMorph({ trigger: "press" });
  const wifi = signal(true);
  return (
    <main class="mx-auto flex max-w-md flex-col gap-8 p-6">
      <p id="chosen">{() => [...(selected() as Set<string>)].join(",")}</p>
      <p id="called">{called()}</p>
      <ListBox id="contacts" aria-label="Contacts" selectionMode="single" selectedKeys={selected as never}>
        {PEOPLE.map((p) => (
          <ListBox.Item id={p.id} textValue={p.name} {...itemMorphProps(contacts)}>
            {p.name}
          </ListBox.Item>
        ))}
      </ListBox>
      <ItemMorph morph={contacts} panelClass="w-80">
        {(key) => (
          <>
            <h2 id="card-name" class="text-lg font-semibold">
              {() => PEOPLE.find((p) => p.id === key())?.name}
            </h2>
            <p id="card-role">{() => PEOPLE.find((p) => p.id === key())?.role}</p>
            <div class="flex gap-2">
              <Button id="card-call" size="sm" data-morph-autofocus onPress={() => called.set(String(key()))}>
                <Icon icon={Phone} size={16} />
                Call
              </Button>
              <Button id="card-message" size="sm" variant="secondary">
                <Icon icon={MessageCircle} size={16} />
                Message
              </Button>
              <Button id="card-mail" size="sm" variant="secondary" isIconOnly aria-label="Mail">
                <Icon icon={Mail} size={16} />
              </Button>
            </div>
            <ItemMorph.Close id="card-close" variant="tertiary" size="sm">
              Close
            </ItemMorph.Close>
          </>
        )}
      </ItemMorph>
      <ListBox id="settings" aria-label="Settings">
        <ListBox.Item id="network" textValue="Network" {...itemMorphProps(settings)}>
          Network
        </ListBox.Item>
      </ListBox>
      <ItemMorph morph={settings} backdrop="transparent" aria-label="Network settings">
        {() => (
          <>
            <label class="flex items-center justify-between gap-4">
              Wi-Fi
              <input id="wifi" type="checkbox" checked={wifi()} onChange={(e) => wifi.set((e.target as HTMLInputElement).checked)} />
            </label>
            <ItemMorph.Close id="settings-done" size="sm">
              Done
            </ItemMorph.Close>
          </>
        )}
      </ItemMorph>
      <p id="after">Below the lists</p>
    </main>
  );
}
