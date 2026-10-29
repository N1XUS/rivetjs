// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no citations). Feature set inspired by commercial UI kits' public
// ChatSource docs (citation pill for a URL or document: `href`, `title` (default: the domain), `description` (shown in the
// hover preview), `enablePreview`, `faviconUrl`, `sourceType` (inferred); parts `Trigger` / `Icon` / `Title` /
// `Preview`; `ChatSources` = a disclosure grouping citations: `Trigger` / `Content` / `List`); independent
// implementation, Rivet-authored styles.
// - Preview = ui `Tooltip` (cdk TooltipTrigger: hover / focus, delay) instead of a hover card; the pill is the tooltip
//   trigger through cdk `focusableProps` (an `<a>` for URL sources, a focusable `<span>` for documents).
// - Root context = plain data (`rv-ui-chat-source`: href / title / domain / description / favicon / type): no functions.
// - Rivet extra `ChatSources.Favicons` (`sources`, `max` 3): the stacked favicon avatars of the "Stacked Favicons" demo.
import { mergeProps } from "@rivetjs/cdk/interactions/merge-props";
import { focusableProps } from "@rivetjs/cdk/focusable";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { FileText } from "lucide";

import { chatSourceVariants } from "../../../styles/src/components/chat-source/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { DisclosureBody, DisclosureContent, DisclosureHeading, DisclosureIndicator, DisclosureRoot, DisclosureTrigger } from "../disclosure/disclosure.tsx";
import type { DisclosureRootProps } from "../disclosure/disclosure.tsx";
import { TooltipContent, TooltipRoot } from "../tooltip/tooltip.tsx";

const SLOTS = chatSourceVariants();

type ChatSourceType = "url" | "document";

interface ChatSourceContext {
  href?: string;
  title?: string;
  domain?: string;
  description?: string;
  faviconUrl?: string;
  sourceType?: ChatSourceType;
}

const ChatSourceContext = createContext<ChatSourceContext>({});

