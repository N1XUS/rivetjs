import { signal } from "@rivetjs/reactivity";

interface BookCardProps {
  title: string;
  author: string;
}

// #region demo
export function BookCard({ title, author }: BookCardProps) {
  // Each card has its own piece of state: has the book been read?
  const read = signal(false);
  return (
    <li class="flex items-center justify-between rounded-lg border border-slate-200 p-3">
      <div>
        <p class="font-semibold">{title}</p>
        <p class="text-sm text-slate-600">{author}</p>
      </div>
      <button
        type="button"
        class="rounded-md border border-teal-700 px-3 py-1 text-sm text-teal-700"
        onClick={() => read.update((value) => !value)}
      >
        {read() ? "Read" : "Not read yet"}
      </button>
    </li>
  );
}
// #endregion
