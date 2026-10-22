import { signal } from "@rivetjs/reactivity";
import { load, type PageProps, type RequestEvent } from "@rivetjs/router";

interface SurveyViewModel {
  title: string;
  questions: { id: string; text: string }[];
}

export const loader = load(({ locals }: RequestEvent) => locals.viewModel as SurveyViewModel);

export default function Survey({ data }: PageProps<typeof loader>) {
  const answered = signal(0);
  return (
    <main>
      <h1>{data.title}</h1>
      <ol>
        {data.questions.map((question) => (
          <li>{question.text}</li>
        ))}
      </ol>
      <button id="answer" onClick={() => answered.update((n) => n + 1)}>
        Answered {answered()}
      </button>
    </main>
  );
}
