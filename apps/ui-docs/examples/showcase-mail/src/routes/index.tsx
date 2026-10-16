// Rivet-authored showcase (own content: an invented design studio's inbox).
import { Icon } from "@rivetjs/kit/icon";
import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Avatar } from "@rivetjs/ui/avatar";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Modal } from "@rivetjs/ui/modal";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, useDefaultLayout, usePanelRef } from "@rivetjs/ui/resizable";
import { SearchField } from "@rivetjs/ui/search-field";
import { Segment } from "@rivetjs/ui/segment";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";
import { Archive, ArrowLeft, File, Inbox, MailCheck, PanelLeftClose, PanelLeftOpen, PenLine, Reply, Send, Star, Trash2 } from "lucide";

export const head = { title: "Showcase: Mail" };

// #region demo
type Folder = "inbox" | "starred" | "sent" | "drafts" | "archive" | "trash";
type Message = { id: string; folder: Folder; from: string; email: string; subject: string; preview: string; body: string[]; time: string; label?: string };

const FOLDERS: { key: Folder; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "starred", label: "Starred", icon: Star },
  { key: "sent", label: "Sent", icon: Send },
  { key: "drafts", label: "Drafts", icon: File },
  { key: "archive", label: "Archive", icon: Archive },
  { key: "trash", label: "Trash", icon: Trash2 },
];

