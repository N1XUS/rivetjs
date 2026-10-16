export const head = { title: "Rivet forms" };

export default function Index() {
  return (
    <section>
      <h1>Rivet forms demo</h1>
      <p>
        Both pages work without JavaScript and resume on first interaction. <a href="/signup">Sign up form</a> ·{" "}
        <a href="/wizard">Three-step wizard</a>
      </p>
    </section>
  );
}
