import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Modal" };

// #region demo
export default function SignUp() {
  const email = signal("");
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <DialogTrigger>
        <Button id="signup-trigger">Sign up…</Button>
        <Modal>
          <Dialog id="signup">
            {/* A render function: the form is created when the modal opens, with `close` in scope. */}
            {({ close }) => (
              <form
                class="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  email.set(String(new FormData(event.currentTarget).get("email")));
                  close();
                }}
              >
                <Heading slot="title" class="m-0 text-base font-semibold">
                  Subscribe to our newsletter
                </Heading>
                <p class="m-0 text-slate-600">Enter your information to receive updates about new features.</p>
                <label class="grid gap-1">
                  Name
                  <input id="signup-name" name="name" autoFocus class="rounded border border-slate-300 px-2 py-1" />
                </label>
                <label class="grid gap-1">
                  Email
                  <input id="signup-email" name="email" type="email" class="rounded border border-slate-300 px-2 py-1" />
                </label>
                <div class="flex justify-end gap-2">
                  <Button slot="close">Cancel</Button>
                  <Button id="signup-submit" type="submit">
                    Subscribe
                  </Button>
                </div>
              </form>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
      <p id="signup-value">{email() ? "Subscribed: " + email() : "Not subscribed"}</p>
    </section>
  );
}
// #endregion
