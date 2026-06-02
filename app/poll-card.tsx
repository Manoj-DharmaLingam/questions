"use client";

import { useState, useSyncExternalStore } from "react";
import type { Poll } from "@/lib/polls";
import {
  getVotedPollOptionId,
  getVoterId,
  markPollVoted,
} from "@/lib/voter";

function subscribeToPollVoteChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("poll-vote", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("poll-vote", onStoreChange);
  };
}

export default function PollCard({ initialPoll }: { initialPoll: Poll | null }) {
  const [poll, setPoll] = useState(initialPoll);
  const savedOptionId = useSyncExternalStore(
    subscribeToPollVoteChanges,
    () => (poll ? getVotedPollOptionId(poll.id) ?? "" : ""),
    () => ""
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!poll) return null;

  const votedOptionId = selectedOptionId ?? savedOptionId;

  async function vote(optionId: string) {
    if (!poll || votedOptionId || pendingOptionId) return;

    setError(null);
    setPendingOptionId(optionId);
    setSelectedOptionId(optionId);
    setPoll({
      ...poll,
      totalVotes: poll.totalVotes + 1,
      options: poll.options.map((option) =>
        option.id === optionId ? { ...option, votes: option.votes + 1 } : option
      ),
    });

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, voterId: getVoterId() }),
      });
      const data = await res.json();

      if (data.poll) setPoll(data.poll);

      if (res.ok) {
        markPollVoted(poll.id, data.selectedOptionId ?? optionId);
        window.dispatchEvent(new Event("poll-vote"));
        return;
      }

      if (res.status === 409) {
        const savedOptionId = data.selectedOptionId ?? optionId;
        markPollVoted(poll.id, savedOptionId);
        window.dispatchEvent(new Event("poll-vote"));
        setSelectedOptionId(savedOptionId);
        setError("You already voted in this poll.");
        return;
      }

      setSelectedOptionId(null);
      setError(data.error ?? "Could not record your poll vote.");
    } catch {
      setSelectedOptionId(null);
      setPoll(poll);
      setError("Could not record your poll vote. Please try again.");
    } finally {
      setPendingOptionId(null);
    }
  }

  return (
    <section className="mb-6 rounded-lg border p-4">
      <h2 className="mb-3 text-lg font-medium">{poll.question}</h2>
      <div className="space-y-2">
        {poll.options.map((option) => {
          const percent =
            poll.totalVotes === 0
              ? 0
              : Math.round((option.votes / poll.totalVotes) * 100);
          const selected = votedOptionId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => vote(option.id)}
              disabled={Boolean(votedOptionId || pendingOptionId)}
              aria-pressed={selected}
              className="w-full rounded-md border px-3 py-2 text-left disabled:opacity-80"
            >
              <span className="flex items-center justify-between gap-3">
                <span>{option.label}</span>
                <span className="font-mono text-sm text-gray-500">
                  {percent}% ({option.votes})
                </span>
              </span>
              <span className="mt-2 block h-2 overflow-hidden rounded bg-gray-100">
                <span
                  className="block h-full rounded bg-gray-900"
                  style={{ width: `${percent}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
