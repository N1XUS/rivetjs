// Port of the Angular CDK docs example "sorting" (angular/angular adev/src/content/examples/drag-drop/src/sorting), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Sortable list" };

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

export default function DragDropSorting() {
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
          </Drag>
        )}
      </For>
    </DropList>
  );
}
// #endregion
