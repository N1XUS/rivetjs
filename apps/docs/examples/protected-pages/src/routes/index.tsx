export const head = { title: "Home" };

/** Public page: no guard runs here. */
export default function Home() {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Home</h1>
      <p class="mt-4">Anyone can see this page.</p>
      <p class="mt-4 flex gap-4">
        <a class="text-teal-700 underline" href="/dashboard">
          Dashboard
        </a>
        <a class="text-teal-700 underline" href="/settings">
          Settings
        </a>
      </p>
    </main>
  );
}
