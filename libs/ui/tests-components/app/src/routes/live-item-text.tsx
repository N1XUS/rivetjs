// UI-BREADCRUMB: signal text inside collection item parts on a resumed page. Native `#lit-set` writes `label` ("Products" →
// "Devices") and `count` (1 → 2); the parts render `{label()}` / `Item {count()}` and function children `{() => label()}`:
// Breadcrumbs `#lit-bc` (slots), `#lit-bc-fn` (function children, middle + last), `#lit-bc-mid` (function child in the middle
// row only), ListBox `#lit-lb`, Tabs `#lit-tabs`, TagGroup `#lit-tg`, Dropdown `#lit-dd` (opened after the write via
// `#lit-dd-trigger`). `#lit-x-set` (ui Button in `Picker`) writes a signal another component's Breadcrumbs `#lit-x-bc` read.
import { signal, type Signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { ListBox } from "@rivetjs/ui/list-box";
import { Tabs } from "@rivetjs/ui/tabs";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";

const LINKS = [
  { id: "home", label: "Home", group: "General" },
  { id: "support", label: "Support triage", group: "Agents" },
];

function Crumbs(props: { current: Signal<string> }) {
  const page = () => LINKS.find((link) => link.id === props.current()) ?? LINKS[0]!;
  return (
    <Breadcrumbs id="lit-x-bc">
      <Breadcrumbs.Item href="#">Halcyon</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#">{page().group}</Breadcrumbs.Item>
      <Breadcrumbs.Item>{page().label}</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}

function Picker(props: { current: Signal<string> }) {
  return (
    <Button id="lit-x-set" onPress={() => props.current.set("support")}>
      support
    </Button>
  );
}

export default function LiveItemTextStories() {
  const current = signal("home");
  const label = signal("Products");
  const count = signal(1);
  return (
    <section class="flex flex-col gap-8 bg-background p-10 text-foreground">
      <Picker current={current} />
      <Crumbs current={current} />
      <Button
        id="lit-set"
        onPress={() => {
          label.set("Devices");
          count.set(count() + 1);
        }}
      >
        set
      </Button>
      <Breadcrumbs id="lit-bc">
        <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item href="#group">{label()}</Breadcrumbs.Item>
        <Breadcrumbs.Item>Item {count()}</Breadcrumbs.Item>
      </Breadcrumbs>
      <Breadcrumbs id="lit-bc-fn">
        <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item href="#group">{() => label()}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{() => "Item " + count()}</Breadcrumbs.Item>
      </Breadcrumbs>
      <Breadcrumbs id="lit-bc-mid">
        <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item href="#group">{() => label()}</Breadcrumbs.Item>
        <Breadcrumbs.Item>Here</Breadcrumbs.Item>
      </Breadcrumbs>
      <ListBox id="lit-lb" aria-label="Live">
        <ListBox.Item id="a" textValue="A">
          {label()}
        </ListBox.Item>
        <ListBox.Item id="b" textValue="B">
          Item {count()}
        </ListBox.Item>
        <ListBox.Item id="c" textValue="C">
          {() => label()}
        </ListBox.Item>
      </ListBox>
      <Tabs id="lit-tabs">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Live tabs">
            <Tabs.Tab id="one">
              {label()}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="two">
              Item {count()}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="three">{() => label()}</Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="one">One</Tabs.Panel>
        <Tabs.Panel id="two">Two</Tabs.Panel>
        <Tabs.Panel id="three">Three</Tabs.Panel>
      </Tabs>
      <TagGroup id="lit-tg" aria-label="Live tags">
        <TagGroup.List>
          <Tag id="one">{label()}</Tag>
          <Tag id="two">Item {count()}</Tag>
          <Tag id="three">{() => label()}</Tag>
        </TagGroup.List>
      </TagGroup>
      <Dropdown>
        <Dropdown.Trigger id="lit-dd-trigger" aria-label="Menu">
          Actions
        </Dropdown.Trigger>
        <Dropdown.Menu id="lit-dd">
          <Dropdown.Item id="one" textValue="One">
            {label()}
          </Dropdown.Item>
          <Dropdown.Item id="two" textValue="Two">
            Item {count()}
          </Dropdown.Item>
          <Dropdown.Item id="three" textValue="Three">
            {() => label()}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </section>
  );
}
