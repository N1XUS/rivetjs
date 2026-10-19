// collections/components.tsx build pass (F3): signal reads inside nested parts (`items` accessors, dynamic
// `{() => …}` children, nested `Collection`s) rebuild the collection; a rebuilt node that renders the same keeps its
// rendered part (DOM element, focus), a node whose render inputs changed re-renders (`sameRender` / `renderNodeAt`).
import { afterEach, describe, expect, it } from "vitest";
import { createContext, provide, signal, untrack, useContext } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Collection, DefaultCollectionRenderer, collectionOf, createBranchComponent, createLeafComponent, sameRender } from "../collections/components.tsx";
import { BaseCollection, ItemNode, type CollectionNode } from "../collections/base.ts";
import type { Collection as ICollection, Key, Node } from "../collections/types.ts";

afterEach(() => cleanup());

type Built = () => ICollection<Node<unknown>>;
const BuiltContext = createContext<Built | null>(null);
const renders = { count: 0 };

const Item = createLeafComponent("item", function Item(props: { id?: Key; children?: unknown; textValue?: string }, _ref, node) {
  renders.count++;
  return (
    <div role="option" tabIndex={-1} data-key={String(node.key)}>
      {props.children as never}
    </div>
  );
});

const Group = createBranchComponent("section", function Group(_props: { id?: Key; items?: unknown; children?: unknown }, _ref, node) {
  const built = useContext(BuiltContext);
  const key = node.key;
  return (
    <section role="group" data-key={String(key)}>
      {DefaultCollectionRenderer.CollectionBranch({ collection: built, parent: { key } as never }) as never}
    </section>
  );
});

/** Renders a built collection node by node and exposes it (`probe.built`). */
const probe: { built: Built | null } = { built: null };
function BuiltList(props: { children?: unknown }) {
  const children = props.children;
  const build = { content: () => <Collection>{children}</Collection> };
  const built = collectionOf(build.content) as Built;
  probe.built = built;
  return <div role="listbox">{provide(BuiltContext, built, () => DefaultCollectionRenderer.CollectionRoot({ collection: built })) as never}</div>;
}

const keysOf = (): string[] => [...probe.built!().getKeys()].map(String);
const option = (container: ParentNode, key: string) => container.querySelector(`[data-key="${key}"]`) as HTMLElement | null;

