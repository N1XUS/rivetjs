import { load, type PageProps } from "@rivetjs/router";

export const loader = load(() => ({ text: "Other page" }));

export default function Other({ data }: PageProps<typeof loader>) {
  return <h1 id="other">{data.text}</h1>;
}
