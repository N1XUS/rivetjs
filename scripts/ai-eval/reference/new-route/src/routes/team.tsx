export const head = { title: "Team" };

const people = ["Ada", "Grace", "Linus"];

export default function Team() {
  return (
    <>
      <h1 class="text-2xl font-bold">Team</h1>
      <ul id="people" class="mt-2 list-disc pl-6">
        {people.map((name) => (
          <li>{name}</li>
        ))}
      </ul>
      <a id="home-link" href="/" class="mt-4 inline-block underline">
        Home
      </a>
    </>
  );
}
