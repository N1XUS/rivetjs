---
title: AI chat
description: "An assistant chat built on the AI components: conversation list, tool calls, sources, streamed Markdown answers, feedback, suggestions, attachments."
template: guide
status: experimental
related: [components/sidebar, components/chat-conversation, components/chat-message, components/prompt-input, components/markdown, components/chat-tool, components/chat-list-view, components/status]
---

A shop assistant that answers from an invented shop's numbers. The answers are canned (picked by a keyword) and streamed from a local timer; no model is called, so the page works offline.

::example{id=showcase-chat}

- The thread is a [ChatConversation](/components/chat-conversation/): a `role="log"` scroller that starts at the newest turn and stays pinned while an answer grows (CSS, no scroll script), with a scroll-to-bottom button once you scroll up. Turns are a keyed `For` of [ChatMessage](/components/chat-message/) user bubbles and assistant turns; the reply joins the list at submit and is finished in place.
- An answer runs a [ChatTool](/components/chat-tool/) card (spinning while the answer is pending, then completed, with its input and result as JSON), shows a shimmering [TextShimmer](/components/text-shimmer/) line until the first word, then streams [Markdown](/components/markdown/) (bold, lists, quotes) with a caret. Document [ChatSource](/components/chat-source/) pills name where the numbers came from (hover for the detail).
- [ChatMessageActions](/components/chat-message-actions/) copy an answer and rate it with thumbs up / down (`aria-pressed`); they stay hidden while the turn streams and fade in when it ends.
- The composer is a [PromptInput](/components/prompt-input/): Enter sends, Shift+Enter adds a line, Send turns into Stop while an answer runs. Files picked with the paperclip (or dropped on the composer) show as [ChatAttachment](/components/chat-attachment/) chips and travel with the question. [PromptSuggestion](/components/prompt-suggestion/) pills send a prepared question.
- The conversation history is a [ChatListView](/components/chat-list-view/) grouped by day, in a resizable [Sidebar](/components/sidebar/#resizable) contained in the chat card (`contained`): drag its edge (or focus the handle and use the arrow keys) to resize it, drag it narrow to hide it, double-click to reset; the toggle in the chat header opens and closes it. Below 768 px it opens as a sheet and the chat takes the whole width.
- The header's Online [Chip](/components/chip/) leads with a pulsing [Status](/components/status/) dot (decorative: the chip text says it).
