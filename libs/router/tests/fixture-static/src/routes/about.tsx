import type { PageProps } from "@rivetjs/router";

export const head = { title: "About" };
export default function About({ data }: PageProps<{ built: string }>) {
  return <h1 id="about">About {data.built}</h1>;
}
