import { useSearchParams } from "@rivetjs/router/client";

// Rule `query: ["page"]`. Forbidden: a component reading the request's search params context outside the key.
export default function Context() {
  const params = useSearchParams();
  return <p id="sort">{params().get("sort") ?? "new"}</p>;
}
