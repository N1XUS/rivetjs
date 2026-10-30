import { load, type PageProps } from "@rivetjs/router";
import { Title, Meta, JsonLd } from "@rivetjs/kit";
export const loader = load(({ url }) => ({ payload: url.searchParams.get("q") ?? "safe" }));
export default function Head({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <Title>{data.payload}</Title>
      <Meta name="description" content={data.payload} />
      <JsonLd data={{ name: data.payload }} />
      <p id="text">{data.payload}</p>
    </main>
  );
}
