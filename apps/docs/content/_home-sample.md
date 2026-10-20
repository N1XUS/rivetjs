```tsx compiled title="src/routes/index.tsx"
import { signal } from "@rivetjs/reactivity";
import type { PageProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const loader = load(() => ({ stars: 128 }));

export default function Home({ data }: PageProps<"index">) {
  const stars = signal(data.stars);
  const label = () => (stars() === 1 ? "star" : "stars");
  return <button onClick={() => stars.update((n) => n + 1)}>{stars()} {label()}</button>;
}
```
