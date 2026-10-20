import { notFound, load } from "@rivetjs/router";
export const loader = load(() => {
  throw notFound("No such product");
});
