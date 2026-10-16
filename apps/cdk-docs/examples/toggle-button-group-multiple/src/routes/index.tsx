import { signal } from "@rivetjs/reactivity";
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Button } from "@rivetjs/cdk/button";
import type { Key } from "@rivetjs/cdk/types";
import { Bold, Italic, Strikethrough, Underline } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ToggleButtonGroup (multiple, controlled)" };

// #region demo
export default function TextStyle() {
  const styles = signal<Iterable<Key>>(new Set<Key>(["bold"]));
  const btn = "rounded-md border p-1.5 aria-pressed:bg-slate-900 aria-pressed:text-white disabled:opacity-40";
  return (
    <div class="m-4 grid gap-3 text-sm">
      <ToggleButtonGroup id="styles" aria-label="Text style" selectionMode="multiple" selectedKeys={styles} class="flex gap-1">
        <ToggleButton id="bold" aria-label="Bold" class={btn}>
          <Icon icon={Bold} />
        </ToggleButton>
        <ToggleButton id="italic" aria-label="Italic" class={btn}>
          <Icon icon={Italic} />
        </ToggleButton>
        <ToggleButton id="underline" aria-label="Underline" class={btn}>
          <Icon icon={Underline} />
        </ToggleButton>
        <ToggleButton id="strike" aria-label="Strikethrough" isDisabled class={btn}>
          <Icon icon={Strikethrough} />
        </ToggleButton>
      </ToggleButtonGroup>
      <p id="styles-value">Styles: {[...styles()].join(", ") || "none"}</p>
      <Button id="clear" class="w-fit rounded border px-2 py-1" onPress={() => styles.set(new Set())}>
        Clear
      </Button>
    </div>
  );
}
// #endregion
