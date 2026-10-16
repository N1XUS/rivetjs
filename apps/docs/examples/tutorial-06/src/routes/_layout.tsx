import type { LayoutProps } from "@rivetjs/router";

// Wraps every page in src/routes. `children` is the current page.
export default function Layout({ children }: LayoutProps) {
  return (
    <div class="mx-auto max-w-xl p-6">
      <nav id="nav" class="mb-4 flex gap-4 text-sm">
        <a class="text-teal-700 underline" href="/">
          Books
        </a>
        <a class="text-teal-700 underline" href="/about">
          About
        </a>
      </nav>
      <main>{children}</main>
      <footer class="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">A reading list built with Rivet.</footer>
    </div>
  );
}
