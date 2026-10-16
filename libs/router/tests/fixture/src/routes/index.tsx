import type { PageProps } from "@rivetjs/router";

export const head = { title: "Home" };
export default function Home({ data }: PageProps<{ items: { id: string; title: string }[] }, {}>) {
  return (
    <section>
      <h1>Home</h1>
      <ul id="items">
        {data.items.map((item) => (
          <li>
            <a href={"/items/" + item.id}>{item.title}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
