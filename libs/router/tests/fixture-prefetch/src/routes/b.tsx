import { Link } from "@rivetjs/router/link";

export const head = { title: "Page B" };
export default function PageB() {
  return (
    <>
      <h1>Page B</h1>
      <Link to="/" reload id="home">
        Home
      </Link>
    </>
  );
}
