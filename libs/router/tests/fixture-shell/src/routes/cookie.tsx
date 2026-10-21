import { load, type PageProps } from "@rivetjs/router";

// Forbidden: a shell loader reading a cookie.
export const loader = load(({ cookies }) => ({ theme: cookies.get("theme") ?? "light" }));

export default function Cookie({ data }: PageProps<typeof loader>) {
  return <p id="theme">{data.theme}</p>;
}
