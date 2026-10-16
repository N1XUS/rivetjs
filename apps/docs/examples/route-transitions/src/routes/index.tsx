import { photos } from "../photos.ts";

export const head = { title: "Photos" };

// #region demo
export default function Gallery() {
  return (
    <>
      <h1 class="text-xl font-semibold">Gallery</h1>
      <ul class="mt-4 grid grid-cols-3 gap-3">
        {photos.map((photo) => (
          <li>
            {/* link-pending: classes while this link's page loads. */}
            <a href={"/photos/" + photo.id} class="block link-pending:opacity-60">
              {/* Same data-vt-name on both pages: the thumbnail grows into the big photo. */}
              <span class={"block h-20 rounded " + photo.color} data-vt-name={"photo-" + photo.id} data-vt-class="photo" />
              <span class="mt-1 block text-sm">{photo.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
// #endregion
