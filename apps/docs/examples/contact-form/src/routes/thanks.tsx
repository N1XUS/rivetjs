export const head = { title: "Thanks" };

export default function Thanks() {
  return (
    <main class="mx-auto max-w-md p-4">
      <h1 class="text-xl font-semibold">Thank you</h1>
      <p class="mt-2">We got your message.</p>
      <a class="text-teal-700 underline" href="/">
        Send another
      </a>
    </main>
  );
}
