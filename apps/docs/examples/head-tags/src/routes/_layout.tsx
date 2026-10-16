import { withBase, type LayoutProps } from "@rivetjs/router";

// Defaults for every page; `%s` is replaced by the page's title.
export const head = {
  titleTemplate: "%s · Acme",
  meta: [
    { name: "description", content: "Acme makes tools for small teams." },
    { property: "og:site_name", content: "Acme" },
  ],
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div class="mx-auto max-w-2xl p-6">
      <nav class="mb-6 flex gap-4 text-sm">
        <a id="home" class="text-teal-700 underline" href={withBase("/")}>
          Home
        </a>
        <a id="post-hello" class="text-teal-700 underline" href={withBase("/posts/hello")}>
          Hello
        </a>
        <a id="post-pricing" class="text-teal-700 underline" href={withBase("/posts/pricing")}>
          Pricing
        </a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
