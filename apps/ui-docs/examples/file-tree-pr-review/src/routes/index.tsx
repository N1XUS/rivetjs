// Rivet-authored FileTree demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Collection } from "@rivetjs/cdk/collections/components";
import type { TreeItemContentRenderProps } from "@rivetjs/cdk/tree";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Chip } from "@rivetjs/ui/chip";
import { FileTree } from "@rivetjs/ui/file-tree";
import { Status } from "@rivetjs/ui/status";
import { CircleCheck, FileMinus, FilePen, FilePlus, FileSymlink, Folder, FolderOpen, MessageSquare } from "lucide";

export const head = { title: "FileTree: PR File Review" };

// #region demo
type Change = "added" | "modified" | "deleted" | "renamed";

interface Entry {
  id: string;
  name: string;
  change?: Change;
  from?: string;
  added?: number;
  removed?: number;
  comments?: number;
  children?: Entry[];
}

const CHANGES: Entry[] = [
  {
    id: "src",
    name: "src",
    children: [
      {
        id: "components",
        name: "components",
        children: [
          { id: "prompt-input", name: "prompt-input.tsx", change: "modified", added: 48, removed: 12, comments: 2 },
          { id: "token-chip", name: "token-chip.tsx", change: "added", added: 86, removed: 0 },
          { id: "tag-list", name: "tag-list.tsx", change: "deleted", added: 0, removed: 54, comments: 1 },
        ],
      },
      { id: "use-tokens", name: "use-tokens.ts", change: "renamed", from: "src/use-tags.ts", added: 9, removed: 7 },
      { id: "index", name: "index.ts", change: "modified", added: 2, removed: 1 },
    ],
  },
  {
    id: "tests",
    name: "tests",
    children: [{ id: "prompt-input-test", name: "prompt-input.test.tsx", change: "modified", added: 64, removed: 3, comments: 3 }],
  },
  { id: "readme", name: "README.md", change: "modified", added: 11, removed: 2 },
];

const CHANGE = {
  added: { label: "Added", letter: "A", color: "success", text: "text-success", icon: FilePlus },
  modified: { label: "Modified", letter: "M", color: "warning", text: "text-warning", icon: FilePen },
  deleted: { label: "Deleted", letter: "D", color: "danger", text: "text-danger", icon: FileMinus },
  renamed: { label: "Renamed", letter: "R", color: "accent", text: "text-accent", icon: FileSymlink },
} as const;

// Lookups by key: the entry, its path, and the files under it (a file is its own only file).
const byId = new Map<string, Entry>();
const paths = new Map<string, string>();
const walk = (entries: Entry[], dir: string) => {
  for (const entry of entries) {
    byId.set(entry.id, entry);
    paths.set(entry.id, dir + entry.name);
    if (entry.children) walk(entry.children, dir + entry.name + "/");
  }
};
walk(CHANGES, "");
const filesOf = (entry: Entry): Entry[] => (entry.children ? entry.children.flatMap(filesOf) : [entry]);
const ALL = CHANGES.flatMap(filesOf);
const sum = (files: Entry[], field: "added" | "removed" | "comments") => files.reduce((n, f) => n + (f[field] ?? 0), 0);

// Five-block diffstat: green for added, red for removed, grey for the rest.
const block = (i: number, added: number, removed: number) => {
  const total = added + removed;
  const green = total === 0 ? 0 : Math.round((added / total) * 5);
  const red = total === 0 ? 0 : Math.min(5 - green, Math.round((removed / total) * 5));
  return `size-2 rounded-[2px] ${i < green ? "bg-success" : i < green + red ? "bg-danger" : "bg-default"}`;
};

function ReviewRow(props: { entry: Entry; viewed: () => ReadonlySet<string> }) {
  const entry = props.entry;
  const files = filesOf(entry);
  const comments = sum(files, "comments");
  const done = () => files.every((f) => props.viewed().has(f.id));
  const icon = entry.change
    ? () => <Icon icon={CHANGE[entry.change!].icon} size={16} class={CHANGE[entry.change!].text} />
    : (v: TreeItemContentRenderProps) => <Icon icon={v.isExpanded() ? FolderOpen : Folder} size={16} class="text-muted" />;
  return (
    <FileTree.Item
      id={entry.id}
      textValue={entry.name}
      icon={icon}
      // A function title renders with the row, so a resumed page adopts its server nodes (an eager JSX title works too, but
      // is built while the tree collects its items and re-created when the tree wakes).
      title={() => (
        <span class="flex w-full min-w-0 items-center gap-2">
          <span class={`truncate ${entry.change === "deleted" ? "line-through" : ""} ${done() ? "text-muted" : ""}`}>{entry.name}</span>
          <span class="ml-auto flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
            {comments > 0 ? (
              <Chip size="sm" variant="soft" color="accent">
                <Icon icon={MessageSquare} size={12} />
                <Chip.Label>
                  {comments}
                  <span class="sr-only">{comments === 1 ? " comment" : " comments"}</span>
                </Chip.Label>
              </Chip>
            ) : null}
            {entry.change ? (
              <>
                <span class="text-success">+{entry.added}</span>
                <span class="text-danger">−{entry.removed}</span>
                <Chip size="sm" variant="soft" color={CHANGE[entry.change].color}>
                  <Chip.Label>
                    <span aria-hidden="true">{CHANGE[entry.change].letter}</span>
                    <span class="sr-only">{CHANGE[entry.change].label}</span>
                  </Chip.Label>
                </Chip>
              </>
            ) : null}
            {done() ? (
              <span class="grid text-success" data-viewed="true">
                <Icon icon={CircleCheck} size={14} />
                <span class="sr-only">Viewed</span>
              </span>
            ) : null}
          </span>
        </span>
      )}
    >
      <Collection items={entry.children}>{(child: Entry) => <ReviewRow entry={child} viewed={props.viewed} />}</Collection>
    </FileTree.Item>
  );
}

