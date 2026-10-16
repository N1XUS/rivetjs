import { renderToString, type RenderToStringOptions } from '@builder.io/qwik/server';
import { items } from '../../../data.ts';
import { Root } from './root';

/** Renders the full document. Server data enters the app as props, so Qwik serializes it. */
export default function render(opts: RenderToStringOptions) {
  return renderToString(<Root items={items} />, {
    ...opts,
    containerAttributes: { lang: 'en', ...opts.containerAttributes },
  });
}
