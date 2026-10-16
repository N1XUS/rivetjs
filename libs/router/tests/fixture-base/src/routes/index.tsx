import { navigate } from "@rivetjs/router/client";

export default function Home() {
  return (
    <section>
      <h1>Home</h1>
      <button type="button" id="go-item" onClick={() => navigate("/items/2")}>
        Item 2
      </button>
    </section>
  );
}
