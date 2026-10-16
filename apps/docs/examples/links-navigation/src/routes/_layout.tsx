import { withBase, type LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div class="mx-auto max-w-2xl p-6">
      {/* Plain links; the router handles them. The examples are served under a base path: withBase() adds it. */}
      <nav class="mb-6 flex gap-4 text-sm">
        <a id="to-home" class="text-teal-700 underline" href={withBase("/")}>
          Home
        </a>
        <a id="to-products" class="text-teal-700 underline" href={withBase("/products")}>
          Products
        </a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
