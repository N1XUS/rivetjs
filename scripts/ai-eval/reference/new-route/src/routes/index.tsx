import { Counter } from "../components/Counter.tsx";

export const head = { title: "Home" };

/** The page at `/`. Edit it and save: the dev server updates the page and keeps the count. */
export default function Home() {
  return (
    <>
      <h1 class="text-2xl font-bold">Hello from Rivet</h1>
      <p class="mt-2 text-slate-600">This page was rendered to HTML. The button works without re-running the page in the browser.</p>
      <Counter />
      <p class="mt-4">
        <a id="team-link" href="/team/" class="underline">
          Meet the team
        </a>
      </p>
    </>
  );
}
