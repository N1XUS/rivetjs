// Rivet-authored ListBox demo (no HeroUI counterpart): iOS-style contact preview with `@rivetjs/ui/item-morph`.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Mail, MessageCircle, Phone, Share2 } from "lucide";
import type { Selection } from "@rivetjs/cdk/listbox";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { ItemMorph, itemMorphProps, useItemMorph } from "@rivetjs/ui/item-morph";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Surface } from "@rivetjs/ui/surface";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "ListBox: Item Morph (contact preview)" };

const CONTACTS = [
  { id: "bob", name: "Bob", email: "bob@acme.com", phone: "+1 555 0101", avatar: avatarBlueImage.src },
  { id: "fred", name: "Fred", email: "fred@acme.com", phone: "+1 555 0102", avatar: avatarGreenImage.src },
  { id: "martha", name: "Martha", email: "martha@acme.com", phone: "+1 555 0103", avatar: avatarPurpleImage.src },
];

// #region demo
export function ContactPreview() {
  const selected = signal<Selection>(new Set());
  // Long press (500 ms) or right click opens the preview; Shift+F10 / the ContextMenu key from the keyboard.
  const preview = useItemMorph({ trigger: ["longPress", "contextMenu"] });
  const contact = (key: unknown) => CONTACTS.find((c) => c.id === key);

  return (
    <div class="space-y-4">
      <Surface class="w-[256px] rounded-3xl shadow-surface">
        <ListBox aria-label="Contacts" selectedKeys={selected} selectionMode="single">
          {CONTACTS.map((c) => (
            <ListBox.Item id={c.id} textValue={c.name} {...itemMorphProps(preview)}>
              <Avatar size="sm">
                <Avatar.Image alt={c.name} src={c.avatar} />
                <Avatar.Fallback>{c.name[0]}</Avatar.Fallback>
              </Avatar>
              <div class="flex flex-col">
                <Label>{c.name}</Label>
                <Description>{c.email}</Description>
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Surface>
      <p class="text-sm text-muted">Selected: {() => [...selected()].join(", ") || "none"}</p>

      <ItemMorph morph={preview}>
        {(key) => (
          <>
            <div class="flex items-center gap-3">
              <Avatar size="lg">
                <Avatar.Image alt={contact(key())?.name} src={contact(key())?.avatar} />
                <Avatar.Fallback>{contact(key())?.name[0]}</Avatar.Fallback>
              </Avatar>
              <div class="flex flex-col">
                <span class="text-lg font-semibold">{contact(key())?.name}</span>
                <span class="text-sm text-muted">{contact(key())?.email}</span>
              </div>
            </div>
            <p class="text-sm">{contact(key())?.phone}</p>
            <div class="grid grid-cols-4 gap-2">
              <Button id="contact-call" size="sm" data-morph-autofocus>
                <Icon icon={Phone} size={16} />
                Call
              </Button>
              <Button size="sm" variant="secondary" isIconOnly aria-label="Message">
                <Icon icon={MessageCircle} size={16} />
              </Button>
              <Button size="sm" variant="secondary" isIconOnly aria-label="Email">
                <Icon icon={Mail} size={16} />
              </Button>
              <Button size="sm" variant="secondary" isIconOnly aria-label="Share">
                <Icon icon={Share2} size={16} />
              </Button>
            </div>
            <ItemMorph.Close variant="tertiary" size="sm">
              Close
            </ItemMorph.Close>
          </>
        )}
      </ItemMorph>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ContactPreview />
    </div>
  );
}
