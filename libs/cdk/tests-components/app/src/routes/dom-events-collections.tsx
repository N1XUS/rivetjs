import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem, ListBoxSection, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { Header } from "@rivetjs/cdk/header";
import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";
import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualForOf, CdkVirtualScrollableElement } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "DOM events: collections" };

const rows = Array.from({ length: 1000 }, (_, i) => i);

export default function DomEventsCollectionsStory() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const picked = signal<Selection>(new Set<Key>());
  const tab = signal<Key | null>("one");
  const action = signal<Key | null>(null);
  const viewport = createVirtualScroll({ id: "d-vp", items: rows, itemSize: 50, initialViewportSize: 200 });
  // Signal-valued props plus JSX content on elements that also forward global DOM props (spread):
  // the spread element's binding must not capture the props object (its JSX is not serializable).
  const jsxPicked = signal<Selection>(new Set<Key>());
  const jsxTab = signal<Key | null>("one");
  const jsxAction = signal<Key | null>(null);
  const jsxLoading = signal(false);
  const jsxViewport = createVirtualScroll({ id: "j-vp", items: rows, itemSize: 50, initialViewportSize: 200 });
  const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].join(","));
  return (
    <section>
      <h1>DOM events: collections</h1>
      <ListBox
        id="d-list"
        aria-label="Fruit"
        selectionMode="single"
        selectedKeys={picked}
        lang="en"
        dir="ltr"
        onPointerEnter={() => add("list-enter")}
        onClick={() => add("list-click")}
        onContextMenu={(e) => {
          e.preventDefault();
          add("list-menu");
        }}
      >
        <ListBoxItem id="apple" lang="fr" onDblClick={() => add("apple-dbl")}>
          Apple
        </ListBoxItem>
        <ListBoxItem id="pear" onPointerEnter={() => add("pear-enter")}>
          Pear
        </ListBoxItem>
        <ListBoxSection id="sec" lang="de" onWheel={() => add("sec-wheel")}>
          <Header>More</Header>
          <ListBoxItem id="plum" onContextMenu={() => add("plum-menu")}>
            Plum
          </ListBoxItem>
        </ListBoxSection>
      </ListBox>
      <p id="d-picked">{show(picked())}</p>
      <Tabs id="d-tabs" selectedKey={tab} lang="en" onPointerEnter={() => add("tabs-enter")}>
        <TabList aria-label="Tabs" dir="ltr" onClick={() => add("tablist-click")} onDblClick={() => add("tablist-dbl")}>
          <Tab id="one" onContextMenu={() => add("tab-one-menu")}>
            One
          </Tab>
          <Tab id="two" lang="it">
            Two
          </Tab>
        </TabList>
        <TabPanel id="one" shouldForceMount>
          {() => <p>One panel</p>}
        </TabPanel>
        <TabPanel id="two" shouldForceMount lang="es" onDblClick={() => add("panel-two-dbl")}>
          {() => <p>Two panel</p>}
        </TabPanel>
      </Tabs>
      <p id="d-tab">{String(tab())}</p>
      {/* RA: a mouse press opens the menu on pointerdown; the popover underlay then gets the pointerup, so
          usePress cancels and the trigger's onPress never fires — onPressStart does. */}
      <MenuTrigger>
        <Button id="d-menu-trigger" lang="en" onPointerEnter={() => add("trigger-enter")} onPressStart={() => add("trigger-click")}>
          Actions
        </Button>
        <Popover>
          <Menu id="d-menu" lang="pt" onAction={(key) => action.set(key)} onClick={() => add("menu-click")} onPointerEnter={() => add("menu-enter")}>
            <MenuItem id="copy" onContextMenu={() => add("copy-menu")}>
              Copy
            </MenuItem>
            <MenuItem id="paste" lang="nl">
              Paste
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p id="d-action">{String(action())}</p>
      <Virtualizer
        id="d-virt"
        role="list"
        label="Rows"
        items={rows}
        getKey={(n) => n}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32 }}
        initialSize={{ width: 200, height: 100 }}
        style={{ width: "200px", height: "100px" }}
        lang="en"
        onScroll={() => add("virt-scroll")}
        onWheel={() => add("virt-wheel")}
        onPointerEnter={() => add("virt-enter")}
      >
        {(n) => (
          <div role="listitem" class="vrow" style={{ height: "32px" }}>
            Row {n()}
          </div>
        )}
      </Virtualizer>
      <div style={{ display: "grid", height: "200px", width: "200px" }}>
        <CdkVirtualScrollViewport
          state={viewport}
          class="vp"
          lang="en"
          onScroll={() => add("vp-scroll")}
          onPointerEnter={() => add("vp-enter")}
          onDblClick={() => add("vp-dbl")}
        >
          {(n) => (
            <div class="row" style={{ height: "50px" }}>
              Item {n()}
            </div>
          )}
        </CdkVirtualScrollViewport>
      </div>
      <div style={{ display: "grid", height: "100px", width: "200px" }}>
        <CdkVirtualScrollableElement
          id="d-scrollable"
          class="d-scrollable"
          states={[]}
          lang="en"
          onScroll={() => add("scrollable-scroll")}
          onPointerEnter={() => add("scrollable-enter")}
        >
          <div style={{ height: "400px" }}>Tall</div>
        </CdkVirtualScrollableElement>
      </div>
      <ListBox
        id="j-list"
        aria-label="JSX list"
        selectionMode="single"
        selectedKeys={jsxPicked}
        lang="en"
        onPointerEnter={() => add("j-list-enter")}
        renderEmptyState={() => <i>Nothing</i>}
        items={[
          { key: "a", label: "A" },
          { key: "b", label: "B" },
        ]}
      >
        {(item: { key: string; label: string }) => (
          <ListBoxItem id={item.key} textValue={item.label}>
            <b>{item.label}</b>
          </ListBoxItem>
        )}
      </ListBox>
      <p id="j-picked">{show(jsxPicked())}</p>
      <Tabs
        id="j-tabs"
        aria-label="JSX tabs"
        selectedKey={jsxTab}
        lang="en"
        items={[
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
        ]}
        tab={(item) => <b>{item.label}</b>}
        panel={(item) => (
          <p>
            <i>{item.label}</i> panel
          </p>
        )}
      />
      <p id="j-tab">{String(jsxTab())}</p>
      <MenuTrigger>
        <Button id="j-menu-trigger" lang="en">
          <b>JSX actions</b>
        </Button>
        <Popover>
          <Menu id="j-menu" onAction={(key) => jsxAction.set(key)}>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p id="j-action">{String(jsxAction())}</p>
      <Virtualizer
        id="j-virt"
        role="list"
        label="JSX rows"
        items={rows}
        isLoading={jsxLoading}
        getKey={(n) => n}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32 }}
        initialSize={{ width: 200, height: 100 }}
        style={{ width: "200px", height: "100px" }}
        lang="en"
      >
        {(n) => (
          <div role="listitem" style={{ height: "32px" }}>
            <b>Row {n()}</b>
          </div>
        )}
      </Virtualizer>
      <div style={{ display: "grid", height: "200px", width: "200px" }}>
        <CdkVirtualScrollViewport state={jsxViewport} label="JSX viewport" class="vp" lang="en">
          <ul>
            <CdkVirtualForOf state={jsxViewport}>
              {(n) => (
                <li class="jrow" style={{ height: "50px" }}>
                  <b>Item {n()}</b>
                </li>
              )}
            </CdkVirtualForOf>
          </ul>
        </CdkVirtualScrollViewport>
      </div>
      <div style={{ display: "grid", height: "100px", width: "200px" }}>
        <CdkVirtualScrollableElement id="j-scrollable" states={[]} lang="en" onPointerEnter={() => add("j-scrollable-enter")}>
          <div style={{ height: "400px" }}>
            <b>JSX scrollable</b>
          </div>
        </CdkVirtualScrollableElement>
      </div>
      <p id="d-log">{log().join(" ")}</p>
    </section>
  );
}
