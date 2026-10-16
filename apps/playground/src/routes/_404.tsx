/** Unknown URLs and missing examples. */
export default function NotFound({ url }: { url: URL }) {
  return (
    <section role="status">
      <h1 class="text-2xl font-semibold">Page not found</h1>
      <p class="mt-4 text-slate-600">Nothing lives at {url.pathname}.</p>
      <a class="mt-4 inline-block text-teal-700 underline underline-offset-4" href="/">
        Back to examples
      </a>
    </section>
  );
}
