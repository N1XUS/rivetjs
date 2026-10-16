// Presentational form components: bindings only, no handlers. Reads stay inside JSX expressions
// (component bodies run once): in a resumed page each element compiles to a region the browser
// re-creates on the first change, and the created component keeps updating through its bindings.
import { errorId, fieldId, fieldIssues, formId, formIssues, issueText, submitting, summaryId } from "./reads.ts";
import { formatIssue } from "./issues.ts";
import type { Form } from "./store.ts";
import type { FieldPath, Issue } from "./types.ts";

type Format = (issue: Issue) => string;

/** A field's first shown issue: `<p id={errorId}>`, hidden when none (pair with `describedBy`). */
export function FieldError<T>(props: { of: Form<T>; name: FieldPath<T>; format?: Format; class?: string }) {
  const { of, name, format } = props;
  return (
    <p id={errorId(of, name)} class={props.class} hidden={issueText(of, name, format) === undefined ? true : undefined}>
      {issueText(of, name, format) ?? ""}
    </p>
  );
}

const empty = (form: Form<any>) => fieldIssues(form).length === 0 && formIssues(form).length === 0;

/**
 * Every shown issue as links to its field (`role="alert"`, focusable), plus form-level issues.
 * Hidden while the form has none.
 */
export function ErrorSummary<T>(props: { of: Form<T>; title?: string; format?: Format; class?: string }) {
  const { of, format } = props;
  const title = props.title ?? "There is a problem";
  return (
    <div id={summaryId(of)} class={props.class} role="alert" tabIndex={-1} hidden={empty(of) ? true : undefined}>
      <p>{empty(of) ? "" : title}</p>
      <ul>
        {formIssues(of).map((issue) => (
          <li>{formatIssue(issue, format)}</li>
        ))}
        {fieldIssues(of).map(([path, list]) => (
          <li>
            <a href={"#" + fieldId(of, path as FieldPath<T>)}>{formatIssue(list[0]!, format)}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hidden `_form` input: routes the action result to this instance on multi-form pages. */
export function FormMeta<T>(props: { of: Form<T> }) {
  return <input type="hidden" name="_form" value={formId(props.of)} />;
}

/** Polite status line: `pending` while submitting, else the first form-level issue. */
export function FormStatus<T>(props: { of: Form<T>; pending?: string; format?: Format; class?: string }) {
  const { of, format } = props;
  const pending = props.pending ?? "";
  return (
    <p class={props.class} role="status" aria-live="polite">
      {submitting(of) ? pending : formIssues(of)[0] ? formatIssue(formIssues(of)[0]!, format) : ""}
    </p>
  );
}
