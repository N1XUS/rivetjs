import { redirect, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { autofocus, createForm, defaultChecked, defaultValue, describedBy, fieldId, formId, isInvalid, onBlur, onInput, onSubmit } from "@rivetjs/forms";
import { ErrorSummary, FieldError } from "@rivetjs/forms/components";
import { stepHref } from "@rivetjs/forms/wizard";
import { loadWizard, wizardAction } from "@rivetjs/forms/server";
import { accountStep, addressStep, confirmStep, onboarding } from "../forms/definitions.js";
import { memoryDrafts } from "../forms/drafts.server.js";

export const head = { title: "Wizard" };

export const loader = load((event: RequestEvent) => loadWizard(onboarding, memoryDrafts, event));
export const forms = actions(wizardAction(onboarding, memoryDrafts, { onComplete: () => redirect("/welcome") }));

/** Three steps, a schema each; `?step=` in the URL, outputs kept in a server-side draft. */
export default function WizardPage({ data }: PageProps<typeof loader>) {
  const result = actionResult();
  const values = data.values as { account?: { name?: string; email?: string }; address?: { city?: string; zip?: string } };
  const account = createForm(accountStep, { result, initial: values.account });
  const address = createForm(addressStep, { result, initial: values.address });
  const confirm = createForm(confirmStep, { result });
  const draft = data.draft ?? "";
  const back = data.step > 0 ? stepHref(onboarding, "/wizard", data.step - 1, data.draft ? { draft: data.draft } : {}) : undefined;
  const input = "input";
  return (
    <section aria-labelledby="wizard-title">
      <h1 id="wizard-title">
        Onboarding
      </h1>
      <p id="wizard-step">
        Step {data.step + 1} of 3
      </p>
      {data.step === 0 ? (
        <form id={formId(account)} method="post" action="?/account" class="stack" onInput={(e) => onInput(accountStep, account, e)} onFocusOut={(e) => onBlur(accountStep, account, e)} onSubmit={(e) => onSubmit(accountStep, account, e)}>
          <input type="hidden" name="_draft" value={draft} />
          <ErrorSummary of={account} class="summary" />
          <label for={fieldId(account, "name")} class="label">
            Name
          </label>
          <input id={fieldId(account, "name")} name="name" class={input} required value={defaultValue(account, "name")} autoFocus={autofocus(account, "name")} aria-invalid={isInvalid(account, "name")} aria-describedby={describedBy(account, "name")} />
          <FieldError of={account} name="name" class="error" />
          <label for={fieldId(account, "email")} class="label">
            Email
          </label>
          <input id={fieldId(account, "email")} name="email" type="email" class={input} required value={defaultValue(account, "email")} autoFocus={autofocus(account, "email")} aria-invalid={isInvalid(account, "email")} aria-describedby={describedBy(account, "email")} />
          <FieldError of={account} name="email" class="error" />
          <button type="submit" class="button">
            Continue
          </button>
        </form>
      ) : data.step === 1 ? (
        <form id={formId(address)} method="post" action="?/address" class="stack" onInput={(e) => onInput(addressStep, address, e)} onFocusOut={(e) => onBlur(addressStep, address, e)} onSubmit={(e) => onSubmit(addressStep, address, e)}>
          <input type="hidden" name="_draft" value={draft} />
          <ErrorSummary of={address} class="summary" />
          <label for={fieldId(address, "city")} class="label">
            City
          </label>
          <input id={fieldId(address, "city")} name="city" class={input} required value={defaultValue(address, "city")} autoFocus={autofocus(address, "city")} aria-invalid={isInvalid(address, "city")} aria-describedby={describedBy(address, "city")} />
          <FieldError of={address} name="city" class="error" />
          <label for={fieldId(address, "zip")} class="label">
            Postal code
          </label>
          <input id={fieldId(address, "zip")} name="zip" class={input} required value={defaultValue(address, "zip")} autoFocus={autofocus(address, "zip")} aria-invalid={isInvalid(address, "zip")} aria-describedby={describedBy(address, "zip")} />
          <FieldError of={address} name="zip" class="error" />
          <button type="submit" class="button">
            Continue
          </button>
        </form>
      ) : (
        <form id={formId(confirm)} method="post" action="?/confirm" class="stack" onInput={(e) => onInput(confirmStep, confirm, e)} onSubmit={(e) => onSubmit(confirmStep, confirm, e)}>
          <input type="hidden" name="_draft" value={draft} />
          <ErrorSummary of={confirm} class="summary" />
          <label class="label">
            <input id={fieldId(confirm, "agree")} name="agree" type="checkbox" checked={defaultChecked(confirm, "agree")} aria-invalid={isInvalid(confirm, "agree")} aria-describedby={describedBy(confirm, "agree")} /> I agree to the terms
          </label>
          <FieldError of={confirm} name="agree" class="error" />
          <button type="submit" class="button">
            Finish
          </button>
        </form>
      )}
      {back ? (
        <p>
          <a id="wizard-back" href={back}>
            Back
          </a>
        </p>
      ) : null}
    </section>
  );
}
