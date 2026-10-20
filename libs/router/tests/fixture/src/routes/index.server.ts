import { load } from "@rivetjs/router";
export const loader = load(() => ({ items: [{ id: "1", title: "First item" }, { id: "2", title: "Second item" }] }));
