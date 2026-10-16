// Endpoint the server matches before `items/[id]` (static before param): a document load, not a page.
export const onGet = () => new Response("export", { headers: { "content-type": "text/plain" } });
