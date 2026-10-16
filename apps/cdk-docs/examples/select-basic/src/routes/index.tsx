import { signal } from "@rivetjs/reactivity";
import { Select, type Key } from "@rivetjs/cdk/select";

export const head = { title: "Select" };

const animals = [
  { key: "aardvark", label: "Aardvark" },
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "kangaroo", label: "Kangaroo" },
  { key: "panda", label: "Panda" },
  { key: "snake", label: "Snake" },
];

// #region demo
export default function Pet() {
  const animal = signal<Key | null>(null);
  return (
    <form class="m-4 grid max-w-xs gap-3 text-sm">
      <Select id="pet" label="Favorite animal" description="Pick one." name="animal" items={animals} value={animal} />
      <p id="pet-out" class="text-slate-600">
        Selected: {String(animal())}
      </p>
    </form>
  );
}
// #endregion
