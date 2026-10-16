// The props a BookCard accepts.
interface BookCardProps {
  title: string;
  author: string;
}

// A component is a function that returns JSX. Props arrive as one object.
export function BookCard({ title, author }: BookCardProps) {
  return (
    <li class="rounded-lg border border-slate-200 p-3">
      <p class="font-semibold">{title}</p>
      <p class="text-sm text-slate-600">{author}</p>
    </li>
  );
}