export function PrFileReview() {
  const selected = signal<Selection>(new Set(["prompt-input"]));
  const viewed = signal<ReadonlySet<string>>(new Set(["readme"]));
  const current = () => {
    const keys = selected();
    const key = keys === "all" ? undefined : [...keys][0];
    return byId.get(String(key)) ?? ALL[0]!;
  };
  const currentFiles = () => filesOf(current());
  const plus = () => sum(currentFiles(), "added");
  const minus = () => sum(currentFiles(), "removed");
  const notes = () => sum(currentFiles(), "comments");
  const viewedCount = () => ALL.filter((f) => viewed().has(f.id)).length;
  const allViewed = () => currentFiles().every((f) => viewed().has(f.id));
  const someViewed = () => !allViewed() && currentFiles().some((f) => viewed().has(f.id));
  const setViewed = (on: boolean) => {
    const next = new Set(viewed());
    for (const f of currentFiles()) {
      if (on) next.add(f.id);
      else next.delete(f.id);
    }
    viewed.set(next);
  };
  return (
    <Card id="ft-review" class="w-full max-w-3xl gap-0 p-0">
      <Card.Header class="flex-row flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <Card.Title class="text-sm">Files changed</Card.Title>
        <Chip size="sm">{ALL.length}</Chip>
        <span class="text-xs tabular-nums">
          <span class="text-success">+{sum(ALL, "added")}</span> <span class="text-danger">−{sum(ALL, "removed")}</span>
        </span>
        <span id="ft-review-progress" class="ml-auto text-xs text-muted tabular-nums">
          {viewedCount()} of {ALL.length} viewed
        </span>
      </Card.Header>
      <Card.Content class="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div class="border-b border-border p-2 sm:border-r sm:border-b-0 [&_[data-slot=file-tree-title]]:flex-1">
          <FileTree
            aria-label="Changed files"
            size="sm"
            items={CHANGES}
            defaultExpandedKeys={["src", "components", "tests"]}
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={selected}
          >
            {(entry: Entry) => <ReviewRow entry={entry} viewed={viewed} />}
          </FileTree>
        </div>
        <section id="ft-review-detail" class="flex min-w-0 flex-col gap-3 p-4" aria-label="Selected file">
          <div class="flex min-w-0 flex-col gap-1">
            <h4 id="ft-review-path" class="m-0 truncate font-mono text-sm font-medium">
              {paths.get(current().id)}
            </h4>
            {current().change ? (
              <span class="flex items-center gap-2 text-xs text-muted">
                <Status size="sm" color={CHANGE[current().change!].color} />
                <span id="ft-review-change">
                  {CHANGE[current().change!].label}
                  {current().from ? ` from ${current().from}` : ""}
                </span>
              </span>
            ) : (
              <span id="ft-review-change" class="text-xs text-muted">
                Folder, {currentFiles().length} changed files
              </span>
            )}
          </div>
          <div class="flex items-center gap-3 text-sm tabular-nums">
            <span id="ft-review-stat">
              <span class="text-success">+{plus()}</span> <span class="text-danger">−{minus()}</span>
            </span>
            <span class="flex gap-0.5" aria-hidden="true">
              <span class={block(0, plus(), minus())} />
              <span class={block(1, plus(), minus())} />
              <span class={block(2, plus(), minus())} />
              <span class={block(3, plus(), minus())} />
              <span class={block(4, plus(), minus())} />
            </span>
            <span class="ml-auto flex items-center gap-1 text-xs text-muted">
              <Icon icon={MessageSquare} size={14} />
              {notes()} {notes() === 1 ? "comment" : "comments"}
            </span>
          </div>
          <Checkbox label="Viewed" isSelected={allViewed} isIndeterminate={someViewed} onChange={setViewed} />
        </section>
      </Card.Content>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <PrFileReview />
    </div>
  );
}
