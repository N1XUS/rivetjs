import { Link } from "@rivetjs/router/link";

export const head = { title: "Page C" };
export default function PageC() {
  return (
    <>
      <h1>Page C</h1>
      <Link to="/" reload id="home">
        Home
      </Link>
    </>
  );
}
