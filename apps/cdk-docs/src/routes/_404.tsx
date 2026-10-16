import { site } from "virtual:docs/site";

export const head = { title: "Page not found · " + site.name };

/** Unknown URLs (static hosts serve it as 404.html). */
export default function NotFound({ url }: { url: URL }) {
  return (
    <section class="mx-auto max-w-2xl py-24 text-center" role="status">
      <p class="text-sm font-semibold text-(--accent)">404</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p class="mt-4 text-slate-600 dark:text-slate-300">Nothing lives at {url.pathname}. The page may have moved.</p>
      <p class="mt-8 flex justify-center gap-4">
        <a href="/" data-rivet-reload="">
          Home
        </a>
        <a href="/search/" data-rivet-reload="">
          Search the docs
        </a>
      </p>
    </section>
  );
}
