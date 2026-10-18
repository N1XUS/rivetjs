// templates/starter-minimal/src/routes/index.tsx — the whole app.
// Server-rendered, resumable. The component body runs once, on the server. Never in the browser.
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Minimal Rivet app" };

export default function Home() {
  const count = signal(0);
  return (
    <main>
      <h1>Hello</h1>
      <button type="button" onClick={() => count.update((n) => n + 1)}>
        Clicked {count()} times
      </button>
    </main>
  );
}

// vite.config.ts
// import { rivetRouter } from "@rivetjs/router/vite";
// export default defineConfig({ plugins: [rivetRouter({ mode: "static" })] });
