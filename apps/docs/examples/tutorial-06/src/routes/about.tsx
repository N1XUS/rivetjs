export const head = { title: "About" };

// The page at `/about`. The layout wraps it like every other page.
export default function About() {
  return (
    <>
      <h1 class="text-2xl font-bold">About</h1>
      <p class="mt-2 text-slate-600">I keep this list to remember what to read next.</p>
    </>
  );
}
