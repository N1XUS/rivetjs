import { load, type PageProps } from "@rivetjs/router";
import { rows } from "../lib/rows.server.ts";

// Server-only module used by the loader only: the server split removes it from the browser build.
export const loader = load(() => rows());
export default function Loaded({ data }: PageProps<typeof loader>) {
  return <h1>Loaded {data.length}</h1>;
}
