import type { LayoutProps } from "@rivetjs/router";

/** Wraps every page. */
export default function Layout({ children }: LayoutProps) {
  return (
    <div class="mx-auto max-w-2xl p-6">
      <nav class="mb-6 flex gap-4 text-sm">
        <a class="text-teal-700 underline" href="/">
          Home
        </a>
        <a class="text-teal-700 underline" href="/about">
          About
        </a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
