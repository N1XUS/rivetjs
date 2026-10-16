import { Link, navigate } from "@rivetjs/router/client";

export default function Home() {
  return (
    <section>
      <h1>Home</h1>
      <Link to="/about" id="about">
        About
      </Link>
      <Link to="/about?tab=x#team" id="about-query">
        About (query)
      </Link>
      <a href="/items/2" id="plain">
        Plain link
      </a>
      <button type="button" id="go" onClick={() => navigate("/items/3?q=1")}>
        Item 3
      </button>
    </section>
  );
}
