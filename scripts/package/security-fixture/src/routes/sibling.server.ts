import { load } from "@rivetjs/router";
export const loader = load(() => {
  const secret = "SIBLING_LOADER_CANARY_47c93ea0";
  return { value: secret.length > 0 ? "SIBLING_PUBLIC_CONTROL" : "bad" };
});
