import { notFound } from "@rivetjs/router";
export const load = () => {
  throw notFound("No such product");
};
