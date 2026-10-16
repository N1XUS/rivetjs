// Test fixture: minimal collection parts on `collections/components.tsx` (live + build modes).
import { useContext } from "@rivetjs/reactivity";
import { CollectionRendererContext, Collection, collectionOf, createBranchComponent, createLeafComponent, isHidden } from "../../collections/components.tsx";

export const Item = createLeafComponent("item", function Item(props: { id?: string; children?: unknown; textValue?: string }, _ref, node) {
  return (
    <div role="option" data-key={String(node.key)} data-level={String(node.level)} data-parent={node.parentKey == null ? undefined : String(node.parentKey)}>
      {props.children as never}
    </div>
  );
});

export const Sec = createBranchComponent("section", function Sec(_props: { id?: string; children?: unknown }, _ref, node) {
  const renderer = useContext(CollectionRendererContext);
  return (
    <section role="group" data-key={String(node.key)}>
      {renderer.CollectionBranch({ collection: null, parent: node }) as never}
    </section>
  );
});

/** Live host: renders the parts in place and reports the built collection's size and keys. */
export function Host(props: { items?: { id: string; name: string }[]; children?: unknown }) {
  if (isHidden()) return <Collection items={props.items}>{props.children}</Collection>;
  const renderer = useContext(CollectionRendererContext);
  const items = props.items;
  const children = props.children;
  const content = () => <Collection items={items}>{children}</Collection>;
  const built = collectionOf(content);
  const keys = [...built().getKeys()].join(",");
  const texts = [...built()].map((n) => n.textValue).join(",");
  return (
    <div role="listbox" data-size={String(built().size)} data-keys={keys} data-texts={texts}>
      {renderer.CollectionRoot({ collection: null, content }) as never}
    </div>
  );
}

/** Built host: renders from the collection (node.render). */
export function BuiltHost(props: { children?: unknown }) {
  const renderer = useContext(CollectionRendererContext);
  const children = props.children;
  const built = collectionOf(() => <Collection>{children}</Collection>);
  return <div role="listbox">{renderer.CollectionRoot({ collection: built }) as never}</div>;
}

/** Live-only host (no build pass): the parts render once, in place. */
export function LiveHost(props: { children?: unknown }) {
  const renderer = useContext(CollectionRendererContext);
  const children = props.children;
  const content = () => <Collection>{children}</Collection>;
  return <div role="listbox">{renderer.CollectionRoot({ collection: null, content }) as never}</div>;
}

/** Counts its renders (regression: live parts must not evaluate their children twice). */
export const renders = { count: 0 };
export function Probe() {
  renders.count++;
  return <span>probe</span>;
}

/** Branch whose children derive from its id (RAC useCachedChildren passes the resolved key as `id`). */
export const IdBranch = createBranchComponent(
  "section",
  function IdBranch(_props: { id?: string; children?: unknown }, _ref, node) {
    const renderer = useContext(CollectionRendererContext);
    return (
      <section role="group" data-key={String(node.key)}>
        {renderer.CollectionBranch({ collection: null, parent: node }) as never}
      </section>
    );
  },
  (props: { id?: string; children?: unknown }) => <Item id={String(props.id) + "-child"}>{String(props.id)}</Item>,
);

/** Leaf echoing the `id` prop it is rendered with ("none" when absent). */
export const IdProbe = createLeafComponent("item", function IdProbe(props: { id?: string }, _ref, _node) {
  return <i data-id={props.id == null ? "none" : String(props.id)}></i>;
});
