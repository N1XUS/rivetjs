import { notFound, type PageProps, type RequestEvent, load, entries } from "@rivetjs/router";

type Post = { slug: string; title: string; summary: string };

const posts: Post[] = [
  { slug: "hello", title: "Hello", summary: "The first post." },
  { slug: "pricing", title: "Pricing", summary: "Plans for teams of every size." },
];

// Server only: removed from the browser build.
export const loader = load(({ params }: RequestEvent<{ slug: string }>): Post => {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) throw notFound();
  return post;
});
// Static build: the pages to render.
export const paths = entries(() => posts.map((post) => ({ slug: post.slug })));

// #region demo
// Browser code too: runs on every navigation, with this file's loader data.
export const head = ({ data }: { data: Post }) => ({
  title: data.title,
  meta: [
    { name: "description", content: data.summary },
    { property: "og:title", content: data.title },
  ],
  links: [{ rel: "canonical", href: "https://example.com/posts/" + data.slug }],
});
// #endregion

export default function PostPage({ data }: PageProps<typeof loader, { slug: string }>) {
  return (
    <article>
      <h1 id="heading" class="text-xl font-semibold">
        {data.title}
      </h1>
      <p class="mt-2 text-sm text-slate-600">{data.summary}</p>
    </article>
  );
}
