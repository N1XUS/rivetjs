import { notFound, type DataOf, type PageProps, type RequestEvent } from "@rivetjs/router";
import { photos } from "../../photos.ts";

export const serverLoad = async ({ params }: RequestEvent<{ id: string }>) => {
  const photo = photos.find((item) => item.id === params.id);
  if (!photo) throw notFound();
  // A slow answer, so you can see the pending state.
  await new Promise((done) => setTimeout(done, 400));
  return photo;
};

export const head = ({ data }: { data: DataOf<typeof serverLoad> }) => ({ title: data.title });

// #region demo
export default function PhotoPage({ data }: PageProps<typeof serverLoad, { id: string }>) {
  return (
    <article>
      <span class={"block h-64 rounded " + data.color} data-vt-name={"photo-" + data.id} data-vt-class="photo" />
      <h1 class="mt-3 text-xl font-semibold">{data.title}</h1>
      <a href="/" class="text-teal-700 underline">
        Back to the gallery
      </a>
    </article>
  );
}
// #endregion
