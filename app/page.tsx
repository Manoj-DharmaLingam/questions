import QuestionsList from "./questions-list";
import PollCard from "./poll-card";
import ThemeToggle from "./theme-toggle";
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
    <main className="min-h-screen bg-[var(--reddit-bg)] text-[var(--reddit-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--reddit-border)] bg-[var(--reddit-card)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--reddit-orange)] text-lg font-black text-white">
              r
            </span>
            <span className="hidden text-xl font-bold tracking-tight text-[var(--reddit-text)] sm:block">
              reddit
            </span>
          </div>
          <div className="flex min-w-0 flex-1 items-center rounded-full border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-4 py-2 text-sm text-[var(--reddit-muted)]">
            Search r/kealvi
          </div>
          <button className="hidden rounded-full border border-[var(--reddit-blue)] px-4 py-1.5 text-sm font-bold text-[var(--reddit-blue)] hover:bg-[var(--reddit-blue)] hover:text-white sm:inline-flex">
            Log In
          </button>
          <button className="rounded-full bg-[var(--reddit-orange)] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90">
            Create
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <nav className="sticky top-[4.5rem] space-y-2 rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-3">
            {["Home", "Popular", "Explore", "All"].map((item, index) => (
              <button
                key={item}
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                  index === 0
                    ? "bg-[var(--reddit-card-muted)] text-[var(--reddit-orange)]"
                    : "text-[var(--reddit-text)] hover:bg-[var(--reddit-card-muted)]"
                }`}
              >
                {item}
              </button>
            ))}
            <div className="border-t border-[var(--reddit-border-soft)] pt-2">
              <p className="px-3 py-2 text-xs font-bold uppercase text-[var(--reddit-muted)]">
                Communities
              </p>
              {["r/kealvi", "r/nextjs", "r/supabase", "r/webdev"].map((item) => (
                <button
                  key={item}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--reddit-text)] hover:bg-[var(--reddit-card-muted)]"
                >
                  {item}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <QuestionsList initialQuestions={questions} initialHasMore={hasMore} />

        <aside className="space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start">
          <section className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)]">
            <div className="rounded-t-md bg-[var(--reddit-orange)] px-4 py-3 text-sm font-bold text-white">
              About r/kealvi
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p>
                A Reddit-style live Q&amp;A community for asking, voting, polling,
                saving, sharing, hiding, and discussing posts.
              </p>
              <div className="grid grid-cols-2 gap-3 border-y border-[var(--reddit-border-soft)] py-3">
                <div>
                  <p className="font-bold">{questions.length}</p>
                  <p className="text-xs text-[var(--reddit-muted)]">posts loaded</p>
                </div>
                <div>
                  <p className="font-bold">Online</p>
                  <p className="text-xs text-[var(--reddit-muted)]">community</p>
                </div>
              </div>
              <button className="w-full rounded-full bg-[var(--reddit-blue)] px-4 py-2 font-bold text-white hover:opacity-90">
                Join
              </button>
            </div>
          </section>

          <PollCard initialPoll={poll} />

          <section className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-4">
            <h2 className="mb-3 text-sm font-bold">Trending topics</h2>
            {["Server Components", "Supabase RLS", "Optimistic UI", "Database indexing"].map(
              (topic, index) => (
                <div
                  key={topic}
                  className="border-t border-[var(--reddit-border-soft)] py-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-xs text-[var(--reddit-muted)]">
                    #{index + 1} in r/kealvi
                  </p>
                  <p className="font-medium">{topic}</p>
                </div>
              )
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
