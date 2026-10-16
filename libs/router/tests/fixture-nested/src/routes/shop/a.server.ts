import { count } from "../../counts.server.ts";
export const load = () => ({ n: count("a") });
