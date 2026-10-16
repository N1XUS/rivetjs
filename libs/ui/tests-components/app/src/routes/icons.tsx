// Icon slots the visual routes do not show (identity spec §3.3, TWEAKS.md TW-140): Button / ToggleButton lg with an icon,
// a ListBox with a selected item (check indicator), sm / md Tags with icons, a Dropdown with a submenu (`#i-menu`
// trigger). Read by `icons.test.ts`.
import { Icon } from "@rivetjs/kit/icon";
import { Globe, Plus } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export default function IconStories() {
  return (
    <section class="flex flex-wrap items-start gap-10 p-10">
      <Button size="lg">
        <Icon icon={Plus} />
        Large
      </Button>
      <ToggleButton size="lg" aria-label="Add">
        <Icon icon={Plus} />
        Add
      </ToggleButton>
      <ListBox aria-label="Fruit" selectionMode="single" defaultSelectedKeys={["apple"]} class="w-48">
        <ListBox.Item id="apple" textValue="Apple">
          Apple
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
      <TagGroup aria-label="Small" size="sm">
        <TagGroup.List>
          <Tag textValue="World">
            <Icon icon={Globe} size={16} />
            World
          </Tag>
        </TagGroup.List>
      </TagGroup>
      <TagGroup aria-label="Medium">
        <TagGroup.List>
          <Tag textValue="World">
            <Icon icon={Globe} size={16} />
            World
          </Tag>
        </TagGroup.List>
      </TagGroup>
      <Dropdown>
        <Button id="i-menu" variant="secondary">
          Share
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu>
            <Dropdown.Item id="copy" textValue="Copy">
              <Label>Copy</Label>
            </Dropdown.Item>
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item id="other" textValue="Other">
                <Label>Other</Label>
                <Dropdown.SubmenuIndicator />
              </Dropdown.Item>
              <Dropdown.Popover>
                <Dropdown.Menu>
                  <Dropdown.Item id="mail" textValue="Mail">
                    <Label>Mail</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </section>
  );
}