/** Host of `href` without `www.` (`undefined` for relative / invalid URLs). */
const domainOf = (href: string | undefined): string | undefined => {
  if (!href) return undefined;
  try {
    return new URL(href).hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
};

/* -------------------------------------------------------------------------------------------------
 * ChatSource
 * -----------------------------------------------------------------------------------------------*/
interface ChatSourceRootProps {
  /** URL of the source. */
  href?: string;
  /** Display title. @default the domain of `href` */
  title?: string;
  /** Preview text; enables the hover preview. */
  description?: string;
  /** Force the preview on (custom `Preview`) or off. @default preset: on for URL sources and for sources with a `description`; composable: off */
  enablePreview?: boolean;
  /** Favicon image shown in the pill and the preview. */
  faviconUrl?: string;
  /** @default "url" with an `href`, "document" otherwise */
  sourceType?: ChatSourceType;
  /** Custom composition (`ChatSource.Trigger` / `Icon` / `Title` / `Preview`); default: pill + preview. */
  children?: Content;
  class?: string;
}

const ChatSourceRoot = (props: ChatSourceRootProps): JSX.Element => {
  const [local] = splitLive(props, ["href", "title", "description", "enablePreview", "faviconUrl", "sourceType", "children", "class"]);
  const href = local.href;
  const domain = domainOf(href);
  const context: ChatSourceContext = {
    href,
    title: local.title,
    domain,
    description: local.description,
    faviconUrl: local.faviconUrl,
    sourceType: local.sourceType ?? (href ? "url" : "document"),
  };
  const children = local.children;
  // Preset: every URL source previews (site + title / URL); a document only with a description (otherwise it would repeat the pill).
  const preview = local.enablePreview ?? (children == null ? !!local.description || context.sourceType === "url" : false);
  const cls = composeSlotClassName(SLOTS.base, local.class);
  // Functions: Rivet JSX builds nodes eagerly, the parts must be created inside the providers.
  const inner = () =>
    children != null ? (
      children
    ) : (
      <>
        <ChatSourceTrigger />
        {preview ? <ChatSourcePreview /> : null}
      </>
    );
  const body = () => (
    <span class={cls} data-slot="chat-source" data-source-type={context.sourceType}>
      {preview ? <TooltipRoot delay={300}>{inner()}</TooltipRoot> : inner()}
    </span>
  );
  return (
    <Provider token={ChatSourceContext} value={context}>
      {body()}
    </Provider>
  );
};

interface ChatSourceTriggerProps extends Omit<JSX.IntrinsicElements["a"], "class" | "children"> {
  /** Pill content. @default `Icon` + `Title` */
  children?: Content;
  class?: string;
}

const ChatSourceTrigger = (props: ChatSourceTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const context = useContext(ChatSourceContext);
  const focusable = focusableProps({});
  const merged = mergeProps(focusable, rest as Record<string, unknown>);
  const content = () =>
    local.children ?? (
      <>
        <ChatSourceIcon />
        <ChatSourceTitle />
      </>
    );
  const label = context.title ?? context.domain;
  if (context.href)
    return (
      <span class={SLOTS.trigger()} data-slot="chat-source-trigger">
        <a
          class={composeSlotClassName(SLOTS.triggerLink, local.class)}
          href={context.href}
          target="_blank"
          rel="noopener noreferrer"
          data-slot="chat-source-trigger-link"
          {...(merged as JSX.IntrinsicElements["a"])}
          ref={merged.ref as never}
        >
          {content()}
        </a>
      </span>
    );
  return (
    <span class={SLOTS.trigger()} data-slot="chat-source-trigger">
      <span
        class={composeSlotClassName(SLOTS.triggerLink, local.class)}
        tabIndex={0}
        aria-label={label}
        data-slot="chat-source-trigger-link"
        {...(merged as JSX.IntrinsicElements["span"])}
        ref={merged.ref as never}
      >
        {content()}
      </span>
    </span>
  );
};

interface ChatSourceIconProps {
  /** Favicon URL. @default the root `faviconUrl` */
  faviconUrl?: string;
  /** Custom icon element. */
  children?: Content;
  class?: string;
}

const ChatSourceIcon = (props: ChatSourceIconProps): JSX.Element => {
  const [local] = splitLive(props, ["faviconUrl", "children", "class"]);
  const context = useContext(ChatSourceContext);
  const favicon = local.faviconUrl ?? context.faviconUrl;
  if (local.children != null)
    return (
      <span class={composeSlotClassName(SLOTS.icon, local.class)} aria-hidden="true" data-slot="chat-source-icon">
        {local.children}
      </span>
    );
  if (favicon)
    return (
      <img class={composeSlotClassName(SLOTS.icon, local.class)} src={favicon} alt="" width={16} height={16} loading="lazy" data-slot="chat-source-icon" />
    );
  if (context.sourceType === "document")
    return <Icon icon={FileText} size={14} class={composeSlotClassName(SLOTS.documentIcon, local.class)} aria-hidden="true" />;
  const initial = (context.title ?? context.domain ?? "?").charAt(0).toUpperCase();
  return (
    <span class={composeSlotClassName(SLOTS.iconFallback, local.class)} aria-hidden="true" data-slot="chat-source-icon">
      {initial}
    </span>
  );
};

interface ChatSourceTitleProps {
  children?: Content;
  class?: string;
}

const ChatSourceTitle = (props: ChatSourceTitleProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  const context = useContext(ChatSourceContext);
  return (
    <span class={composeSlotClassName(SLOTS.title, local.class)} data-slot="chat-source-title">
      {local.children ?? context.title ?? context.domain ?? context.href}
    </span>
  );
};

interface ChatSourcePreviewProps {
  /** Custom preview content. @default favicon + domain, title (else the URL), description */
  children?: Content;
  class?: string;
}

const ChatSourcePreview = (props: ChatSourcePreviewProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  const context = useContext(ChatSourceContext);
  const content = () =>
    local.children ?? (
      <>
        <span class={SLOTS.previewSite()}>
          <ChatSourceIcon />
          <span class={SLOTS.previewDomain()}>{context.domain ?? (context.sourceType === "document" ? "Document" : context.href)}</span>
        </span>
        {context.title || context.href ? <span class={SLOTS.previewTitle()}>{context.title ?? context.href}</span> : null}
        {context.description ? <span class={SLOTS.previewDescription()}>{context.description}</span> : null}
      </>
    );
  return (
    <TooltipContent class={composeSlotClassName(SLOTS.preview, local.class)} placement="top" data-slot="chat-source-preview">
      {content()}
    </TooltipContent>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ChatSources
 * -----------------------------------------------------------------------------------------------*/
interface ChatSourcesRootProps extends Omit<DisclosureRootProps, "class"> {
  class?: string;
}

const ChatSourcesRoot = (props: ChatSourcesRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <DisclosureRoot class={composeSlotClassName(SLOTS.group, local.class)} data-chat-sources="" {...rest}>
      {local.children}
    </DisclosureRoot>
  );
};

interface ChatSourcesTriggerProps {
  /** Trigger label ("3 sources", `ChatSources.Favicons` …). */
  children?: Content;
  /** Heading level of the trigger wrapper. @default 3 */
  level?: number;
  class?: string;
}

const ChatSourcesTrigger = (props: ChatSourcesTriggerProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children", "level"]);
  return (
    <DisclosureHeading class={SLOTS.groupHeading()} level={local.level ?? 3}>
      <DisclosureTrigger class={composeSlotClassName(SLOTS.groupTrigger, local.class)} data-slot="chat-sources-trigger">
        {local.children}
        <DisclosureIndicator class={SLOTS.groupIndicator()} />
      </DisclosureTrigger>
    </DisclosureHeading>
  );
};

interface ChatSourcesContentProps {
  children?: Content;
  class?: string;
}

const ChatSourcesContent = (props: ChatSourcesContentProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children"]);
  return (
    <DisclosureContent class={SLOTS.groupContent()} data-slot="chat-sources-content">
      <DisclosureBody class={composeSlotClassName(SLOTS.groupBody, local.class)}>{local.children}</DisclosureBody>
    </DisclosureContent>
  );
};

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

const ChatSourcesList = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.list, local.class)} data-slot="chat-sources-list" {...rest}>
      {local.children}
    </div>
  );
};

