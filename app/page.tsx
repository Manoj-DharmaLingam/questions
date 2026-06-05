import RedditShell from "./shell";
import { getQuestionsPage } from "@/lib/questions";
import { getLatestPoll } from "@/lib/polls";

// Render on every request (don't cache/prerender) so new questions show up.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

// Server component — runs only on the server, awaits the data, renders to HTML.
export default async function Page() {
  const [{ questions, hasMore }, poll] = await Promise.all([
    getQuestionsPage(0, PAGE_SIZE),
    getLatestPoll(),
  ]);

  return (
    <RedditShell
      initialQuestions={questions}
      initialHasMore={hasMore}
      initialPoll={poll}
    />
  );
}
