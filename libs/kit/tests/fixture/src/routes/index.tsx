import { css } from "@rivetjs/runtime/css";
import { JsonLd, Meta, Script, Title } from "@rivetjs/kit";

const styles = css`
  .card {
    color: rgb(1, 2, 3);
  }
`;

export default function Home() {
  return (
    <section>
      <Title>Home</Title>
      <Meta name="description" content="Home page" />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: "Kit </script>" }} />
      <Script src="/late.js" strategy="load" />
      <h1 id="home" class={styles.card}>
        Home
      </h1>
    </section>
  );
}
