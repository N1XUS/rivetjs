import { secretText } from "../lib/secret.ts";

// Reaches the declared server-only `virtual:fixture-secret` through a helper: a document route.
export default function Secret() {
  return <h1>{secretText()}</h1>;
}
