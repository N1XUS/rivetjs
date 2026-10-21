import { load, type PageProps } from "@rivetjs/router";

// Forbidden: a shell loader reading what the guard put on `locals` (the session).
export const loader = load(({ locals }) => ({ user: String(locals.user ?? "anonymous") }));

export default function Locals({ data }: PageProps<typeof loader>) {
  return <p id="who">{data.user}</p>;
}
