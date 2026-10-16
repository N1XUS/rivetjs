export const head = { title: "Home" };

export default function Home() {
  return (
    <section>
      <h1 class="text-xl font-semibold">Home</h1>
      <p class="mt-2 text-sm text-slate-600">Follow the Products link: the router swaps the page without loading a new document.</p>
    </section>
  );
}
