import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Field } from "../components/Field.tsx";

export const head = { title: "resumedId" };

export default function Signup() {
  const more = signal(false);
  return (
    <form class="m-4 grid max-w-sm gap-3 text-sm" method="get">
      <Field label="Email" hint="We never share it." name="email" />
      <Field label="Nickname" hint="Shown on your posts." name="nickname" />
      {/* Created in the browser after resume: its id starts with "rvc", so it cannot collide. */}
      <Show
        when={more}
        fallback={() => (
          <button id="more" type="button" class="justify-self-start underline" onClick={() => more.set(true)}>
            Add a website field
          </button>
        )}
      >
        {() => <Field label="Website" hint="Optional." name="website" />}
      </Show>
    </form>
  );
}