const MESSAGES: Message[] = [
  {
    id: "m1",
    folder: "inbox",
    from: "Nadia Brandt",
    email: "nadia@fieldnote.studio",
    subject: "Packaging proofs for the autumn line",
    preview: "The printer sent the second round of proofs. Two of the six boxes still look too warm…",
    body: [
      "Hi Theo,",
      "The printer sent the second round of proofs this morning. Two of the six boxes still look too warm next to the swatches we signed off, mostly the mug and the beanie.",
      "Could you have a look before Thursday? If we approve by Friday noon they can still run the job next week.",
      "Thanks, Nadia",
    ],
    time: "9:41",
    label: "Production",
  },
  {
    id: "m2",
    folder: "inbox",
    from: "Ilse Marchetti",
    email: "ilse@harbourlight.co",
    subject: "Lamp restock: 40 units on the way",
    preview: "Good news: the halo lamps cleared customs and should reach the warehouse on Monday.",
    body: [
      "Hello,",
      "Good news: the halo lamps cleared customs and should reach your warehouse on Monday. I attached the delivery note and the updated invoice.",
      "Let me know if you want the next batch in the warm grey finish as well.",
      "Best, Ilse",
    ],
    time: "8:15",
    label: "Suppliers",
  },
  {
    id: "m3",
    folder: "inbox",
    from: "Kwame Asante",
    email: "kwame@asante.photo",
    subject: "Lookbook shoot, call sheet",
    preview: "Call time is 7:30 at the studio. I booked the second softbox and the grey backdrop.",
    body: [
      "Hey Theo,",
      "Call time is 7:30 at the studio. I booked the second softbox and the grey backdrop, and the model agency confirmed both people.",
      "Please bring the runner samples in sizes 9 and 10. We will shoot the tote on the stairs if the light is good.",
      "Kwame",
    ],
    time: "Yesterday",
    label: "Marketing",
  },
  {
    id: "m4",
    folder: "inbox",
    from: "Rosa Lindqvist",
    email: "rosa@lindqvist.law",
    subject: "Updated returns policy",
    preview: "I went through the returns page and marked three sentences that need a clearer time limit.",
    body: [
      "Hi Theo,",
      "I went through the returns page and marked three sentences that need a clearer time limit. The rest is fine as it is.",
      "The marked copy is in the shared folder. Happy to jump on a call if anything is unclear.",
      "Kind regards, Rosa",
    ],
    time: "Mon",
  },
  {
    id: "m5",
    folder: "inbox",
    from: "Fieldnote Shop",
    email: "orders@fieldnote.studio",
    subject: "Weekly summary: 214 orders",
    preview: "Revenue $11,940 (up 6.1%), conversion 3.1%, top product: Trail runner.",
    body: [
      "Your week at a glance:",
      "214 orders, $11,940 revenue (up 6.1% on the week before), 3.1% conversion. The trail runner sold best, followed by the canvas tote.",
      "Open the dashboard for the full breakdown.",
    ],
    time: "Sun",
    label: "Reports",
  },
  {
    id: "m6",
    folder: "sent",
    from: "Theo Varga",
    email: "theo@fieldnote.studio",
    subject: "Re: Shipping rates for 2027",
    preview: "Thanks Marta, the flat rate works for us if the zone 3 surcharge stays below two dollars.",
    body: [
      "Thanks Marta,",
      "The flat rate works for us if the zone 3 surcharge stays below two dollars. Send over the contract and I will sign it this week.",
      "Theo",
    ],
    time: "Fri",
  },
  {
    id: "m7",
    folder: "drafts",
    from: "Theo Varga",
    email: "theo@fieldnote.studio",
    subject: "Newsletter: autumn drop",
    preview: "Three new colours, one new lamp, and a tote that finally has an inside pocket.",
    body: ["Three new colours, one new lamp, and a tote that finally has an inside pocket.", "(draft, finish the intro)"],
    time: "Thu",
  },
  {
    id: "m8",
    folder: "archive",
    from: "Jonas Weber",
    email: "jonas@weber-ceramics.de",
    subject: "Mug glaze samples",
    preview: "The speckled glaze came out well; the matte one cracked in two of five firings.",
    body: [
      "Hi Theo,",
      "The speckled glaze came out well; the matte one cracked in two of five firings, so I would not use it for the mugs.",
      "Samples are on their way. Jonas",
    ],
    time: "Sep 28",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export default function MailShowcase() {
  const folder = signal<string>("inbox");
  const folderKey = () => folder() as Folder;
  const filter = signal<string | null>("all");
  const query = signal("");
  const selectedId = signal<string | null>(null);
  // Mutable state lives in small signals next to the static messages, so the list rows keep their nodes.
  const unread = signal(new Set(["m1", "m2", "m3"]));
  const starred = signal(new Set(["m3"]));
  const moved = signal<Record<string, Folder>>({});
  const deleted = signal(new Set<string>());
  const sent = signal<Message[]>([]);
  const status = signal("");
  const composeOpen = signal(false);
  const draftTo = signal("");
  const draftSubject = signal("");
  const draftBody = signal("");
  const confirmOpen = signal(false);
  const pendingId = signal<string | null>(null);

  // Pane sizes persist in localStorage (restored once the page is idle); the folder pane collapses to an icon rail.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail-panes" });
  const navPanel = usePanelRef();
  const rail = signal<boolean | null>(null);
  const isRail = () => rail() ?? (defaultLayout()?.["mail-nav"] ?? 20) < 10;

  const all = computed(() => [...sent(), ...MESSAGES].filter((m) => !deleted().has(m.id)));
  const folderOf = (m: Message) => moved()[m.id] ?? m.folder;
  const inFolder = (m: Message, f: Folder) => (f === "starred" ? starred().has(m.id) && folderOf(m) !== "trash" : folderOf(m) === f);
  const visible = computed(() => {
    const q = query().trim().toLowerCase();
    return all().filter(
      (m) =>
        inFolder(m, folderKey()) && (filter() !== "unread" || unread().has(m.id)) && (!q || `${m.from} ${m.subject} ${m.preview}`.toLowerCase().includes(q)),
    );
  });
  const selected = computed(() => all().find((m) => m.id === selectedId()) ?? null);
  const pending = computed(() => all().find((m) => m.id === pendingId()) ?? null);
  const pendingIsTrash = () => (pending() ? folderOf(pending()!) === "trash" : false);
  const count = (f: Folder) => (f === "inbox" ? all().filter((m) => folderOf(m) === "inbox" && unread().has(m.id)).length : 0);
  const folderLabel = () => FOLDERS.find((f) => f.key === folder())?.label ?? "";

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };
  const open = (id: string) => {
    selectedId.set(id);
    unread.set(toggle(unread(), id, false));
  };
  const moveTo = (id: string, to: Folder) => {
    moved.set({ ...moved(), [id]: to });
    selectedId.set(null);
    status.set(to === "archive" ? "Conversation archived." : "Conversation moved to Trash.");
  };
  const askDelete = (id: string) => {
    pendingId.set(id);
    confirmOpen.set(true);
  };
  // Confirmed delete: Trash → gone for good, elsewhere → Trash; the next message in the list opens.
  const confirmDelete = () => {
    const id = pendingId();
    const message = pending();
    if (!id || !message) return;
    const list = visible();
    const index = list.findIndex((m) => m.id === id);
    const next = list[index + 1] ?? list[index - 1] ?? null;
    const permanent = folderOf(message) === "trash";
    if (permanent) deleted.set(toggle(deleted(), id, true));
    else moved.set({ ...moved(), [id]: "trash" });
    pendingId.set(null);
    if (next && selectedId() === id) open(next.id);
    else if (selectedId() === id) selectedId.set(null);
    status.set(permanent ? `Deleted "${message.subject}".` : `Moved "${message.subject}" to Trash.`);
  };
  const compose = (to = "", subject = "") => {
    draftTo.set(to);
    draftSubject.set(subject);
    draftBody.set("");
    composeOpen.set(true);
  };
  const pickFolder = (f: Folder) => {
    folder.set(f);
    selectedId.set(null);
  };
  const toggleRail = () => {
    const panel = navPanel.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

  return (
    <div class="mx-auto h-[760px] max-w-6xl">
      <ResizablePanelGroup
        id="mail-panes"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        class="mail-panes overflow-hidden rounded-2xl border border-separator bg-surface text-sm"
      >
        {/* Folders (from 768 px); drag the handle to the left (or press Enter on it) to collapse it to an icon rail */}
        <ResizablePanel
          id="mail-nav"
          data-pane="nav"
          defaultSize="20%"
          minSize="180px"
          maxSize="30%"
          collapsible
          collapsedSize="64px"
          panelRef={navPanel}
          onResize={(size) => rail.set(size.inPixels < 120)}
          class="flex flex-col"
        >
          <nav aria-label="Folders" data-rail={isRail() ? "true" : undefined} class="group/nav flex flex-1 flex-col gap-1 p-3">
            <div class="flex items-center gap-2 px-2 pt-1 pb-3 group-data-[rail=true]/nav:flex-col group-data-[rail=true]/nav:px-0">
              <Avatar size="sm" color="accent">
                <Avatar.Fallback>TV</Avatar.Fallback>
              </Avatar>
              <div class="min-w-0 flex-1 group-data-[rail=true]/nav:sr-only">
                <p class="truncate font-medium">Theo Varga</p>
                <p class="truncate text-xs text-muted">theo@fieldnote.studio</p>
              </div>
              <Button
                id="rail-toggle"
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={isRail() ? "Expand folders" : "Collapse folders"}
                onPress={() => toggleRail()}
              >
                <Icon icon={PanelLeftClose} size={16} class="group-data-[rail=true]/nav:hidden" />
                <Icon icon={PanelLeftOpen} size={16} class="hidden group-data-[rail=true]/nav:block" />
              </Button>
            </div>
            <Button
              id="compose"
              class="mb-2 group-data-[rail=true]/nav:size-10 group-data-[rail=true]/nav:self-center group-data-[rail=true]/nav:px-0"
              onPress={() => compose()}
            >
              <Icon icon={PenLine} size={16} />
              <span class="group-data-[rail=true]/nav:sr-only">Compose</span>
            </Button>
            {FOLDERS.map((f) => (
              <button
                id={`folder-${f.key}`}
                type="button"
                title={f.label}
                aria-current={folder() === f.key ? "page" : undefined}
                class="flex cursor-(--cursor-interactive) items-center gap-3 rounded-xl px-3 py-2 text-left text-muted transition-colors duration-150 ease-out outline-none focus-visible:status-focused motion-reduce:transition-none group-data-[rail=true]/nav:justify-center group-data-[rail=true]/nav:px-0 hover:bg-default aria-[current=page]:bg-default aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                onClick={() => pickFolder(f.key)}
              >
                <Icon icon={f.icon} size={16} />
                <span class="flex-1 group-data-[rail=true]/nav:sr-only">{f.label}</span>
                {f.key === "inbox" ? (
                  <span id="unread-count" class="text-xs tabular-nums group-data-[rail=true]/nav:sr-only">
                    {count("inbox")}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </ResizablePanel>
        <ResizableHandle id="mail-handle-nav" aria-label="Resize folders" withHandle />

        {/* Message list */}
        <ResizablePanel id="mail-list" data-pane="list" defaultSize="34%" minSize="260px" class="flex flex-col">
          <section aria-label="Messages" class={`flex min-h-0 min-w-0 flex-1 flex-col ${selectedId() ? "mail-mobile-hidden" : ""}`}>
            <div class="flex flex-col gap-3 border-b border-separator p-3">
              <div class="flex items-center gap-2">
                <h2 class="hidden flex-1 text-lg font-semibold md:block">{folderLabel()}</h2>
                <NativeSelect value={folder} class="flex-1 md:hidden" aria-label="Folder">
                  <NativeSelect.Trigger>
                    {FOLDERS.map((f) => (
                      <NativeSelect.Option value={f.key}>{f.label}</NativeSelect.Option>
                    ))}
                  </NativeSelect.Trigger>
                </NativeSelect>
                <Button id="compose-mobile" isIconOnly variant="secondary" aria-label="Compose" class="md:hidden" onPress={() => compose()}>
                  <Icon icon={PenLine} size={16} />
                </Button>
                <Segment id="mail-filter" aria-label="Show" selectedKey={filter} size="sm">
                  <Segment.Item id="all">All</Segment.Item>
                  <Segment.Item id="unread">Unread</Segment.Item>
                </Segment>
              </div>
              <SearchField id="mail-search" aria-label="Search mail" value={query} fullWidth>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Search mail" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <p id="mail-status" role="status" class="text-xs text-muted empty:hidden">
                {status()}
              </p>
            </div>
            <ul id="mail-list-items" class="flex-1 overflow-y-auto">
              <For each={visible()} by={(m) => m.id}>
                {(m) => (
                  <li>
                    <button
                      id={`msg-${m().id}`}
                      type="button"
                      aria-current={selectedId() === m().id ? "true" : undefined}
                      aria-keyshortcuts="Delete"
                      class="flex w-full cursor-(--cursor-interactive) gap-3 border-b border-separator px-3 py-3 text-left transition-colors duration-150 ease-out outline-none focus-visible:status-focused motion-reduce:transition-none hover:bg-default/60 aria-[current=true]:bg-default"
                      onClick={() => open(m().id)}
                      onKeyDown={(event: KeyboardEvent) => {
                        if (event.key !== "Delete" && event.key !== "Backspace") return;
                        event.preventDefault();
                        askDelete(m().id);
                      }}
                    >
                      <Avatar size="sm">
                        <Avatar.Fallback>{initials(m().from)}</Avatar.Fallback>
                      </Avatar>
                      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span class="flex items-center gap-2">
                          <span class={`flex-1 truncate ${unread().has(m().id) ? "font-semibold" : ""}`}>{m().from}</span>
                          <span class="shrink-0 text-xs text-muted">{m().time}</span>
                        </span>
                        <span class={`truncate ${unread().has(m().id) ? "font-medium text-foreground" : "text-foreground/80"}`}>{m().subject}</span>
                        <span class="line-clamp-2 text-xs text-muted">{m().preview}</span>
                      </span>
                      {unread().has(m().id) ? <span aria-label="Unread" class="mt-1.5 size-2 shrink-0 rounded-full bg-accent" /> : null}
                    </button>
                  </li>
                )}
              </For>
              {visible().length === 0 ? (
                <li class="flex flex-col items-center gap-2 px-6 py-16 text-center text-muted">
                  <Icon icon={MailCheck} size={28} />
                  <p>Nothing here.</p>
                </li>
              ) : null}
            </ul>
          </section>
        </ResizablePanel>
        <ResizableHandle id="mail-handle-list" aria-label="Resize message list" withHandle />

        {/* Reading pane */}
        <ResizablePanel id="mail-reader" data-pane="reader" minSize="320px" class="flex flex-col">
          <article aria-label="Message" class={`flex min-h-0 min-w-0 flex-1 flex-col ${selectedId() ? "" : "mail-mobile-hidden"}`}>
            {selected() ? (
              <>
                <div class="flex items-center gap-1 border-b border-separator p-2">
                  <Button id="back" isIconOnly variant="ghost" aria-label="Back to list" class="md:hidden" onPress={() => selectedId.set(null)}>
                    <Icon icon={ArrowLeft} size={16} />
                  </Button>
                  <div class="flex-1" />
                  <Button
                    id="star"
                    isIconOnly
                    variant="ghost"
                    aria-label={starred().has(selected()!.id) ? "Unstar" : "Star"}
                    aria-pressed={starred().has(selected()!.id) ? "true" : "false"}
                    onPress={() => starred.set(toggle(starred(), selected()!.id, !starred().has(selected()!.id)))}
                  >
                    <Icon icon={Star} size={16} class={starred().has(selected()!.id) ? "fill-warning text-warning" : ""} />
                  </Button>
                  <Button id="archive" isIconOnly variant="ghost" aria-label="Archive" onPress={() => moveTo(selected()!.id, "archive")}>
                    <Icon icon={Archive} size={16} />
                  </Button>
                  <Button id="trash" isIconOnly variant="ghost" aria-label="Delete" onPress={() => askDelete(selected()!.id)}>
                    <Icon icon={Trash2} size={16} />
                  </Button>
                </div>
                <div class="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
                  <div class="flex flex-col gap-2">
                    <h2 id="reader-subject" class="text-xl font-semibold text-balance">
                      {selected()!.subject}
                    </h2>
                    {selected()!.label ? (
                      <Chip size="sm" variant="soft" class="self-start">
                        {selected()!.label}
                      </Chip>
                    ) : null}
                  </div>
                  <div class="flex items-center gap-3">
                    <Avatar>
                      <Avatar.Fallback>{initials(selected()!.from)}</Avatar.Fallback>
                    </Avatar>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-medium">{selected()!.from}</p>
                      <p class="truncate text-xs text-muted">{selected()!.email}</p>
                    </div>
                    <span class="text-xs text-muted">{selected()!.time}</span>
                  </div>
                  <div class="flex flex-col gap-3 leading-relaxed">
                    {selected()!.body.map((p) => (
                      <p>{p}</p>
                    ))}
                  </div>
                  <div>
                    <Button id="reply" variant="secondary" onPress={() => compose(selected()!.email, `Re: ${selected()!.subject.replace(/^Re: /, "")}`)}>
                      <Icon icon={Reply} size={16} />
                      Reply
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div class="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
                <Icon icon={Inbox} size={32} />
                <p>Select a message to read it.</p>
              </div>
            )}
          </article>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog.Backdrop isOpen={confirmOpen} isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog id="confirm-dialog" class="sm:max-w-[400px]">
            {() => (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>{pendingIsTrash() ? "Delete forever?" : "Delete conversation?"}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p id="confirm-text">
                    {pendingIsTrash()
                      ? `"${pending()?.subject ?? ""}" will be removed for good. This can't be undone.`
                      : `"${pending()?.subject ?? ""}" will move to Trash.`}
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button id="confirm-cancel" slot="close" variant="tertiary" autoFocus>
                    Cancel
                  </Button>
                  <Button id="confirm-delete" slot="close" variant="danger" onPress={() => confirmDelete()}>
                    Delete
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <Modal.Content isOpen={composeOpen} class="sm:max-w-lg">
        <Modal.Header>
          <Modal.Heading>New message</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <Form
            id="compose-form"
            class="flex flex-col gap-4"
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault();
              const id = `s${sent().length + 1}`;
              sent.set([
                {
                  id,
                  folder: "sent",
                  from: "Theo Varga",
                  email: draftTo(),
                  subject: draftSubject(),
                  preview: draftBody().slice(0, 90),
                  body: draftBody().split(/\n+/),
                  time: "Now",
                },
                ...sent(),
              ]);
              status.set(`Sent to ${draftTo()}.`);
              composeOpen.set(false);
            }}
          >
            <TextField isRequired name="to" type="email" value={draftTo} fullWidth>
              <Label>To</Label>
              <Input id="compose-to" placeholder="name@example.com" variant="secondary" />
              <FieldError />
            </TextField>
            <TextField isRequired name="subject" value={draftSubject} fullWidth>
              <Label>Subject</Label>
              <Input id="compose-subject" variant="secondary" />
              <FieldError />
            </TextField>
            <TextField isRequired name="body" value={draftBody} fullWidth>
              <Label>Message</Label>
              <TextArea id="compose-body" rows={6} variant="secondary" />
              <FieldError />
            </TextField>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary">
            Discard
          </Button>
          <Button id="send" type="submit" form="compose-form">
            <Icon icon={Send} size={16} />
            Send
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </div>
  );
}
// #endregion
