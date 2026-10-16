import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "DialogTrigger" };

// #region demo
export default function Profile() {
  const name = signal("Grace");
  return (
    <section id="page" class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <DialogTrigger>
        <Button id="profile-trigger">Edit profile</Button>
        <Modal>
          <Dialog id="profile">
            {/* A render function: the form is created when the dialog opens, with `close` in scope. */}
            {({ close }) => (
              <form
                class="mt-3 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  name.set(String(new FormData(event.currentTarget).get("name")));
                  close();
                }}
              >
                <Heading slot="title">Edit profile</Heading>
                <label class="grid gap-1">
                  Name
                  <input id="profile-name" name="name" value={name()} autoFocus class="rounded border border-slate-300 px-2 py-1" />
                </label>
                <div class="flex justify-end gap-2">
                  <Button slot="close" class="rounded px-3 py-1">
                    Cancel
                  </Button>
                  <Button id="profile-save" type="submit" class="rounded bg-teal-700 px-3 py-1 font-semibold text-white">
                    Save
                  </Button>
                </div>
              </form>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
      <p id="profile-value">Name: {name()}</p>
    </section>
  );
}
// #endregion
