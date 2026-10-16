import { BookCard } from "../components/BookCard.tsx";

export const head = { title: "Reading list" };

export default function Home() {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">My reading list</h1>
      <ul id="books" class="mt-4 grid gap-2">
        <BookCard title="The Hobbit" author="J. R. R. Tolkien" />
        <BookCard title="Dune" author="Frank Herbert" />
        <BookCard title="Kindred" author="Octavia E. Butler" />
      </ul>
    </main>
  );
}
