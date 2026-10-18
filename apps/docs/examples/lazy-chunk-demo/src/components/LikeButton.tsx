import { signal } from "@rivetjs/reactivity";

// Its click code goes into the page's small file. The browser fetches it when you point at or press the button.
export function LikeButton() {
  const likes = signal(0);
  return (
    <button id="like" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={() => likes.update((n) => n + 1)}>
      Like ({likes()})
    </button>
  );
}