interface ChatSourcesFaviconsProps {
  /** Sources to stack (`faviconUrl` image, else the domain initial). */
  sources: readonly { href?: string; title?: string; faviconUrl?: string }[];
  /** Avatars shown. @default 3 */
  max?: number;
  class?: string;
}

const ChatSourcesFavicons = (props: ChatSourcesFaviconsProps): JSX.Element => {
  const [local] = splitLive(props, ["sources", "max", "class"]);
  const shown = local.sources.slice(0, local.max ?? 3);
  return (
    <span class={composeSlotClassName(SLOTS.favicons, local.class)} aria-hidden="true" data-slot="chat-sources-favicons">
      {shown.map((source) =>
        source.faviconUrl ? (
          <img class={SLOTS.favicon()} src={source.faviconUrl} alt="" width={16} height={16} loading="lazy" />
        ) : (
          <span class={`${SLOTS.favicon()} ${SLOTS.iconFallback()}`}>{(source.title ?? domainOf(source.href) ?? "?").charAt(0).toUpperCase()}</span>
        ),
      )}
    </span>
  );
};

export {
  ChatSourceRoot,
  ChatSourceTrigger,
  ChatSourceIcon,
  ChatSourceTitle,
  ChatSourcePreview,
  ChatSourcesRoot,
  ChatSourcesTrigger,
  ChatSourcesContent,
  ChatSourcesList,
  ChatSourcesFavicons,
};
export type {
  ChatSourceType,
  ChatSourceRootProps,
  ChatSourceTriggerProps,
  ChatSourceIconProps,
  ChatSourceTitleProps,
  ChatSourcePreviewProps,
  ChatSourcesRootProps,
  ChatSourcesTriggerProps,
  ChatSourcesContentProps,
  DivProps as ChatSourcesListProps,
  ChatSourcesFaviconsProps,
};
