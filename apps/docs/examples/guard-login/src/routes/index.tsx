export const head = { title: "Home" };

export default function Home() {
  return (
    <main class="p-4">
      <h1 class="text-xl font-semibold">Home</h1>
      <p class="mt-2">
        Anyone can see this page. The{" "}
        <a class="text-teal-700 underline" href="/account">
          account page
        </a>{" "}
        needs a sign-in.
      </p>
    </main>
  );
}
