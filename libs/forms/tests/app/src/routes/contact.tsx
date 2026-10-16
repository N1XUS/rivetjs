import {
  createForm,
  defaultValue,
  describedBy,
  fieldId,
  formId,
  isInvalid,
  lastResult,
  onBlur,
  onInput,
  onInvalid,
  onSubmit,
  submitting,
} from "@rivetjs/forms";
import { ErrorSummary, FieldError, FormStatus } from "@rivetjs/forms/components";
import { CONTACT_ENDPOINT, contactForm } from "../forms/definitions.js";

export const head = { title: "Contact" };

/**
 * Custom submit (`defineForm({ submit })`): resumed handlers validate in the browser, then the
 * definition's `submit` posts to a third-party endpoint. No JS: native POST to the same endpoint.
 * `onInvalidCapture`: the first submit, stopped by native `required` before any handler ran, reports
 * library messages (`invalid` is intent-class for the preload planner: no chunk before interaction).
 * `encType` (JSX / React spelling) renders as the HTML `enctype` attribute.
 */
export default function ContactPage() {
  const form = createForm(contactForm);
  return (
    <section>
      <h1>Contact</h1>
      <form
        id={formId(form)}
        method="post"
        action={CONTACT_ENDPOINT}
        encType="multipart/form-data"
        class="stack"
        aria-busy={submitting(form) ? "true" : undefined}
        onInput={(event) => onInput(contactForm, form, event)}
        onFocusOut={(event) => onBlur(contactForm, form, event)}
        onSubmit={(event) => onSubmit(contactForm, form, event)}
        onInvalidCapture={(event) => onInvalid(contactForm, form, event)}
      >
        <ErrorSummary of={form} class="summary" />
        <label for={fieldId(form, "email")} class="label">
          Email
        </label>
        <input
          id={fieldId(form, "email")}
          name="email"
          type="email"
          class="input"
          required
          value={defaultValue(form, "email")}
          aria-invalid={isInvalid(form, "email")}
          aria-describedby={describedBy(form, "email")}
        />
        <FieldError of={form} name="email" class="error" />
        <label for={fieldId(form, "message")} class="label">
          Message
        </label>
        <textarea
          id={fieldId(form, "message")}
          name="message"
          class="input"
          required
          aria-invalid={isInvalid(form, "message")}
          aria-describedby={describedBy(form, "message")}
        />
        <FieldError of={form} name="message" class="error" />
        <FormStatus of={form} pending="Sending…" class="hint" />
        <p id="contact-sent" hidden={lastResult(form) ? undefined : true}>
          {lastResult(form) ? "Thanks, we will reply to " + (lastResult(form) as { to: string }).to : ""}
        </p>
        <button id="contact-send" type="submit" class="button" disabled={submitting(form) ? true : undefined}>
          {submitting(form) ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
