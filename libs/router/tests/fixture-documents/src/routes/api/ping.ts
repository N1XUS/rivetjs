// Endpoint-only route: no page, so links to it load documents.
export const onGet = () => new Response("pong", { headers: { "content-type": "text/plain" } });
