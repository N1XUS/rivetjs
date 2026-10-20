import { load } from "@rivetjs/router";
export const loader = load(() => {
  throw new Error("database exploded");
});
