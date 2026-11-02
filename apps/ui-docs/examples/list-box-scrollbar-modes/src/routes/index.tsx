// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/release-scrollbar-modes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ListBox } from "@rivetjs/ui/list-box";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "ListBox: Scrollbar Modes" };

// #region demo
type ScrollbarMode = {
  id: string;
  label: string;
  scrollbar: "thin" | "default" | "none";
};

const modes: ScrollbarMode[] = [
  { id: "thin", label: "Thin", scrollbar: "thin" },
  { id: "default", label: "Browser default", scrollbar: "default" },
  { id: "none", label: "Hidden", scrollbar: "none" },
];

const animals = [
  { id: "aardvark", name: "Aardvark" },
  { id: "alpaca", name: "Alpaca" },
  { id: "antelope", name: "Antelope" },
  { id: "bear", name: "Bear" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "fox", name: "Fox" },
  { id: "giraffe", name: "Giraffe" },
  { id: "kangaroo", name: "Kangaroo" },
  { id: "koala", name: "Koala" },
  { id: "lemur", name: "Lemur" },
  { id: "otter", name: "Otter" },
  { id: "panda", name: "Panda" },
  { id: "penguin", name: "Penguin" },
  { id: "rabbit", name: "Rabbit" },
  { id: "snake", name: "Snake" },
  { id: "turtle", name: "Turtle" },
  { id: "wombat", name: "Wombat" },
  { id: "zebra", name: "Zebra" },
];

function ScrollbarListBox(props: { mode: ScrollbarMode }) {
  const mode = props.mode;
  return (
    <div class="flex w-[260px] flex-col gap-2">
      <h3 class="px-1 text-sm font-semibold text-muted">{mode.label}</h3>
      <Surface class="overflow-hidden rounded-3xl shadow-surface" data-scrollbar={mode.scrollbar}>
        <div class="h-52 scrollbar overflow-y-auto p-1">
          <ListBox aria-label={`${mode.label} animals`} selectionMode="single">
            {animals.map((animal) => (
              <ListBox.Item class="text-sm leading-5 font-medium" id={`${mode.id}-${animal.id}`} textValue={animal.name}>
                {animal.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </div>
      </Surface>
    </div>
  );
}

export function ScrollbarModes() {
  return (
    <div class="flex w-full flex-wrap justify-center gap-4">
      {modes.map((mode) => (
        <ScrollbarListBox mode={mode} />
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ScrollbarModes />
    </div>
  );
}
