// Client-side routing for links and link items. The implementation lives in `../utils/links.tsx`
// (`@rivetjs/cdk/links`, ported from react-aria utils/openLink.tsx); this module only re-exports it so
// `@rivetjs/cdk/link` and `@rivetjs/cdk/links` share ONE `RouterContext` / `RouterProvider` / `openLink`
// and one `linkState.isOpening` flag (read by usePress and focus-visible).
export {
  createRouter,
  getSyntheticLinkProps,
  handleLinkClick,
  isOpeningLink,
  linkState,
  openLink,
  openSyntheticLink,
  routerHref,
  routerOpen,
  RouterContext,
  RouterProvider,
  shouldClientNavigate,
  syntheticLinkAttrs,
  useLinkProps,
  useRouter,
  useSyntheticLinkProps,
  type Href,
  type LinkDOMProps,
  type Modifiers,
  type Router,
  type RouterOptions,
  type RouterProviderProps,
} from "../utils/links.tsx";
