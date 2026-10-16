import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem, ListBoxSection, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { Header } from "@rivetjs/cdk/header";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "ListBox" };

const fruits = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry", disabled: true },
  { key: "date", label: "Date" },
  { key: "elderberry", label: "Elderberry" },
];

const numbered = [
  { key: 1, label: "One" },
  { key: 2, label: "Two" },
  { key: 3, label: "Three" },
];

const links = [
  { key: "home", label: "Home", href: "/" },
  { key: "tabs", label: "Tabs", href: "/tabs" },
];

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "kangaroo", label: "Kangaroo" },
];

const zeros = [
  { key: 0, label: "Zero" },
  { key: 1, label: "One" },
  { key: 2, label: "Two" },
];

const tiles = Array.from({ length: 6 }, (_, i) => ({ key: "t" + i, label: "Tile " + i }));

// Sorted: Sets keep insertion order, RAC compares selections as sets.
const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].sort((a, b) => String(a).localeCompare(String(b))).join(", "));

export default function ListBoxStory() {
  const picked = signal<Selection>(new Set<Key>(["banana"]));
  const many = signal<Selection>(new Set<Key>());
  const grouped = signal<Selection>(new Set<Key>());
  const nums = signal<Selection>(new Set<Key>([2]));
  const replace = signal<Selection>(new Set<Key>());
  const action = signal("none");
  const single = signal<Selection>(new Set<Key>());
  const singleCalls = signal(0);
  const touch = signal<Selection>(new Set<Key>());
  const touchAction = signal(0);
  const noesc = signal<Selection>(new Set<Key>(["cat", "dog"]));
  const pressUp = signal<Selection>(new Set<Key>());
  const zero = signal<Selection>(new Set<Key>());
  const grid = signal<Selection>(new Set<Key>());
  return (
    <section>
      <h1 id="lb-title">ListBox</h1>
      <h2 id="fruit-label">Fruit (single)</h2>
      <ListBox id="fruit" aria-labelledby="fruit-label" items={fruits} selectionMode="single" selectedKeys={picked} />
      <p id="fruit-value">Picked: {show(picked())}</p>
      <h2 id="many-label">Fruit (multiple)</h2>
      <ListBox id="many" aria-labelledby="many-label" items={fruits} selectionMode="multiple" selectedKeys={many} />
      <p id="many-value">Picked: {show(many())}</p>
      <h2 id="grouped-label">Sections</h2>
      <ListBox id="grouped" aria-labelledby="grouped-label" selectionMode="multiple" selectedKeys={grouped}>
        <ListBoxSection id="fruit">
          <Header>Fruit</Header>
          <ListBoxItem id="pear">Pear</ListBoxItem>
          <ListBoxItem id="plum" textValue="Plum">
            <Text slot="label">Plum</Text>
            <Text slot="description">Stone fruit</Text>
          </ListBoxItem>
        </ListBoxSection>
        <ListBoxSection id="veg">
          <Header>Vegetables</Header>
          <ListBoxItem id="leek">Leek</ListBoxItem>
          <ListBoxItem id="kale">Kale</ListBoxItem>
        </ListBoxSection>
      </ListBox>
      <p id="grouped-value">Picked: {show(grouped())}</p>
      <h2 id="nums-label">Numeric keys</h2>
      <ListBox id="nums" aria-labelledby="nums-label" items={numbered} selectionMode="single" selectedKeys={nums} />
      <p id="nums-value">
        Picked: {show(nums())} ({typeof [...(nums() as Set<Key>)][0]})
      </p>
      <h2 id="replace-label">Replace behaviour + actions</h2>
      <ListBox
        id="replace"
        aria-labelledby="replace-label"
        items={fruits}
        selectionMode="multiple"
        selectionBehavior="replace"
        selectedKeys={replace}
        onAction={(key) => action.set(String(key))}
      />
      <p id="replace-value">
        Picked: {show(replace())}; action: {action()}
      </p>
      <h2 id="links-label">Links</h2>
      <ListBox id="links" aria-labelledby="links-label" items={links} selectionMode="none" />
      <h2 id="empty-label">Empty</h2>
      <ListBox id="empty" aria-labelledby="empty-label" items={[]} renderEmptyState={() => "No results"} />
      <h2 id="single-label">Single + replace (onSelectionChange)</h2>
      <button id="single-before" type="button">
        Before
      </button>
      <ListBox
        id="single"
        aria-labelledby="single-label"
        items={animals}
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={single}
        onSelectionChange={() => singleCalls.set(singleCalls() + 1)}
      />
      <p id="single-value">
        Picked: {show(single())}; calls: {singleCalls()}
      </p>
      <h2 id="touch-label">Toggle + onAction (long press selects)</h2>
      <ListBox
        id="touch"
        aria-labelledby="touch-label"
        items={animals}
        selectionMode="multiple"
        selectedKeys={touch}
        onAction={() => touchAction.set(touchAction() + 1)}
      />
      <p id="touch-value">
        Picked: {show(touch())}; actions: {touchAction()}
      </p>
      <h2 id="horiz-label">Horizontal</h2>
      <ListBox id="horiz" aria-labelledby="horiz-label" items={animals} orientation="horizontal" />
      <h2 id="grid-label">Grid layout</h2>
      <ListBox id="grid" aria-labelledby="grid-label" items={tiles} layout="grid" selectionMode="multiple" selectedKeys={grid} />
      <p id="grid-value">Picked: {show(grid())}</p>
      <h2 id="hover-label">Focus on hover</h2>
      <ListBox id="hover" aria-labelledby="hover-label" items={animals} shouldFocusOnHover />
      <h2 id="noesc-label">escapeKeyBehavior none</h2>
      <ListBox id="noesc" aria-labelledby="noesc-label" items={animals} selectionMode="multiple" selectedKeys={noesc} escapeKeyBehavior="none" />
      <p id="noesc-value">Picked: {show(noesc())}</p>
      <h2 id="pressup-label">shouldSelectOnPressUp</h2>
      <ListBox id="pressup" aria-labelledby="pressup-label" items={animals} selectionMode="single" selectedKeys={pressUp} shouldSelectOnPressUp />
      <p id="pressup-value">Picked: {show(pressUp())}</p>
      <h2 id="zero-label">Falsy keys (replace)</h2>
      <ListBox id="zero" aria-labelledby="zero-label" items={zeros} selectionMode="multiple" selectionBehavior="replace" selectedKeys={zero} />
      <p id="zero-value">Picked: {show(zero())}</p>
      <div class="spacer"></div>
    </section>
  );
}
