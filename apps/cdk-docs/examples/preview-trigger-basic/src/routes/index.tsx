import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Link } from "@rivetjs/cdk/link";
import { Popover } from "@rivetjs/cdk/popover";
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";

export const head = { title: "PreviewTrigger" };

// #region demo
function ProfilePreview(props: { id: string; handle: string; name: string; bio: string }) {
  const { id, handle, name, bio } = props;
  const following = signal(false);
  return (
    <PreviewTrigger>
      <Link
        id={`${id}-link`}
        href="#"
        class="font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        @{handle}
      </Link>
      <Popover
        id={`${id}-preview`}
        class="w-70 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg outline-none transition-opacity duration-150 entering:opacity-0 exiting:opacity-0"
      >
        {() => (
          <>
            <div class="flex items-center gap-2">
              <span aria-hidden="true" class="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
                {name[0]}
              </span>
              <div class="min-w-0">
                <div class="font-semibold">{name}</div>
                <div class="text-xs text-slate-500">@{handle}</div>
              </div>
              <Button
                id={`${id}-follow`}
                class="ml-auto rounded-md border border-slate-300 px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-indigo-600"
                onPress={() => following.set(!following())}
              >
                {following() ? "Following" : "Follow"}
              </Button>
            </div>
            <p class="mt-3 mb-0">{bio}</p>
          </>
        )}
      </Popover>
    </PreviewTrigger>
  );
}

export default function Release() {
  return (
    <p class="mx-4 mt-8 max-w-120 text-sm">
      Just shipped a new release with help from{" "}
      <ProfilePreview id="maya" handle="mayachen" name="Maya Chen" bio="UI engineer, accessibility advocate, and component library enthusiast." /> and{" "}
      <ProfilePreview id="cwebb" handle="cwebb" name="Charles Webb" bio="Design systems, docs, and developer experience." />!
    </p>
  );
}
// #endregion
