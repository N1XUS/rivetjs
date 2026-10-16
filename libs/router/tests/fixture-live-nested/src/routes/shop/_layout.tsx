import type { LayoutProps } from "@rivetjs/router";

// Nested layout level around the live page: stays mounted, its loader reads no URL (kept across searches).
export default function ShopLayout({ data, url, children }: LayoutProps<{ loads: number }>) {
  return (
    <section id="shop">
      <p id="shop-loads">{data().loads}</p>
      <p id="shop-url">{url().pathname + url().search}</p>
      <div id="shop-page">{children}</div>
    </section>
  );
}
