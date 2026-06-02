import QuestionsList from "./questions-list";
import PollCard from "./poll-card";
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
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-medium">Live Q&amp;A</h1>
      <PollCard initialPoll={poll} />
      <QuestionsList initialQuestions={questions} initialHasMore={hasMore} />
    </main>
  );
}
