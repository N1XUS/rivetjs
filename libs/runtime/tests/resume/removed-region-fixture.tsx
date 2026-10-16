// Removed region fixture (`../resume-removed-region-browser.test.ts`): server content bound to a shared signal sits in a
// region the browser removes (ternary child, `<Show keyed>`, a component's conditional); the replacement binds the same
// signal. The next write must not resume the removed content's server bindings ("Missing resumable element").
import { signal, type Signal } from "@rivetjs/reactivity";
import { createContext } from "@rivetjs/reactivity";
import { Provider, Show } from "@rivetjs/runtime/dom";

function Field(props: { value: Signal<string>; label: string }) {
  return (
    <div class="field">
      <label for={props.label}>
        {props.label} {props.value()}
      </label>
      <input id={props.label} value={props.value()} onInput={(event) => props.value.set((event.target as HTMLInputElement).value)} />
    </div>
  );
}

const Ctx = createContext("ctx", { id: "removed-ctx" });

/** Its children (an alias: no child site of their own) render in the traversal, inside a Provider's content, after the
 * read of the site they were written in — as a cdk TextField's do (its render-prop children forward `children`). */
function Wrap(props: { children?: unknown }) {
  const content = props.children;
  return (
    <Provider token={Ctx} value="wrapped">
      <div class="wrap">{content}</div>
    </Provider>
  );
}

/** Ternary child whose content is a component's lazy children (rendered by the traversal after the site's read). */
export function Children() {
  const step = signal("form");
  const email = signal("a");
  return (
    <section class="box">
      <button class="go" onClick={() => step.set(step() === "form" ? "code" : "form")}>
        go
      </button>
      <button class="type" onClick={() => email.set(email() + "b")}>
        type
      </button>
      {step() === "form" ? (
        <Wrap>
          <label for="email">email {email()}</label>
          <input id="email" value={email()} />
        </Wrap>
      ) : (
        <p class="code">{email()}</p>
      )}
    </section>
  );
}

/** Ternary child: the form step is replaced by a code step that shows the same email. */
export function Ternary() {
  const step = signal("form");
  const email = signal("a");
  return (
    <section class="box">
      <button class="go" onClick={() => step.set(step() === "form" ? "code" : "form")}>
        go
      </button>
      <button class="type" onClick={() => email.set(email() + "b")}>
        type
      </button>
      {step() === "form" ? <Field value={email} label="email" /> : <p class="code">{email()}</p>}
    </section>
  );
}

/** Keyed Show: the step's content (lazy children rendered in the traversal) re-creates on every change of the key. */
export function Keyed() {
  const step = signal("form");
  const email = signal("a");
  return (
    <section class="box">
      <button class="go" onClick={() => step.set(step() === "form" ? "code" : "form")}>
        go
      </button>
      <button class="type" onClick={() => email.set(email() + "b")}>
        type
      </button>
      <Show when={step} keyed>
        {(s: () => string) =>
          s() === "form" ? (
            <Wrap>
              <label for="email">email {email()}</label>
              <input id="email" value={email()} />
            </Wrap>
          ) : (
            <p class="code">{email()}</p>
          )
        }
      </Show>
    </section>
  );
}

/** Plain Show + fallback (the JSX-ternary-as-`_show` lowering): lazy children in the branch content. */
export function Plain() {
  const step = signal("form");
  const email = signal("a");
  return (
    <section class="box">
      <button class="go" onClick={() => step.set(step() === "form" ? "code" : "form")}>
        go
      </button>
      <button class="type" onClick={() => email.set(email() + "b")}>
        type
      </button>
      <Show when={() => step() === "form"} fallback={<p class="code">{email()}</p>}>
        {() => (
          <Wrap>
            <label for="email">email {email()}</label>
            <input id="email" value={email()} />
          </Wrap>
        )}
      </Show>
    </section>
  );
}
