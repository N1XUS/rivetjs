import { count } from "../../counts.server.ts";
import { load } from "@rivetjs/router";
export const loader = load(() => ({ n: count("a") }));
