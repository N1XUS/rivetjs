import { signal } from "@rivetjs/reactivity";
import { For, ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { OVERFLOW, createOverflow } from "@rivetjs/cdk/overflow";
import { Popover } from "@rivetjs/cdk/popover";
import { Toolbar } from "@rivetjs/cdk/toolbar";
import { Icon } from "@rivetjs/kit/icon";
import { Ellipsis } from "lucide";

export const head = { title: "Overflow: collapsing toolbar" };

const actions = [
  { id: "reply", label: "Reply" },
  { id: "forward", label: "Forward" },
  { id: "label", label: "Label" },
  { id: "snooze", label: "Snooze" },
  { id: "archive", label: "Archive" },
  { id: "delete", label: "Delete" },
];
type Action = (typeof actions)[number];

// #region demo
export default function EditorActions() {
  const last = signal("none");
  const toolbar = ref<HTMLDivElement>();
  // ActionGroup-style: keep the leading actions that fit, collapse the tail into the overflow element.
  const overflow = createOverflow<Action>({ ref: toolbar, items: () => actions, collapse: "end" });
  const run = (id: unknown) => last.set(actions.find((a) => a.id === id)?.label ?? "none");
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div class="w-[300px] max-w-full resize-x overflow-hidden rounded-lg border border-slate-300 p-2">
        {/* The toolbar's own children are the measured items: the actions, then the "More" trigger. */}
        <Toolbar id="editor-actions" ref={toolbar} aria-label="Message actions" class="flex gap-1">
          <For each={overflow.items} by={(item: Action | typeof OVERFLOW) => (item === OVERFLOW ? item : item.id)}>
            {(item: () => Action | typeof OVERFLOW) => {
              const value = item();
              return value === OVERFLOW ? (
                <MenuTrigger>
                  <Button aria-label="More actions" class="grid size-8 shrink-0 place-items-center rounded hover:bg-slate-100">
                    <Icon icon={Ellipsis} size={16} />
                  </Button>
                  <Popover placement="bottom end">
                    <Menu id="more-actions" items={overflow.hidden()} onAction={run} class="min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      {(action: Action) => (
                        <MenuItem id={action.id} class="cursor-default rounded px-2 py-1 focused:bg-slate-100">
                          {action.label}
                        </MenuItem>
                      )}
                    </Menu>
                  </Popover>
                </MenuTrigger>
              ) : (
                <Button data-action={value.id} onPress={() => run(value.id)} class="shrink-0 rounded border border-slate-300 px-3 py-1 hover:bg-slate-50">
                  {value.label}
                </Button>
              );
            }}
          </For>
        </Toolbar>
      </div>
      <p id="last-action">Last action: {last()}</p>
    </section>
  );
}
// #endregion
