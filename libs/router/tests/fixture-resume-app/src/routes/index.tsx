import { Counter } from "../components/counter.tsx";

// `src/components/counter.tsx` is not listed in `resume.modules`: the router resumes every app component module a route imports.
export default function Home() {
  return (
    <main>
      <h1 id="home">Home</h1>
      <Counter />
    </main>
  );
}
