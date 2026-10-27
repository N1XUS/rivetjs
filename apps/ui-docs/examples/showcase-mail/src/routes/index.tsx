// Rivet-authored showcase (own content: an invented design studio's inbox).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { computed, signal } from "@rivetjs/reactivity";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
import { Label } from "@rivetjs/ui/label";
import { Modal } from "@rivetjs/ui/modal";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, useDefaultLayout } from "@rivetjs/ui/resizable";
import { SearchField } from "@rivetjs/ui/search-field";
import { Segment } from "@rivetjs/ui/segment";
import { Sidebar } from "@rivetjs/ui/sidebar";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";
import { Toast, toast } from "@rivetjs/ui/toast";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { Toolbar } from "@rivetjs/ui/toolbar";
import { Archive, ArrowLeft, File, Inbox, MailCheck, MailOpen, PenLine, Reply, Send, Star, Trash2 } from "lucide";

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
  const folder = signal<Folder>("inbox");
  const filter = signal<string | null>("all");
  const query = signal("");
  // The open message = the list's single selection (ItemCardGroup on the cdk GridList: click / arrow keys select).
  const selection = signal<Selection>(new Set());
  const selectedId = () => {
    const keys = selection();
    return keys === "all" ? null : ((keys.values().next().value as string | undefined) ?? null);
  };
  // Mutable state lives in small signals next to the static messages, so the list rows keep their nodes.
  const unread = signal(new Set(["m1", "m2", "m3"]));
  const starred = signal(new Set(["m3"]));
  const moved = signal<Record<string, Folder>>({});
  const deleted = signal(new Set<string>());
  const sent = signal<Message[]>([]);
  const composeOpen = signal(false);
  const draftTo = signal("");
  const draftSubject = signal("");
  const draftBody = signal("");
  const confirmOpen = signal(false);
  const pendingId = signal<string | null>(null);

  // Pane sizes persist in localStorage (restored once the page is idle).
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail-panes" });

  const all = computed(() => [...sent(), ...MESSAGES].filter((m) => !deleted().has(m.id)));
  const folderOf = (m: Message) => moved()[m.id] ?? m.folder;
  const inFolder = (m: Message, f: Folder) => (f === "starred" ? starred().has(m.id) && folderOf(m) !== "trash" : folderOf(m) === f);
  const visible = computed(() => {
    const q = query().trim().toLowerCase();
    return all().filter(
      (m) => inFolder(m, folder()) && (filter() !== "unread" || unread().has(m.id)) && (!q || `${m.from} ${m.subject} ${m.preview}`.toLowerCase().includes(q)),
    );
  });
  const selected = computed(() => all().find((m) => m.id === selectedId()) ?? null);
  const pending = computed(() => all().find((m) => m.id === pendingId()) ?? null);
  const pendingIsTrash = () => (pending() ? folderOf(pending()!) === "trash" : false);
  const unreadInbox = () => all().filter((m) => folderOf(m) === "inbox" && unread().has(m.id)).length;
  const folderLabel = () => FOLDERS.find((f) => f.key === folder())?.label ?? "";

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };
  const open = (id: string | null) => {
    selection.set(id ? new Set([id]) : new Set());
    if (id) unread.set(toggle(unread(), id, false));
  };
  const moveTo = (id: string, to: Folder) => {
    moved.set({ ...moved(), [id]: to });
    open(null);
    toast(to === "archive" ? "Conversation archived." : "Conversation moved to Trash.");
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
    if (selectedId() === id) open(next?.id ?? null);
    toast(permanent ? `Deleted "${message.subject}".` : `Moved "${message.subject}" to Trash.`);
  };
  const compose = (to = "", subject = "") => {
    draftTo.set(to);
    draftSubject.set(subject);
    draftBody.set("");
    composeOpen.set(true);
  };
  const pickFolder = (f: Folder) => {
    folder.set(f);
    open(null);
  };

  return (
    <div class="mx-auto h-[760px] max-w-6xl">
      <Toast.Provider />
      {/* A card-sized app shell: `contained` keeps the sidebar inside the bordered box (an icon rail when collapsed, a sheet below 768 px). */}
      <Sidebar.Provider contained class="h-full rounded-2xl border border-separator bg-surface text-sm">
        <Sidebar id="mail-folders" collapsible="icon" aria-label="Folders">
          <Sidebar.Header>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="lg" tooltip="Theo Varga">
                  <Avatar size="sm" color="accent">
                    <Avatar.Fallback>TV</Avatar.Fallback>
                  </Avatar>
                  <span class="flex min-w-0 flex-col leading-tight">
                    <span class="truncate font-medium">Theo Varga</span>
                    <span class="truncate text-xs text-muted">theo@fieldnote.studio</span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="compose" variant="outline" tooltip="Compose" onPress={() => compose()}>
                  <Icon icon={PenLine} size={16} />
                  <span>Compose</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu>
                {FOLDERS.map((f) => (
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton id={`folder-${f.key}`} tooltip={f.label} isCurrent={() => folder() === f.key} onPress={() => pickFolder(f.key)}>
                      <Icon icon={f.icon} size={16} />
                      <span>{f.label}</span>
                    </Sidebar.MenuButton>
                    {f.key === "inbox" ? (
                      <Sidebar.MenuBadge id="unread-count" aria-label="unread">
                        {unreadInbox()}
                      </Sidebar.MenuBadge>
                    ) : null}
                  </Sidebar.MenuItem>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Rail />
        </Sidebar>

        <Sidebar.Inset class="min-w-0">
          <ResizablePanelGroup id="mail-panes" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} class="mail-panes h-full min-h-0">
            {/* Message list */}
            <ResizablePanel id="mail-list" data-pane="list" defaultSize="42%" minSize="280px" class="flex flex-col">
              <section aria-label="Messages" class={`flex min-h-0 min-w-0 flex-1 flex-col ${selectedId() ? "mail-mobile-hidden" : ""}`}>
                <div class="flex flex-col gap-3 border-b border-separator p-3">
                  <div class="flex items-center gap-2">
                    <Sidebar.Trigger id="rail-toggle" aria-label="Toggle folders" class="-ms-1" />
                    <h2 class="flex-1 truncate text-lg font-semibold">{folderLabel()}</h2>
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
                </div>
                {/* Delete / Backspace on a focused row asks to delete it (one listener for the whole list). */}
                <div
                  id="mail-list-items"
                  class="min-h-0 flex-1 overflow-y-auto"
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key !== "Delete" && event.key !== "Backspace") return;
                    const id = (event.target as Element).closest?.("[data-key]")?.getAttribute("data-key");
                    if (!id) return;
                    event.preventDefault();
                    askDelete(id);
                  }}
                >
                  <ItemCardGroupCollection
                    id="mail-list-group"
                    aria-label={folderLabel()}
                    aria-keyshortcuts="Delete"
                    variant="transparent"
                    selectionMode="single"
                    selectionBehavior="replace"
                    selectedKeys={selection}
                    onSelectionChange={(keys: Selection) => {
                      const id = keys === "all" ? undefined : (keys.values().next().value as string | undefined);
                      if (id) unread.set(toggle(unread(), id, false));
                    }}
                    items={visible}
                    renderEmptyState={() => (
                      <EmptyState size="sm" class="py-16">
                        <EmptyState.Header>
                          <EmptyState.Media variant="icon">
                            <Icon icon={MailCheck} size={20} />
                          </EmptyState.Media>
                          <EmptyState.Title>Nothing here</EmptyState.Title>
                          <EmptyState.Description>No messages match this folder and filter.</EmptyState.Description>
                        </EmptyState.Header>
                      </EmptyState>
                    )}
                  >
                    {(m: Message) => (
                      <ItemCard id={m.id} textValue={`${m.from}: ${m.subject}`} isUnread={unread().has(m.id)} class="mail-row items-start">
                        <Avatar size="sm">
                          <Avatar.Fallback>{initials(m.from)}</Avatar.Fallback>
                        </Avatar>
                        <ItemCard.Content>
                          <ItemCard.Title>{m.from}</ItemCard.Title>
                          <span class="mail-row__subject truncate">{m.subject}</span>
                          <ItemCard.Description class="line-clamp-2">{m.preview}</ItemCard.Description>
                        </ItemCard.Content>
                        <ItemCard.Action class="flex-col items-end gap-2 self-stretch">
                          <span class="text-xs text-muted">{m.time}</span>
                          <ItemCard.Indicator aria-label="Unread" />
                        </ItemCard.Action>
                      </ItemCard>
                    )}
                  </ItemCardGroupCollection>
                </div>
              </section>
            </ResizablePanel>
            <ResizableHandle id="mail-handle-list" aria-label="Resize message list" withHandle />

            {/* Reading pane */}
            <ResizablePanel id="mail-reader" data-pane="reader" minSize="320px" class="flex flex-col">
              <article aria-label="Message" class={`flex min-h-0 min-w-0 flex-1 flex-col ${selectedId() ? "" : "mail-mobile-hidden"}`}>
                {selected() ? (
                  <>
                    <Toolbar id="reader-actions" aria-label="Message actions" class="gap-1 border-b border-separator p-2">
                      <Button id="back" isIconOnly variant="ghost" aria-label="Back to list" class="md:hidden" onPress={() => open(null)}>
                        <Icon icon={ArrowLeft} size={16} />
                      </Button>
                      <div class="flex-1" />
                      <ToggleButton
                        id="star"
                        isIconOnly
                        variant="ghost"
                        aria-label="Star"
                        isSelected={starred().has(selected()!.id)}
                        onChange={(on: boolean) => starred.set(toggle(starred(), selected()!.id, on))}
                        class="mail-star"
                      >
                        <Icon icon={Star} size={16} />
                      </ToggleButton>
                      <Button
                        id="unread"
                        isIconOnly
                        variant="ghost"
                        aria-label="Mark as unread"
                        onPress={() => unread.set(toggle(unread(), selected()!.id, true))}
                      >
                        <Icon icon={MailOpen} size={16} />
                      </Button>
                      <Button id="archive" isIconOnly variant="ghost" aria-label="Archive" onPress={() => moveTo(selected()!.id, "archive")}>
                        <Icon icon={Archive} size={16} />
                      </Button>
                      <Button id="trash" isIconOnly variant="ghost" aria-label="Delete" onPress={() => askDelete(selected()!.id)}>
                        <Icon icon={Trash2} size={16} />
                      </Button>
                    </Toolbar>
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
                  <EmptyState id="reader-empty" class="flex-1">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <Icon icon={Inbox} size={20} />
                      </EmptyState.Media>
                      <EmptyState.Title>No message selected</EmptyState.Title>
                      <EmptyState.Description>Select a message to read it.</EmptyState.Description>
                    </EmptyState.Header>
                  </EmptyState>
                )}
              </article>
            </ResizablePanel>
          </ResizablePanelGroup>
        </Sidebar.Inset>
      </Sidebar.Provider>

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
              toast.success(`Sent to ${draftTo()}.`);
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
