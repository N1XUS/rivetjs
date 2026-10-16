import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export const head = { title: "Inbox" };

// #region demo
export default function Inbox() {
  const unread = signal(0);
  let seen!: HTMLElement;

  // Runs in the browser after the page loads, and again whenever `unread` changes.
  // `document` is safe here: this code never runs on the server.
  clientEffect(() => {
    document.title = `${unread()} unread`;
    seen.textContent = "Tab title: " + document.title;
  });

  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <button
        id="more"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={() => unread.update((n) => n + 1)}
      >
        New message
      </button>
      <p id="seen" class="text-slate-600" ref={(el) => (seen = el)}>
        Tab title: (set in the browser)
      </p>
    </div>
  );
}
// #endregion
