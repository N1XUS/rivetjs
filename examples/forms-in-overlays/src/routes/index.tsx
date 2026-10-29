import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { LivePageProps, RequestEvent } from "@rivetjs/router";
import { actions, load, redirect } from "@rivetjs/router";
import { actionResult, navigate } from "@rivetjs/router/client";
import { createForm, type FormReply } from "@rivetjs/forms";
import { FormStatus } from "@rivetjs/forms/components";
import { action, invalid } from "@rivetjs/forms/server";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Form } from "@rivetjs/ui/form";
import { Modal } from "@rivetjs/ui/modal";
import { TextField } from "@rivetjs/ui/textfield";
import { Pencil, Plus, Trash2 } from "lucide";
import { createContactForm, deleteContactForm, updateContactForm } from "../forms/contact.ts";
import { createContact, deleteContact, emailTaken, getContact, listContacts, updateContact, type Contact } from "../server/contacts.server.ts";

export const head = { title: "Contacts" };

// A live page: `data` is an accessor. After a successful submit the router puts the fresh loader data into it (and
// into the layout): the page is not rendered again, so the overlays, focus and typed input keep their state.
export const live = true;

// `?new`, `?edit=<id>` and `?delete=<id>` open an overlay on the server: the entry points without JavaScript.
export const loader = load(({ url }: RequestEvent) => {
  const pick = (key: string) => (url.searchParams.has(key) ? (getContact(Number(url.searchParams.get(key))) ?? null) : null);
  return { contacts: listContacts(), creating: url.searchParams.has("new"), editing: pick("edit"), deleting: pick("delete") };
});

const TAKEN = "That email already belongs to a contact";

export const forms = actions({
  create: action(createContactForm, (value) => {
    if (emailTaken(value.email)) return invalid({ email: TAKEN });
    createContact(value);
    return redirect("/");
  }),
  update: action(updateContactForm, ({ id, ...value }) => {
    if (emailTaken(value.email, id)) return invalid({ email: TAKEN });
    if (!updateContact(id, value)) return invalid({ name: "This contact no longer exists" });
    return redirect("/");
  }),
  // Deleting a contact that is already gone is fine: the list is what the user wanted.
  remove: action(deleteContactForm, ({ id }) => {
    deleteContact(id);
    return redirect("/");
  }),
});

/** A failed POST without JavaScript renders the page again: reopen the overlay of the action that failed. */
const failed = (result: { status?: number } | undefined) => (result?.status ?? 0) >= 400;

/** Drop `?new` / `?edit=` / `?delete=` once its overlay closed, so a reload does not open it again (updates in place). */
function clearQuery(where: Location) {
  if (where.search) void navigate(where.pathname, { replace: true });
}

