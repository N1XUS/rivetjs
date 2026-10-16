import { signal } from "@rivetjs/reactivity";
import { navigationKeys, nextIndex } from "@rivetjs/cdk/keys";
import { roveFocus } from "@rivetjs/cdk/focus";
import { direction } from "@rivetjs/cdk/bidi";

const options = { orientation: "horizontal", wrap: true } as const;

// #region demo
/** keydown on the toolbar: arrows (mirrored in right-to-left), Home and End move the tab stop. */
function move(event: KeyboardEvent & { currentTarget: HTMLElement }) {
  const buttons = [...event.currentTarget.querySelectorAll("button")];
  const from = buttons.indexOf((event.target as Element).closest("button")!);
  const to = nextIndex(buttons.length, from, event.key, {
    ...options,
    dir: direction(event.currentTarget),
    isDisabled: (i) => buttons[i]!.disabled,
  });
  if (to === null) return; // not a navigation key: let it through
  event.preventDefault();
  roveFocus(buttons, buttons[to]!);
}

export function Toolbar(props: { id: string; label: string }) {
  const bold = signal(false);
  const italic = signal(false);
  const underline = signal(false);
  const { id } = props;
  return (
    // data-rk: keys held while this handler's code loads on a resumed page (no scroll on a cold key).
    <div role="toolbar" id={id} aria-label={props.label} data-rk={navigationKeys(options)} onKeyDown={move} class="flex gap-1">
      <button type="button" id={id + "-bold"} aria-pressed={bold() ? "true" : "false"} onClick={() => bold.set(!bold())}>
        Bold
      </button>
      <button type="button" id={id + "-italic"} tabIndex={-1} aria-pressed={italic() ? "true" : "false"} onClick={() => italic.set(!italic())}>
        Italic
      </button>
      <button type="button" id={id + "-underline"} tabIndex={-1} aria-pressed={underline() ? "true" : "false"} onClick={() => underline.set(!underline())}>
        Underline
      </button>
      <button type="button" id={id + "-link"} tabIndex={-1} disabled>
        Link
      </button>
    </div>
  );
}
// #endregion
