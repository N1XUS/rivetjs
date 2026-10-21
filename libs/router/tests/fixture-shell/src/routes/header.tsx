import { load, type PageProps } from "@rivetjs/router";

// Forbidden: a shell loader reading a request header that is not keyed (`varies`).
export const loader = load(({ request }) => ({ agent: request.headers.get("x-agent") ?? "none" }));

export default function Header({ data }: PageProps<typeof loader>) {
  return <p id="agent">{data.agent}</p>;
}
