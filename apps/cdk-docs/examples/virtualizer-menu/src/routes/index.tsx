import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { ListLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: Menu" };

interface Command {
  id: number;
  name: string;
}

const commands: Command[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Command ${i + 1}` }));

// #region demo
export default function Commands() {
  const last = signal("none");
  return (
    <section class="stack">
      <MenuTrigger>
        <Button id="commands-trigger">Commands</Button>
        <Popover placement="bottom start">
          {/* The menu element is the scroll container: its CSS size matches initialSize. */}
          <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 220, height: 256 }}>
            <Menu id="commands" aria-label="Commands" items={commands} onAction={(key) => last.set(`Command ${key}`)}>
              {(command: Command) => (
                <MenuItem id={command.id} textValue={command.name}>
                  {command.name}
                </MenuItem>
              )}
            </Menu>
          </CollectionVirtualizer>
        </Popover>
      </MenuTrigger>
      <output id="commands-value">Last action: {last()}</output>
    </section>
  );
}
// #endregion
