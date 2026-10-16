import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Group } from "@rivetjs/cdk/group";
import { Link } from "@rivetjs/cdk/link";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Toolbar of cdk components" };

// #region demo
export default function Editor() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid gap-3 text-sm">
      <Toolbar aria-label="Editor" class="flex items-center gap-2">
        <ToggleButton id="c-bold" onChange={(isSelected) => add("bold:" + isSelected)}>
          Bold
        </ToggleButton>
        <Group aria-label="History" class="flex gap-1">
          <Button id="c-undo" onPress={() => add("undo")}>
            Undo
          </Button>
          <Button id="c-redo" onPress={() => add("redo")}>
            Redo
          </Button>
        </Group>
        <Link id="c-help" href="#help">
          Help
        </Link>
      </Toolbar>
      <output id="c-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
