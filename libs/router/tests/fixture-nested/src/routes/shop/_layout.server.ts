import { count } from "../../counts.server.ts";
export const load = () => ({ loads: count("shop") });
