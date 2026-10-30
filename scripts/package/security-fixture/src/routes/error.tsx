import { load } from "@rivetjs/router";
export const loader = load(() => {
  throw new Error("LOADER_ERROR_CANARY_04ab7c91");
});
export default function ErrorPage() {
  return <p>unreachable</p>;
}
