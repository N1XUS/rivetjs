---
title: "Step 2: components and props"
description: Move the book markup into a BookCard component and pass the title and author as props.
template: tutorial
status: experimental
related: [guides/components/components, start/project-structure]
---

## Goal

Show each book as a card with its title and author. Instead of writing the card markup three times, you write a `BookCard` component once and use it three times with different props.

## Create the component

Create `src/components/BookCard.tsx`:

```tsx title="src/components/BookCard.tsx"
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
```

- A component is a function whose name starts with a capital letter.
- It receives one object, the props. Here you take `title` and `author` out of it. That reads them once, which is right for values that never change. For a prop that changes later (one the parent computes from a signal), read it as `props.title` instead; see [props that change](../../guides/components/components.md#props-are-live).
- `{title}` puts a JavaScript value into the markup. Rivet escapes the text, so a title like `<b>` shows as text, not as HTML.

The component is a named export (`export function`). Pages in `src/routes` use a default export; other components can use either.

## Use it on the page

Update `src/routes/index.tsx`:

```tsx title="src/routes/index.tsx"
import { BookCard } from "../components/BookCard.tsx"; // [!code ++]

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
```

You pass props like HTML attributes: `title="Dune"`. To pass a value that is not a string, use braces, for example `pages={412}`.

Import paths include the file extension (`BookCard.tsx`). The starter's TypeScript settings require it.

## Where this code runs

Like the page, `BookCard` runs on the server only. Its output becomes part of the HTML. The card has nothing interactive yet, so the browser still needs no code for it.

`BookCard.tsx` needs no entry in `vite.config.ts`: components outside `src/routes` resume on their own when a route imports them.

## Check that it works

You see three cards, each with a title and an author.

::example{id=tutorial-02}

## Next step

Cards that only show text are not very useful. In the next step each card gets a button that remembers whether you read the book.

[Step 3: state](03-state.md)
