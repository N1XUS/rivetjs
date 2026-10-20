import { signal } from "@rivetjs/reactivity";
import { error, redirect, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";

export const head = { title: "Optimistic like" };

// Stand-in for a database row. Shared by everyone who opens the demo.
// Only the server exports use it, so it stays out of the browser build.
const post = { likes: 41, liked: false };
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

// #region demo
export const loader = load(() => ({ likes: post.likes, liked: post.liked }));

export const forms = actions({
  /** `liked` is the state the user wants, not "toggle": sending it twice gives the same result. */
  like: async ({ request }: RequestEvent) => {
    const form = await request.formData();
    await wait(600); // A slow database, so you can see the screen update before the server answers.
    if (form.get("fail")) throw error(503, "Could not save the like");
    const liked = form.get("liked") === "true";
    if (liked !== post.liked) {
      post.liked = liked;
      post.likes += liked ? 1 : -1;
    }
    // fetch() from the page asks for JSON; a plain form post (no JavaScript) gets a redirect.
    if (request.headers.get("accept")?.includes("application/json")) return { likes: post.likes, liked };
    return redirect("/", 303);
  },
});

export default function Post({ data }: PageProps<typeof loader>) {
  const liked = signal(data.liked);
  const likes = signal(data.likes);
  const pending = signal(false);
  const message = signal("");
  const fail = signal(false); // Demo only: ask the server to fail.

  // Without JavaScript the form posts normally. With it, we take over.
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (pending()) return;
    const before = { liked: liked(), likes: likes() };
    const next = !before.liked;
    // 1. Show the result at once.
    liked.set(next);
    likes.set(before.likes + (next ? 1 : -1));
    message.set("");
    pending.set(true);
    try {
      // 2. Tell the server, in the background.
      const body = new URLSearchParams({ liked: String(next), fail: fail() ? "1" : "" });
      const response = await fetch("?/like", { method: "POST", headers: { accept: "application/json" }, body });
      if (!response.ok) throw new Error("HTTP " + response.status);
    } catch {
      // 3. The server said no (or the network failed): undo and explain.
      liked.set(before.liked);
      likes.set(before.likes);
      message.set("Your like was not saved. Please try again.");
    } finally {
      pending.set(false);
    }
  }

  return (
    <form method="post" action="?/like" class="p-6" onSubmit={save}>
      {/* Used by the no-JavaScript post: the state the button switches to. */}
      <input type="hidden" name="liked" value={liked() ? "false" : "true"} />
      <button id="like" class="rounded-md border border-slate-300 px-4 py-2 font-semibold" aria-pressed={liked() ? "true" : "false"}>
        {liked() ? "Liked" : "Like"} · <span id="likes">{likes()}</span>
      </button>
      <label class="ml-4 text-sm">
        <input id="fail" type="checkbox" name="fail" value="1" model:checked={fail} /> Make the server fail
      </label>
      <p id="message" role="alert" class="mt-3 text-sm text-red-700">
        {message()}
      </p>
    </form>
  );
}
// #endregion
