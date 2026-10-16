// P3-COLLECTIONS components on a resumed page. Breadcrumbs `#bc` (Home `#bc-home` with `onPress` → `#bc-pressed`, current
// `Laptop`); Toolbar `#tb` (Buttons `#tb-undo` / `#tb-redo`, ToggleButtonGroup `#tb-bold`, Separator) with live `isAttached`
// toggled by native `#tb-attach`. ListBox `#lb` (multiple, signal `selectedKeys` echoed in `#lb-sel`); TagGroup `#tg`
// (removable tags, `onRemove` drops keys from a signal list, count in `#tg-count`); Dropdown `#dd` (trigger `#dd-trigger`,
// `onAction` key echoed in `#dd-action`, single-selection section with indicators, submenu; folded form: no Dropdown.Popover,
// string items, `shortcut` sugar). Shorthand forms (identity T22): `#pg-auto` (Pagination `total` + Signal page), `#pg-default`
// (uncontrolled `defaultPage` 3, `onPageChange` → `#pg-default-page`), `#pg-acc` (accessor `page` + `onPageChange` → `#pg-acc-page`,
// native `#pg-acc-last` sets 6), `#tg-auto`
// (TagGroup `label` + `items`), `#bc-auto` (Breadcrumbs `items`). Pagination `#pg` (upstream basic demo,
// 3 pages: `#pg-prev` / `#pg-next` disabled at the ends, page links `#pg-1…3` with live `isActive`, page echoed in `#pg-page`).
import { signal } from "@rivetjs/reactivity";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Pagination } from "@rivetjs/ui/pagination";
import type { Selection } from "@rivetjs/cdk/listbox";
import { ListBox } from "@rivetjs/ui/list-box";
import { Separator } from "@rivetjs/ui/separator";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { Toolbar } from "@rivetjs/ui/toolbar";

export default function CollectionsStories() {
  const pressed = signal(0);
  const attached = signal(false);
  const lbSel = signal<Selection>(new Set(["apple"]));
  const tags = signal(["news", "travel", "gaming"]);
  const ddAction = signal("");
  const ddSel = signal<Selection>(new Set(["left"]));
  const page = signal(1);
  const totalPages = 3;
  const autoPage = signal(1);
  const accPage = signal(2);
  const defaultSeen = signal(0);
  const amenities = [
    { id: "laundry", name: "Laundry" },
    { id: "pool", name: "Pool" },
  ];
  const tgSel = signal<Selection>(new Set());
  return (
    <section class="flex flex-col gap-8 p-10">
      <Breadcrumbs id="bc">
        <Breadcrumbs.Item id="bc-home" href="#home" onPress={() => pressed.set(pressed() + 1)}>
          Home
        </Breadcrumbs.Item>
        <Breadcrumbs.Item href="#products">Products</Breadcrumbs.Item>
        <Breadcrumbs.Item>Laptop</Breadcrumbs.Item>
      </Breadcrumbs>
      <output id="bc-pressed">{pressed()}</output>

      <Toolbar id="tb" aria-label="Editor toolbar" isAttached={attached()}>
        <Button id="tb-undo">Undo</Button>
        <Button id="tb-redo">Redo</Button>
        <Separator />
        <ToggleButtonGroup selectionMode="multiple">
          <ToggleButton id="bold" aria-label="Bold">
            B
          </ToggleButton>
        </ToggleButtonGroup>
      </Toolbar>
      <button id="tb-attach" type="button" onClick={() => attached.set(!attached())}>
        attach
      </button>

      <ListBox id="lb" aria-label="Fruits" selectionMode="multiple" selectedKeys={lbSel}>
        <ListBox.Item id="apple" textValue="Apple">
          Apple
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="banana" textValue="Banana">
          Banana
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="cherry" textValue="Cherry">
          Cherry
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
      <output id="lb-sel">{[...lbSel()].join(",")}</output>

      <TagGroup id="tg" aria-label="Topics" onRemove={(keys) => tags.set(tags().filter((k) => !keys.has(k)))}>
        <TagGroup.List>
          <Tag id="news">News</Tag>
          <Tag id="travel">Travel</Tag>
          <Tag id="gaming">Gaming</Tag>
        </TagGroup.List>
      </TagGroup>
      <output id="tg-count">{tags().length}</output>

      <Dropdown>
        <Dropdown.Trigger id="dd-trigger" aria-label="Menu">
          Actions
        </Dropdown.Trigger>
        <Dropdown.Menu id="dd" onAction={(key) => ddAction.set(String(key))}>
          <Dropdown.Item id="new-file" shortcut="command+N">
            New file
          </Dropdown.Item>
          <Dropdown.Section selectionMode="single" selectedKeys={ddSel}>
            <Dropdown.Item id="left" textValue="Left">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Left</Label>
            </Dropdown.Item>
            <Dropdown.Item id="right" textValue="Right">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Right</Label>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="share" textValue="Share">
              <Label>Share</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Menu aria-label="Share" onAction={(key) => ddAction.set(String(key))}>
              <Dropdown.Item id="mail">Mail</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.SubmenuTrigger>
        </Dropdown.Menu>
      </Dropdown>
      <output id="dd-action">{ddAction()}</output>

      <Pagination id="pg" class="justify-center">
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous id="pg-prev" isDisabled={page() === 1} onPress={() => page.set(page() - 1)}>
              <Pagination.PreviousIcon />
              <span>Previous</span>
            </Pagination.Previous>
          </Pagination.Item>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Pagination.Item>
              <Pagination.Link id={`pg-${p}`} isActive={p === page()} onPress={() => page.set(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ))}
          <Pagination.Item>
            <Pagination.Next id="pg-next" isDisabled={page() === totalPages} onPress={() => page.set(page() + 1)}>
              <span>Next</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
      <output id="pg-page">{page()}</output>

      {/* Identity T22 shorthand forms (resumed): Pagination `total`, TagGroup `label` + `items`, Breadcrumbs `items`. */}
      <Pagination id="pg-auto" total={12} page={autoPage} />
      <output id="pg-auto-page">{autoPage()}</output>
      <Pagination id="pg-default" total={5} defaultPage={3} onPageChange={(p: number) => defaultSeen.set(p)} />
      <output id="pg-default-page">{defaultSeen()}</output>
      <Pagination id="pg-acc" total={6} page={() => accPage()} onPageChange={(p: number) => accPage.set(p)} />
      <output id="pg-acc-page">{accPage()}</output>
      <button id="pg-acc-last" type="button" onClick={() => accPage.set(6)}>
        Last
      </button>
      <TagGroup id="tg-auto" label="Amenities" selectionMode="single" items={amenities} selectedKeys={tgSel}>
        {(item: { id: string; name: string }) => <Tag id={item.id}>{item.name}</Tag>}
      </TagGroup>
      <output id="tg-auto-sel">{[...(tgSel() as Set<string>)].join(",")}</output>
      <Breadcrumbs id="bc-auto" items={[{ label: "Home", href: "#home" }, { label: "Docs", href: "#docs" }, { label: "Here" }]} />
    </section>
  );
}
