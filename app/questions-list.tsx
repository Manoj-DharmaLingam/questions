"use client";
import { useState, useEffect, useSyncExternalStore } from "react";
import {
  getVotedQuestionIds,
  getVoterId,
  markQuestionVoted,
} from "@/lib/voter";

type Question = {
  id: string;
  body: string;
  author: string | null;
  votes: number;
};

function getQuestionVoteSnapshot() {
  return getVotedQuestionIds().join("\n");
}

function subscribeToQuestionVoteChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("question-vote", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("question-vote", onStoreChange);
  };
}

export default function QuestionsList({
  initialQuestions,
  initialHasMore,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const savedVotedQuestionIds = useSyncExternalStore(
    subscribeToQuestionVoteChanges,
    getQuestionVoteSnapshot,
    () => ""
  );
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(
    () => new Set()
  );
  const [voteError, setVoteError] = useState<string | null>(null);

  const votedQuestionIds = new Set([
    ...(savedVotedQuestionIds ? savedVotedQuestionIds.split("\n") : []),
    ...selectedQuestionIds,
  ]);

  // Debounced search: wait 300ms after typing stops; each keystroke cancels
  // the previous timer, so "deploying" fires one request, not nine.
  useEffect(() => {
    const id = setTimeout(async () => {
      const url = query
        ? `/api/questions?q=${encodeURIComponent(query)}`
        : `/api/questions`;
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data.questions);
      setHasMore(data.hasMore);
    }, 300);

    return () => clearTimeout(id); // cancel the pending timer on each keystroke
  }, [query]);

  async function submit() {
    if (!draft.trim()) return;

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    const created = await res.json();

    setQuestions((qs) => [{ ...created, votes: 0 }, ...qs]);
    setDraft("");
  }

  async function upvote(id: string) {
    if (votedQuestionIds.has(id) || pendingVoteIds.has(id)) return;

    setVoteError(null);
    setPendingVoteIds((ids) => new Set(ids).add(id));

    // optimistic: assume success, update the UI now
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, votes: q.votes + 1 } : q))
    );

    try {
      const res = await fetch(`/api/questions/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: getVoterId() }),
      });
      const data = await res.json();

      if (res.ok) {
        setQuestions((qs) =>
          qs.map((q) =>
            q.id === id && typeof data.votes === "number"
              ? { ...q, votes: data.votes }
              : q
          )
        );
        markQuestionVoted(id);
        window.dispatchEvent(new Event("question-vote"));
        setSelectedQuestionIds((ids) => new Set(ids).add(id));
        return;
      }

      setQuestions((qs) =>
        qs.map((q) =>
          q.id === id
            ? { ...q, votes: typeof data.votes === "number" ? data.votes : q.votes - 1 }
            : q
        )
      );

      if (res.status === 409) {
        markQuestionVoted(id);
        window.dispatchEvent(new Event("question-vote"));
        setSelectedQuestionIds((ids) => new Set(ids).add(id));
      }

      setVoteError(data.error ?? "Could not record your vote.");
    } catch {
      setQuestions((qs) =>
        qs.map((q) => (q.id === id ? { ...q, votes: q.votes - 1 } : q))
      );
      setVoteError("Could not record your vote. Please try again.");
    } finally {
      setPendingVoteIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }

  async function loadMore() {
    setLoading(true);
    const res = await fetch(`/api/questions?offset=${questions.length}`);
    const data = await res.json();
    setQuestions((qs) => [...qs, ...data.questions]);
    setHasMore(data.hasMore);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Interactive ✓
      </p>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button onClick={submit} className="rounded-md border px-4 py-2">
          Ask
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search questions…"
        className="w-full rounded-md border px-3 py-2"
      />

      {voteError && <p className="text-sm text-red-600">{voteError}</p>}

      <ul className="space-y-3">
        {questions.map((q) => {
          const voted = votedQuestionIds.has(q.id);
          const voting = pendingVoteIds.has(q.id);

          return (
            <li
              key={q.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <button
                onClick={() => upvote(q.id)}
                disabled={voted || voting}
                aria-pressed={voted}
                aria-label={
                  voted
                    ? `Already voted for question with ${q.votes} votes`
                    : `Vote for question with ${q.votes} votes`
                }
                title={voted ? "You voted for this question" : "Vote"}
                className="rounded-md border px-3 py-1 font-mono disabled:opacity-50"
              >
                ▲ {q.votes}
              </button>
              <span>{q.body}</span>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="rounded-md border px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
