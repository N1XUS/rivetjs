import { notFound, type PageProps, type RequestEvent, load, entries } from "@rivetjs/router";
import { Markdown } from "../../components/Markdown.tsx";
import { getPost, listPosts } from "../../posts.server.ts";
import type { Post } from "../../posts.ts";

// #region demo
// Server code in the page file: the compiler removes it (and the posts.server.ts import) from the browser build.
export const loader = load(({ params }: RequestEvent<{ slug: string }>) => {
  const post = getPost(params.slug);
  if (!post) throw notFound(`No post called "${params.slug}"`);
  return post;
});

/** For a static build (`mode: "static"`): the slugs to render to HTML files. A server app ignores it. */
export const paths = entries(() => listPosts().map((post) => ({ slug: post.slug })));
// #endregion

export const head = ({ data }: { data: Post }) => ({ title: data.title });

export default function BlogPost({ data }: PageProps<typeof loader, { slug: string }>) {
  return (
    <main class="mx-auto max-w-2xl p-6">
      <p>
        <a class="text-sm text-teal-700 underline" href="/">
          All posts
        </a>
      </p>
      <article id="post">
        <h1 class="mt-2 text-3xl font-bold">{data.title}</h1>
        <span class="text-sm text-slate-500">
          {data.date}
        </span>
        <Markdown node={data.tree} />
      </article>
    </main>
  );
}
