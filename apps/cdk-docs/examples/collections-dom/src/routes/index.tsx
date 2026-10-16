import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { domCollection, keyAttrs } from "@rivetjs/cdk/collections/dom";
import { ExternalLink } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DOM collection" };

// #region demo
export default function Dom() {
  const nodes = signal<{ key: string; text: string }[]>([]);
  // The server-rendered markup is the collection: read it when a handler runs.
  const read = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    const collection = domCollection(event.currentTarget.parentElement!.querySelector("#inbox")!);
    nodes.set(
      [...collection.getKeys()].map((key) => {
        const node = collection.getItem(key)!;
        const parent = node.parentKey == null ? "" : ` in ${node.parentKey}`;
        return {
          key: String(key),
          text: `${typeof key} ${node.type} "${node.textValue}"${parent}${node.props.isDisabled ? " disabled" : ""}${node.props.href ? " href " + node.props.href : ""}`,
        };
      }),
    );
  };
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div>
        <div id="inbox" role="listbox" aria-label="Inbox" class="grid gap-0.5 rounded border border-slate-300 p-1">
          <div role="group" data-key="today" aria-label="Today">
            <div role="option" {...keyAttrs(1)}>
              Welcome
            </div>
            <div role="option" {...keyAttrs(2)} aria-disabled="true">
              Archived
            </div>
          </div>
          <a role="option" data-key="help" href="#help" data-text-value="Help centre">
            Help <Icon icon={ExternalLink} size={12} />
          </a>
          <div role="option" data-key="hidden" hidden>
            Hidden
          </div>
        </div>
        <button id="read" type="button" class="mt-2 rounded border border-slate-300 px-2" onClick={read}>
          domCollection(#inbox)
        </button>
      </div>
      <ul id="nodes" class="m-0 list-none p-0 font-mono text-xs">
        <For each={nodes} by={(node) => node.key}>
          {(node) => (
            <li>
              {node().key}: {node().text}
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
// #endregion
