export const head = { title: "Welcome" };

export default function Welcome() {
  return (
    <section aria-labelledby="welcome-title">
      <h1 id="welcome-title">
        Welcome aboard
      </h1>
      <p>The form was valid on the server too.</p>
      <p>
        <a href="/wizard">
          Try the wizard
        </a>
      </p>
    </section>
  );
}
