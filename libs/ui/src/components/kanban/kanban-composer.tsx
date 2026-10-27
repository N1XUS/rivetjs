// Rivet addition (SHOWCASE-1 2026-10-27; no HeroUI / HeroUI Pro counterpart): the "add a card" row of a Kanban column.
// - Closed: a full-width ghost ui `Button` (lucide Plus + `label`). Open: an inline `form` with a ui `TextField` > `Input`
//   (focused on open) + an Add (submit) and a Cancel button. Enter submits, Escape (in the field) or Cancel closes; an
//   empty / blank title is ignored. After a submit the field clears and the composer closes (focus back on the trigger),
//   or stays open for the next card with `keepOpen`.
// - Open state = cdk `controllable` (`isOpen` value / two-way Signal / accessor, `defaultOpen`, `onOpenChange`).
// - Ids: `id` on the trigger, `${id}-input` / `${id}-submit` on the field input / Add button (stable test hooks).
// - Own export (`KanbanComposer`, not `Kanban.Composer`): a board without a composer loads no Button / TextField code.
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { Plus } from "lucide";

import { kanbanVariants } from "../../../styles/src/components/kanban/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { ButtonRoot } from "../button/button.tsx";
import { InputRoot } from "../input/input.tsx";
import { TextFieldRoot } from "../textfield/textfield.tsx";

const S = kanbanVariants();

interface KanbanComposerProps {
  /** Called with the trimmed title (never empty). */
  onSubmit: (title: string) => void;
  /** Trigger text and the field's accessible name. @default "Add a card" */
  label?: string;
  /** Field placeholder. @default "Card title" */
  placeholder?: string;
  /** Submit button text. @default "Add card" */
  submitLabel?: string;
  /** Cancel button text. @default "Cancel" */
  cancelLabel?: string;
  /** Open state (value, two-way Signal or accessor). */
  isOpen?: boolean | Signal<boolean> | (() => boolean);
  /** @default false */
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  /** Stay open (field cleared, focused) after a submit, for the next card. @default false */
  keepOpen?: boolean;
  /** Trigger id; the input gets `${id}-input`, the Add button `${id}-submit`. */
  id?: string;
  class?: string;
}

/** The "add a card" row of a column: a trigger that opens an inline title form. */
function KanbanComposer(props: KanbanComposerProps): JSX.Element {
  const { onSubmit, label, placeholder, submitLabel, cancelLabel, keepOpen, id, class: cls } = props;
  const open = controllable(props.isOpen, props.defaultOpen ?? false, props.onOpenChange);
  const draft = signal("");
  const name = label ?? "Add a card";
  // Focus returns to the trigger once the closed branch is rendered (found from the element the event came from).
  const close = (from: Element | null) => {
    const host = from?.closest('[data-slot="kanban-composer"]');
    draft.set("");
    setControlledValue(open, false);
    setTimeout(() => host?.querySelector<HTMLElement>('[data-slot="kanban-composer-trigger"]')?.focus(), 0);
  };
  return (
    <div class={composeSlotClassName(S.composer, cls)} data-slot="kanban-composer">
      {open.value() ? (
        <form
          class={S.composerForm()}
          data-slot="kanban-composer-form"
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
            const title = draft().trim();
            if (!title) return;
            onSubmit(title);
            if (keepOpen) draft.set("");
            else close(event.currentTarget as Element);
          }}
        >
          <TextFieldRoot aria-label={name} value={draft} autoFocus fullWidth>
            <InputRoot
              id={id ? `${id}-input` : undefined}
              placeholder={placeholder ?? "Card title"}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                close(event.currentTarget as Element);
              }}
            />
          </TextFieldRoot>
          <div class={S.composerActions()}>
            <ButtonRoot id={id ? `${id}-submit` : undefined} type="submit" size="sm">
              {submitLabel ?? "Add card"}
            </ButtonRoot>
            <ButtonRoot size="sm" variant="ghost" onPress={(event: { target: Element }) => close(event.target)}>
              {cancelLabel ?? "Cancel"}
            </ButtonRoot>
          </div>
        </form>
      ) : (
        <ButtonRoot
          id={id}
          variant="ghost"
          size="sm"
          class={S.composerTrigger()}
          data-slot="kanban-composer-trigger"
          onPress={() => setControlledValue(open, true)}
        >
          <Icon icon={Plus} size={16} />
          {name}
        </ButtonRoot>
      )}
    </div>
  );
}

export { KanbanComposer };
export type { KanbanComposerProps };
