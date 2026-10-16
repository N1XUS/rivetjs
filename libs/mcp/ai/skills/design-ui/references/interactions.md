# Interactions and complete states

## Action hierarchy

Give the user a clear next action. Within an action group, use one primary treatment, secondary alternatives, and tertiary dismissal. Independent regions may each have a primary action; do not make every toolbar control primary. Use verb/object labels such as "Save changes" or "Archive ticket" rather than ambiguous "OK".

Use links for navigation, buttons for actions, toggles for persistent state. Place actions near the content they affect and keep ordering consistent. Put low-frequency actions in a menu only if discoverability remains adequate. Give icon-only buttons an accessible label; a tooltip is supplemental. Use Lucide through `@rivetjs/kit/icon` rather than invented SVG or Unicode icons.

## Define states with the behavior

| State | User-visible behavior |
| --- | --- |
| Idle | Clear affordance and current value/selection |
| Hover/pressed/focus-visible | Consistent feedback; keyboard focus is distinct from hover |
| Pending | Describe what is happening, keep useful context, prevent accidental duplicate mutation |
| Success | Show the resulting state; close/clear only after acceptance; use transient confirmation if needed |
| Validation error | Explain the affected field and recovery near it; preserve entered values |
| Request error | Explain the failed operation and offer a meaningful retry; preserve draft/selection |
| Initial empty | Explain what belongs here and the next action to populate it |
| Filtered empty | Show that no results match; preserve filters and offer reset/clear |
| Disabled/unavailable | Communicate why when useful and provide a reachable alternative |

For loading, use a skeleton when the eventual structure is known, a spinner for a bounded wait, and progress for measurable work. Avoid replacing the entire workspace when only one region is refreshing. Maintain dimensions to prevent layout shifts and keep result announcements concise. For async search, ensure an older response cannot replace newer results.

For forms, decide when validation occurs and what happens after submit. Keep labels stable, required status visible and help/error associations connected. On errors, keep the form or overlay open; focus the first invalid control or a useful summary. An explicit-save form preserves drafts until accepted. Immediate-update preferences need pending/success/error feedback and rollback if rejected.

## Choose the right feedback surface

Use inline errors for fields and local operations, an Alert for persistent page/section information, and a Toast for short-lived outcomes. Do not put the only error explanation in a disappearing toast. Use an AlertDialog for high-consequence confirmation when undo is unavailable; offer undo for easily reversible operations when it fits. Make a destructive confirmation name the affected item and action.

## Keyboard, focus and dismissal

Retain the UI/CDK primitive's interaction model. Verify Tab order, arrow-key navigation where expected, Enter/Space activation, Escape dismissal, and visible focus. Do not add global shortcuts that conflict with typing, native browser actions or existing app shortcuts; shortcuts supplement visible controls.

For menus, dialogs, drawers and popovers, check initial focus, focus containment where modal, and restoration to the opening control. Define outside-press and Escape behavior, especially with unsaved work. Make sure a sticky header/footer does not cover the focused element. A clickable div with an `onClick` handler does not supply button semantics or keyboard behavior.

Accessible names should remain meaningful out of context. Status updates that are not focused may need a live announcement; do not announce every render or keystroke. Custom CDK styling must retain selected/focus/invalid indicators, not just idle visuals.

## Motion explains change

Use movement to show an opening surface, selection change, or structural transition. Prefer the kit's existing CSS transitions and reduced-motion support. Match easing/duration across related controls. Small feedback usually needs a short transition (roughly 100–200ms); larger panel transitions may need more time (roughly 200–300ms). These are starting design ranges, not overrides for every component.

Prefer opacity/transform for custom animation where suitable, avoid animating unrelated layout, and keep actions usable while feedback runs. Respect `prefers-reduced-motion`; use a component's `reduceMotion` option when available. Do not add motion merely to fill space or delay navigation for an animation. For custom element animation (entrances, hover / press states, exits, layout moves) use `@rivetjs/motion` (`<Motion.*>`, `Presence`, `animateLayout`): entrances stay CSS from the server and reduced motion is handled; keep drag / flick physics on the cdk's own motion.

## Verify realistic sequences

Try open → edit → submit → pending → error → retry → success; select → filter → no matches → clear; resize → collapse → restore; and queue → detail → back on mobile. Include keyboard-only use and touch-sized controls. Verify behavior on an actual SSR/resumed page, not only a client-rendered story: deferred overlay content, preserved drafts and first interaction are part of the experience.
