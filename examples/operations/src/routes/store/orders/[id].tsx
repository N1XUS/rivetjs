import { guard, load, deny, notFound, headers, type RequestEvent, type PageProps } from "@rivetjs/router";
import { sessionUser, orderFor } from "../../../server/service.server.ts";
import { userOf } from "../../../server/http.server.ts";
import { SiteNav } from "../../../sites/SiteNav.tsx";
import { money } from "../../../sites/client.ts";
export const access = guard((e: RequestEvent) => {
  if (!sessionUser(e.cookies.get("case-session"))) throw deny(401);
});
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store" }));
export const loader = load((e: RequestEvent) => {
  const order = orderFor(userOf(e), e.params.id);
  if (!order) throw notFound();
  return { order };
});
export default function Order({ data }: PageProps<typeof loader>) {
  return (
    <>
      <SiteNav />
      <main class="confirmation">
        <p class="eyebrow">ORDER CONFIRMED</p>
        <h1>Good things are on their way.</h1>
        <p id="order-id">{data.order.id}</p>
        <h2 id="order-total">{money(data.order.total)}</h2>
        <p>Your demo order has been saved. Reloading this page does not create another order.</p>
        <a href="/store">Continue browsing</a>
      </main>
    </>
  );
}
