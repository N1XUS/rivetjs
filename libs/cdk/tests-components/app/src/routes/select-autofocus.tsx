import { Select } from "@rivetjs/cdk/select";

export const head = { title: "Select autoFocus" };

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
];

export default function SelectAutoFocusStory() {
  return (
    <section>
      <h1>Select autoFocus</h1>
      <Select id="auto" label="Favorite Animal" items={animals} autoFocus />
    </section>
  );
}
