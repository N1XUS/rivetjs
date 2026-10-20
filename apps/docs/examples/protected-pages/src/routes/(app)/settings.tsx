export const head = { title: "Settings" };

/** Protected by the same `guard(…)` export in `(app)/_layout.tsx`; this page needs no server code of its own. */
export default function Settings() {
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Settings</h1>
      <p class="mt-4">Only signed-in users see this page.</p>
      <p class="mt-4">
        <a class="text-teal-700 underline" href="/dashboard">
          Back to the dashboard
        </a>
      </p>
    </main>
  );
}
