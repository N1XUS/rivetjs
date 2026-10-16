```tsx compiled open title="ResumeDemo.tsx, the button"
import { signal } from "@rivetjs/reactivity";

export function ResumeDemo() {
  const likes = signal(0);
  return (
    <button type="button" onClick={() => likes.update((n) => n + 1)}>
      {likes()} {likes() === 1 ? "like" : "likes"}
    </button>
  );
}
```
