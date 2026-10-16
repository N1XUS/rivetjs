// Port of the Angular CDK docs example "custom-preview" (angular/angular adev/src/content/examples/drag-drop/src/custom-preview), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Film } from "lucide";
import { Drag, DragPreview, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Custom preview" };

// #region demo
const MOVIES = [
  "Episode I - The Phantom Menace",
  "Episode II - Attack of the Clones",
  "Episode III - Revenge of the Sith",
  "Episode IV - A New Hope",
  "Episode V - The Empire Strikes Back",
  "Episode VI - Return of the Jedi",
  "Episode VII - The Force Awakens",
  "Episode VIII - The Last Jedi",
  "Episode IX - The Rise of Skywalker",
];

export default function DragDropCustomPreview() {
  const movies = signal(MOVIES);
  return (
    <DropList
      id="movies"
      class="example-list"
      onDropped={(event) => {
        const next = movies().slice();
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        movies.set(next);
      }}
    >
      <For each={movies} by={(movie) => movie}>
        {(movie) => (
          <Drag id={"movie-" + MOVIES.indexOf(movie())} class="example-box">
            {movie()}
            <DragPreview>
              <div class="example-poster">
                <Icon icon={Film} size={32} />
                {movie()}
              </div>
            </DragPreview>
          </Drag>
        )}
      </For>
    </DropList>
  );
}
// #endregion
