export const head = { title: "Help" };

export default function Help() {
  return (
    <section class="m-4 grid gap-3 text-sm">
      <h1 id="help-title" class="font-semibold">
        Help page
      </h1>
      <a id="back" href="./" class="text-teal-700 underline">
        Back to the menu
      </a>
    </section>
  );
}
