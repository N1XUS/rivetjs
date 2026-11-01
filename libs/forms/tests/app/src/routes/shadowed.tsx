import type { PageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm, defaultValue, formId, onSubmit } from "@rivetjs/forms";
import { action } from "@rivetjs/forms/server";
import { shadowedForm } from "../forms/definitions.js";
import { load, actions } from "@rivetjs/router";

export const head = { title: "Shadowed members" };

const FIELDS = ["id", "action", "method", "elements", "reset", "noValidate"] as const;

// In-memory entries (per server process): the action stores the submitted values.
const entries: string[] = [];
export const loader = load(() => ({ entries: [...entries] }));
export const forms = actions({
  save: action(shadowedForm, (value) => {
    entries.push(FIELDS.map((name) => value[name]).join(","));
  }),
});

/**
 * Every field name is also an HTMLFormElement member (`form.id`, `form.action`, `form.elements`, `form.reset`…): named
 * controls replace those members on the element, so the library must read the form through attributes / the prototype.
 */
export default function ShadowedPage({ data }: PageProps<typeof loader>) {
  const form = createForm(shadowedForm, { result: actionResult() });
  return (
    <section>
      <h1>Shadowed members</h1>
      <ul id="entries">
        {data.entries.map((entry) => (
          <li>{entry}</li>
        ))}
      </ul>
      <form id={formId(form)} method="post" action="?/save" class="stack" onSubmit={(event) => onSubmit(shadowedForm, form, event)}>
        {FIELDS.map((name) => (
          <input id={`shadowed-${name}`} name={name} aria-label={name} class="input" required value={defaultValue(form, name)} />
        ))}
        <button id="shadowed-save" type="submit" class="button">
          Save
        </button>
      </form>
    </section>
  );
}
