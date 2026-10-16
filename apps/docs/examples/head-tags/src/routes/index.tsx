export const head = { title: "Home" };

export default function Home() {
  return (
    <section>
      <h1 class="text-xl font-semibold">Home</h1>
      <p class="mt-2 text-sm text-slate-600">
        The tab title comes from this page's <code>head</code> export and the layout's <code>titleTemplate</code>.
      </p>
    </section>
  );
}
