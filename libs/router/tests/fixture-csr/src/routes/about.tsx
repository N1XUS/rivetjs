export const head = ({ url }: { url: URL }) => ({ title: "About " + url.pathname });

export default function About({ url }: { url: URL }) {
  return (
    <section>
      <h1 id="about">About {url.pathname}</h1>
      <a href="/">Home</a> <a href="/nowhere">Nowhere</a>
    </section>
  );
}