describe("collection build pass tracks nested reads", () => {
  it("rebuilds when an `items` signal of a nested branch changes", async () => {
    const items = signal([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    const { container } = render(() => (
      <BuiltList>
        <Group id="g" items={items}>
          {(item: { id: string; name: string }) => <Item>{item.name}</Item>}
        </Group>
      </BuiltList>
    ));
    expect(keysOf()).toEqual(["g", "a", "b"]);
    items.set([...items(), { id: "c", name: "C" }]);
    await flush();
    expect(keysOf()).toEqual(["g", "a", "b", "c"]);
    expect(container.textContent).toBe("ABC");
  });

  it("rebuilds when a dynamic `{() => …}` child's condition changes (root and nested)", async () => {
    const show = signal(false);
    const { container } = render(() => (
      <BuiltList>
        <Group id="g">
          <Item id="y">Y</Item>
          {() => (show() ? <Item id="inner">Inner</Item> : null)}
        </Group>
        {() => [show() ? <Item id="create">Create</Item> : null, <Item id="x">X</Item>]}
      </BuiltList>
    ));
    expect(keysOf()).toEqual(["g", "y", "x"]);
    show.set(true);
    await flush();
    expect(keysOf()).toEqual(["g", "y", "inner", "create", "x"]);
    expect(container.textContent).toBe("YInnerCreateX");
    show.set(false);
    await flush();
    expect(keysOf()).toEqual(["g", "y", "x"]);
    expect(container.textContent).toBe("YX");
  });

  it("a dynamic child mixed with eager siblings registers where it sits (build marks; JSX evaluates the siblings first)", async () => {
    const show = signal(true);
    render(() => (
      <BuiltList>
        {() => (show() ? <Item id="create">Create</Item> : null)}
        <Item id="x">X</Item>
      </BuiltList>
    ));
    expect(keysOf()).toEqual(["create", "x"]);
    show.set(false);
    await flush();
    expect(keysOf()).toEqual(["x"]);
  });

  it("a dynamic child between eager siblings (root and nested) keeps document order across rebuilds", async () => {
    const show = signal(false);
    const { container } = render(() => (
      <BuiltList>
        <Item id="a">A</Item>
        {() => (show() ? <Item id="b">B</Item> : null)}
        <Item id="c">C</Item>
        <Group id="g">
          <Item id="y">Y</Item>
          {() => (show() ? [<Item id="z1">Z1</Item>, <Item id="z2">Z2</Item>] : null)}
          <Item id="w">W</Item>
        </Group>
      </BuiltList>
    ));
    expect(keysOf()).toEqual(["a", "c", "g", "y", "w"]);
    show.set(true);
    await flush();
    expect(keysOf()).toEqual(["a", "b", "c", "g", "y", "z1", "z2", "w"]);
    expect(container.textContent).toBe("ABCYZ1Z2W");
    show.set(false);
    await flush();
    expect(keysOf()).toEqual(["a", "c", "g", "y", "w"]);
  });

  it("rebuilds through a nested Collection with a signal `items` inside a user component", async () => {
    const cols = signal(["n", "t"]);
    function Columns() {
      return <Collection items={() => cols().map((id) => ({ id }))}>{(c: { id: string }) => <Item>{c.id}</Item>}</Collection>;
    }
    render(() => (
      <BuiltList>
        <Columns />
      </BuiltList>
    ));
    expect(keysOf()).toEqual(["n", "t"]);
    cols.set(["t"]);
    await flush();
    expect(keysOf()).toEqual(["t"]);
  });

  it("an untracked read in the content stays untracked", async () => {
    const s = signal(1);
    const runs = { n: 0 };
    render(() => (
      <BuiltList>
        {() => {
          runs.n++;
          untrack(s);
          return <Item id="a">A</Item>;
        }}
      </BuiltList>
    ));
    const before = runs.n;
    s.set(2);
    await flush();
    probe.built!();
    expect(runs.n).toBe(before);
  });
});

describe("built rows keep their rendered part across rebuilds", () => {
  it("unchanged nodes keep their element (and focus); changed nodes re-render", async () => {
    const a = { id: "a", name: "A" };
    const b = { id: "b", name: "B" };
    const c = { id: "c", name: "C" };
    const items = signal([a, b, c]);
    const { container } = render(() => (
      <BuiltList>
        <Collection items={items}>{(item: { id: string; name: string }) => <Item textValue={item.name}>{item.name}</Item>}</Collection>
      </BuiltList>
    ));
    const elB = option(container, "b")!;
    const elC = option(container, "c")!;
    elC.focus();
    renders.count = 0;
    // Remove a row: siblings' links / indexes change, their render inputs do not.
    items.set([b, c]);
    await flush();
    expect(option(container, "a")).toBeNull();
    expect(option(container, "b")).toBe(elB);
    expect(option(container, "c")).toBe(elC);
    expect(document.activeElement).toBe(elC);
    expect(renders.count).toBe(0);
    // A shallow-equal new item object renders the same.
    items.set([{ ...b }, c]);
    await flush();
    expect(option(container, "b")).toBe(elB);
    expect(renders.count).toBe(0);
    // A changed item re-renders only its row.
    items.set([{ ...b }, { ...c, name: "C2" }]);
    await flush();
    expect(option(container, "b")).toBe(elB);
    expect(option(container, "c")).not.toBe(elC);
    expect(option(container, "c")!.textContent).toBe("C2");
    expect(renders.count).toBe(1);
  });
});

describe("sameRender", () => {
  const node = (key: Key, init: Partial<CollectionNode<unknown>>, NodeClass: new (key: Key) => CollectionNode<unknown> = ItemNode) =>
    Object.assign(new NodeClass(key), init) as Node<unknown>;
  it("compares class, key, text, rendered and shallow props / value", () => {
    const f = () => 1;
    const g = () => 1;
    expect(sameRender(node("a", { props: { x: 1, f }, value: { n: 1 } }), node("a", { props: { x: 1, f: g }, value: { n: 1 } }))).toBe(true);
    expect(sameRender(node("a", { props: { x: 1 } }), node("a", { props: { x: 2 } }))).toBe(false);
    expect(sameRender(node("a", { value: { n: 1 } }), node("a", { value: { n: 2 } }))).toBe(false);
    expect(sameRender(node("a", { rendered: "A" }), node("a", { rendered: "B" }))).toBe(false);
    expect(sameRender(node("a", {}), node("b", {}))).toBe(false);
    expect(sameRender(node("a", { props: { f: () => 1 } }), node("a", { props: { f: () => 2 } }))).toBe(false);
  });
  it("skips the node class's liveProps", () => {
    class LiveNode extends ItemNode<unknown> {
      static readonly liveProps = ["width"];
    }
    expect(
      sameRender(node("a", { props: { width: 1 }, value: { width: 1 } }, LiveNode), node("a", { props: { width: 2 }, value: { width: 2 } }, LiveNode)),
    ).toBe(true);
    expect(sameRender(node("a", { props: { width: 1 } }), node("a", { props: { width: 2 } }))).toBe(false);
  });
  it("BaseCollection is unaffected", () => {
    expect(new BaseCollection().size).toBe(0);
  });
});
