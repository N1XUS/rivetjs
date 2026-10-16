import { signal } from "@rivetjs/reactivity";

export const head = { title: "Two-way input" };

// #region demo
export default function Greeting() {
  const name = signal("");
  const loud = signal(false);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <label class="grid gap-1">
        Your name
        {/* Typing writes to `name`; setting `name` updates the field. */}
        <input id="name" class="rounded border border-slate-300 px-2 py-1" model:value={name} placeholder="friend" />
      </label>
      <label class="flex items-center gap-2">
        <input id="loud" type="checkbox" model:checked={loud} />
        Shout
      </label>
      <p id="greeting" class="text-lg font-semibold">
        {loud() ? `HELLO, ${(name() || "friend").toUpperCase()}!` : `Hello, ${name() || "friend"}.`}
      </p>
      <button
        id="reset"
        type="button"
        class="justify-self-start rounded border border-slate-300 px-3 py-1"
        onClick={() => {
          name.set("");
          loud.set(false);
        }}
      >
        Reset
      </button>
    </div>
  );
}
// #endregion
