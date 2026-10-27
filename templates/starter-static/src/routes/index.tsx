import { Counter } from "../components/Counter.tsx";

export const head = { title: "Home" };

/** The page at `/`. Edit it and save: the dev server reloads the resumed page. */
export default function Home() {
  return (
    <>
      <h1 class="text-2xl font-bold">Hello from Rivet</h1>
      <p class="mt-2 text-slate-600">This page was rendered to HTML. The counter resumes over its existing HTML when you use it.</p>
      <Counter />
    </>
  );
}
