import { component$ } from '@qwik.dev/core';
import { App, type Item } from './app';

export const Root = component$<{ items: Item[] }>((props) => {
  return (
    <>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>resume-bench qwik</title>
      </head>
      <body>
        <App items={props.items} />
      </body>
    </>
  );
});
