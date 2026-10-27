import { load, type PageProps } from "@rivetjs/router";
import { ReadingPlan } from "../components/ReadingPlan.tsx";

// Static mode runs this loader at build time; only its data reaches the browser.
export const loader = load(() => ({
  topics: [
    { id: "routes", title: "Add a file route" },
    { id: "signals", title: "Update a signal" },
    { id: "stores", title: "Read and write a store" },
  ],
}));

export const head = { title: "About" };

/** The page at `/about`. */
export default function About({ data }: PageProps<"about">) {
  return (
    <>
      <h1 class="text-2xl font-bold">About</h1>
      <p class="mt-2 text-slate-600">Each file in src/routes is a page. This one is src/routes/about.tsx.</p>
      <ReadingPlan topics={data.topics} />
    </>
  );
}
