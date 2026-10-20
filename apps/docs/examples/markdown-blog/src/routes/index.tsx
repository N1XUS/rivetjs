import type { PageProps } from "@rivetjs/router";
import { listPosts } from "../posts.server.ts";
import { load } from "@rivetjs/router";

export const head = { title: "Blog" };

// Titles and dates only: the list page does not need the post bodies.
export const loader = load(() => ({ posts: listPosts() }));

export default function Blog({ data }: PageProps<typeof loader>) {
  return (
    <main class="mx-auto max-w-2xl p-6">
      <h1 class="text-2xl font-bold">Blog</h1>
      <ul id="posts" class="mt-4 grid gap-3">
        {data.posts.map((post) => (
          <li>
            <a class="font-semibold text-teal-700 underline" href={"/blog/" + post.slug}>
              {post.title}
            </a>{" "}
            <span class="text-sm text-slate-500">
              {post.date}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
