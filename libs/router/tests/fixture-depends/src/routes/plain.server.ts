import { count } from "../counts.server.ts";
import { load } from "@rivetjs/router";
// No depends(): invalidate(key) never reruns it.
export const loader = load(() => ({ n: count("plain") }));
