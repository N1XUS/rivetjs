// The title of the browser tab.
export const head = { title: "Reading list" };

// The page at `/`. It runs once, on the server (here: at build time).
export default function Home() {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">My reading list</h1>
      <p class="mt-1 text-slate-600">Books I want to read this year.</p>
      <ul id="books" class="mt-4 list-disc pl-6">
        <li>The Hobbit</li>
        <li>Dune</li>
        <li>Kindred</li>
      </ul>
    </main>
  );
}
