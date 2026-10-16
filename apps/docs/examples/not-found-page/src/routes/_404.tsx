// #region demo
// Shown for URLs that match no route, and when a loader throws notFound().
export default function NotFound({ url }: { url: URL }) {
  return (
    <section role="status" class="p-4">
      <h1 class="text-xl font-semibold">Page not found</h1>
      <p class="mt-2 text-slate-600">Nothing lives at {url.pathname}.</p>
      <a class="mt-2 inline-block text-teal-700 underline" href="/">
        Back home
      </a>
    </section>
  );
}
// #endregion
