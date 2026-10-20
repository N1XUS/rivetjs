import { count } from "../counts.server.ts";
import { load } from "@rivetjs/router";
export const loader = load(() => ({ loads: count("root") }));