/** Preserve the anchor's open-in-new-tab/window behaviour for modified clicks. */
function plainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function Contacts({ data }: LivePageProps<typeof loader>) {
  const created = actionResult("create");
  const updated = actionResult("update");
  const removed = actionResult("remove");

  const creating = signal(data().creating || failed(created));
  const createStore = createForm(createContactForm, { result: created });

  // The contact the edit modal shows: from `?edit=`, from the failed POST's echoed id, or from the row's Edit button.
  const echoed = failed(updated) ? Number((updated!.result as FormReply).values?.id) : NaN;
  const editing = signal<Contact | null>(data().editing ?? (Number.isNaN(echoed) ? null : { id: echoed, name: "", email: "", company: "" }));
  const editOpen = signal(editing() !== null);

  const deleting = signal<Contact | null>(data().deleting);
  const deleteOpen = signal(deleting() !== null);
  const deleteStore = createForm(deleteContactForm, { result: removed });

  return (
    <main class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <h1 class="me-auto text-2xl font-semibold">Contacts</h1>
        {/* A link without JavaScript (`render` = an `a` with the Button's look); with it, the click opens the drawer in
            place. `data-rivet-prefetch="none"`: hovering it does not load the `?new` data for nothing. */}
        <Button
          id="new"
          render={(props) => <a {...(props as object)} type={undefined} href="?new" data-rivet-prefetch="none" />}
          onClick={(event: MouseEvent) => {
            if (!plainClick(event)) return;
            event.preventDefault();
            creating.set(true);
          }}
        >
          <Icon icon={Plus} size={16} /> New contact
        </Button>
      </div>

      {data().contacts.length === 0 ? (
        <EmptyState id="empty" variant="outline">
          No contacts yet.
        </EmptyState>
      ) : (
        <ul id="contacts" class="flex flex-col divide-y divide-separator rounded-2xl bg-surface shadow-surface">
          <For each={data().contacts} by={(contact) => contact.id}>
            {(contact) => (
              <li class="flex items-center gap-3 px-4 py-3" data-id={String(contact().id)}>
                <div class="me-auto min-w-0">
                  <p class="truncate font-medium">{contact().name}</p>
                  <p class="truncate text-sm text-muted">
                    {contact().email}
                    {contact().company ? ` · ${contact().company}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="tertiary"
                  aria-label={`Edit ${contact().name}`}
                  render={(props) => <a {...(props as object)} type={undefined} href={`?edit=${contact().id}`} data-rivet-prefetch="none" />}
                  onClick={(event: MouseEvent) => {
                    if (!plainClick(event)) return;
                    event.preventDefault();
                    editing.set(contact());
                    editOpen.set(true);
                  }}
                >
                  <Icon icon={Pencil} size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="danger-soft"
                  aria-label={`Delete ${contact().name}`}
                  render={(props) => <a {...(props as object)} type={undefined} href={`?delete=${contact().id}`} data-rivet-prefetch="none" />}
                  onClick={(event: MouseEvent) => {
                    if (!plainClick(event)) return;
                    event.preventDefault();
                    deleting.set(contact());
                    deleteOpen.set(true);
                  }}
                >
                  <Icon icon={Trash2} size={16} />
                </Button>
              </li>
            )}
          </For>
        </ul>
      )}

      {/* New contact: a drawer. isOpen is two-way: Escape, the close button or a press outside write false. */}
      <Drawer.Content isOpen={creating} placement="right" onOpenChange={(open: boolean) => open || clearQuery(location)}>
        <Drawer.Header>
          <Drawer.Heading>New contact</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {/* ui Form joined to the forms store: id / method / action from the definition, issues reach the named fields.
              `result` resolves true once the server accepted the form and the page data is fresh. */}
          <Form
            form={createStore}
            definition={createContactForm}
            class="flex flex-col gap-3"
            onSubmit={async (_event, result) => (await result) && creating.set(false)}
          >
            <ContactFields prefix="create" />
            <FormStatus of={createStore} pending="Saving..." class="text-sm text-danger" />
            <Button id="create-save" type="submit" fullWidth>
              Add contact
            </Button>
            <Button slot="close" variant="tertiary" render={(props) => <a {...(props as object)} type={undefined} href="/" />}>
              Cancel
            </Button>
          </Form>
        </Drawer.Body>
      </Drawer.Content>

      {/* Edit: a modal. Its form is made per contact (initial values), so it is a component of its own. */}
      <Modal.Content isOpen={editOpen} class="sm:max-w-md" onOpenChange={(open: boolean) => open || clearQuery(location)}>
        <Modal.Header>
          <Modal.Heading>Edit contact</Modal.Heading>
        </Modal.Header>
        <Modal.Body>{editing() ? <EditContact contact={editing()!} result={updated} onSaved={() => editOpen.set(false)} /> : null}</Modal.Body>
      </Modal.Content>

      {/* Delete: an alert dialog that asks first. The confirm button submits a one-field form. */}
      <AlertDialog.Backdrop isOpen={deleteOpen} onOpenChange={(open: boolean) => open || clearQuery(location)}>
        <AlertDialog.Container>
          <AlertDialog.Dialog class="sm:max-w-[400px]">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Delete {deleting()?.name ?? "contact"}?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>The contact is removed from the list. This cannot be undone.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Form
                form={deleteStore}
                definition={deleteContactForm}
                class="flex gap-2"
                onSubmit={async (_event, result) => (await result) && deleteOpen.set(false)}
              >
                <input type="hidden" name="id" value={String(deleting()?.id ?? "")} />
                <FormStatus of={deleteStore} pending="Deleting..." class="text-sm text-danger" />
                <Button slot="close" variant="tertiary" render={(props) => <a {...(props as object)} type={undefined} href="/" />}>
                  Cancel
                </Button>
                <Button id="delete-confirm" type="submit" variant="danger">
                  Delete
                </Button>
              </Form>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </main>
  );
}

function ContactFields({ prefix }: { prefix: string }) {
  return (
    <>
      <TextField id={`${prefix}-name`} name="name" label="Name" autoComplete="name" variant="secondary" fullWidth />
      <TextField id={`${prefix}-email`} name="email" type="email" label="Email" autoComplete="email" variant="secondary" fullWidth />
      <TextField id={`${prefix}-company`} name="company" label="Company" autoComplete="organization" variant="secondary" fullWidth />
    </>
  );
}

function EditContact(props: { contact: Contact; result: ReturnType<typeof actionResult>; onSaved: () => void }) {
  // `initial` fills the fields; after a failed POST without JavaScript the echoed values win.
  const { id, ...initial } = props.contact;
  const store = createForm(updateContactForm, { initial, result: props.result });
  return (
    <Form form={store} definition={updateContactForm} class="flex flex-col gap-3" onSubmit={async (_event, result) => (await result) && props.onSaved()}>
      <input type="hidden" name="id" value={String(id)} />
      <ContactFields prefix="edit" />
      <FormStatus of={store} pending="Saving..." class="text-sm text-danger" />
      <Button id="edit-save" type="submit" fullWidth>
        Save changes
      </Button>
      <Button slot="close" variant="tertiary" render={(props) => <a {...(props as object)} type={undefined} href="/" />}>
        Cancel
      </Button>
    </Form>
  );
}
