import { Link } from "@rivetjs/router/link";

export const head = { title: "Page A" };
export default function PageA() {
  return (
    <>
      <h1>Page A</h1>
      <Link to="/" reload id="home">
        Home
      </Link>
      <Link to="/c" reload prefetch="document" id="explicit">
        Page C
      </Link>
    </>
  );
}
