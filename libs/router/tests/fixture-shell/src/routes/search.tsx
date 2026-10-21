import { load, type PageProps } from "@rivetjs/router";

// Rule `query: ["page"]`. Forbidden: a shell loader reading a parameter outside the key (`sort`).
export const loader = load(({ url }) => ({ page: url.searchParams.get("page") ?? "1", sort: url.searchParams.get("sort") ?? "new" }));

export default function Search({ data }: PageProps<typeof loader>) {
  return (
    <p id="page">
      {data.page} {data.sort}
    </p>
  );
}
