import { load, actions } from "@rivetjs/router";
let count = 0;
export const loader = load(() => ({ count }));
export const forms = actions({ inc: () => ({ count: ++count }) });
