import { component$ } from '@builder.io/qwik';
import { App, type Item } from './app';

export const Root = component$<{ items: Item[] }>((props) => {
  return (
    <>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>resume-bench qwik-stable</title>
      </head>
      <body>
        <App items={props.items} />
      </body>
    </>
  );
});
