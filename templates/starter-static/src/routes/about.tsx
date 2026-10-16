export const head = { title: "About" };

/** The page at `/about`. */
export default function About() {
  return (
    <>
      <h1 class="text-2xl font-bold">About</h1>
      <p class="mt-2 text-slate-600">Each file in src/routes is a page. This one is src/routes/about.tsx.</p>
    </>
  );
}
