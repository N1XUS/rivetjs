import { count } from "../counts.server.ts";
// No depends(): invalidate(key) never reruns it.
export const load = () => ({ n: count("plain") });
