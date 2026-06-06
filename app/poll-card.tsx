"use client";
import { useState, useSyncExternalStore } from "react";
import type { Poll } from "@/lib/polls";
import {
  clearPollVote,
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
  const [creating, setCreating] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [optionDrafts, setOptionDrafts] = useState(["", ""]);
  const [submittingPoll, setSubmittingPoll] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const votedOptionId = selectedOptionId ?? savedOptionId;
  const showResults = Boolean(votedOptionId);
  const cleanOptions = optionDrafts
    .map((option) => option.trim())
    .filter(Boolean);
  const canSubmitPoll = questionDraft.trim().length > 0 && cleanOptions.length >= 2;

  function updateOptionDraft(index: number, value: string) {
    setOptionDrafts((options) =>
      options.map((option, optionIndex) =>
        optionIndex === index ? value : option
      )
    );
  }

  function addOptionDraft() {
    if (optionDrafts.length >= 10) return;
    setOptionDrafts((options) => [...options, ""]);
  }

  function removeOptionDraft(index: number) {
    if (optionDrafts.length <= 2) return;
    setOptionDrafts((options) =>
      options.filter((_, optionIndex) => optionIndex !== index)
    );
  }

  function resetPollForm() {
    setQuestionDraft("");
    setOptionDrafts(["", ""]);
  }

  async function createPoll() {
    if (!canSubmitPoll || submittingPoll) return;

    setError(null);
    setSubmittingPoll(true);

    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionDraft,
          options: cleanOptions,
        }),
      });
      const data = await res.json();

      if (res.ok && data.poll) {
        setPoll(data.poll);
        setSelectedOptionId(null);
        resetPollForm();
        setCreating(false);
        window.dispatchEvent(new Event("poll-vote"));
        return;
      }

      setError(data.error ?? "Could not create the poll.");
    } catch {
      setError("Could not create the poll. Please try again.");
    } finally {
      setSubmittingPoll(false);
    }
  }

  function applyOptimisticVote(
    basePoll: Poll,
    previousOptionId: string | null,
    nextOptionId: string | null
  ) {
    const totalDelta = previousOptionId
      ? nextOptionId
        ? 0
        : -1
      : nextOptionId
        ? 1
        : 0;

    return {
      ...basePoll,
      totalVotes: Math.max(0, basePoll.totalVotes + totalDelta),
      options: basePoll.options.map((option) => {
        const delta =
          (option.id === previousOptionId ? -1 : 0) +
          (option.id === nextOptionId ? 1 : 0);

        return delta === 0
          ? option
          : { ...option, votes: Math.max(0, option.votes + delta) };
      }),
    };
  }

  async function vote(optionId: string) {
    if (!poll || pendingOptionId || deleting) return;

    const previousOptionId = votedOptionId || null;
    const nextOptionId = previousOptionId === optionId ? null : optionId;
    const previousPoll = poll;

    setError(null);
    setPendingOptionId(optionId);
    setSelectedOptionId(nextOptionId);
    setPoll(applyOptimisticVote(poll, previousOptionId, nextOptionId));

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: nextOptionId ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextOptionId
            ? { optionId: nextOptionId, voterId: getVoterId() }
            : { voterId: getVoterId() }
        ),
      });
      const data = await res.json();

      if (data.poll) setPoll(data.poll);

      if (res.ok) {
        if (data.selectedOptionId) {
          markPollVoted(poll.id, data.selectedOptionId);
        } else {
          clearPollVote(poll.id);
        }

        window.dispatchEvent(new Event("poll-vote"));
        return;
      }

      setSelectedOptionId(previousOptionId);
      setPoll(previousPoll);
      setError(data.error ?? "Could not update your poll vote.");
    } catch {
      setSelectedOptionId(previousOptionId);
      setPoll(previousPoll);
      setError("Could not update your poll vote. Please try again.");
    } finally {
      setPendingOptionId(null);
    }
  }

  async function deletePoll() {
    if (!poll || deleting) return;
    if (!window.confirm("Delete this poll?")) return;

    const previousPoll = poll;

    setError(null);
    setDeleting(true);
    setPoll(null);

    try {
      const res = await fetch(`/api/polls/${previousPoll.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        clearPollVote(previousPoll.id);
        setSelectedOptionId(null);
        window.dispatchEvent(new Event("poll-vote"));
        return;
      }

      setPoll(previousPoll);
      setError(data.error ?? "Could not delete the poll.");
    } catch {
      setPoll(previousPoll);
      setError("Could not delete the poll. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (!poll || creating) {
    return (
      <section className="mb-6 rounded-lg border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-medium">Create poll</h2>
          {poll && (
            <button
              type="button"
              onClick={() => {
                resetPollForm();
                setCreating(false);
                setError(null);
              }}
              disabled={submittingPoll}
              className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card-muted)] px-3 py-1 text-sm font-medium text-[var(--reddit-text)] transition hover:border-[var(--reddit-hover)] disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="space-y-3">
          <input
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            placeholder="Poll question"
            className="w-full rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2 text-[var(--reddit-text)] outline-none placeholder:text-[var(--reddit-muted)] focus:border-[var(--reddit-blue)]"
          />

          <div className="space-y-2">
            {optionDrafts.map((option, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2"
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-[var(--reddit-muted)]"
                  aria-hidden="true"
                />
                <input
                  value={option}
                  onChange={(e) => updateOptionDraft(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="min-w-0 flex-1 bg-transparent text-[var(--reddit-text)] outline-none placeholder:text-[var(--reddit-muted)]"
                />
                {optionDrafts.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOptionDraft(index)}
                    disabled={submittingPoll}
                    aria-label={`Remove option ${index + 1}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--reddit-muted)] transition hover:bg-[var(--reddit-card)] hover:text-[var(--reddit-danger-text)] disabled:opacity-50"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addOptionDraft}
            disabled={optionDrafts.length >= 10 || submittingPoll}
            className="w-full rounded-md border border-dashed border-[var(--reddit-border)] bg-[var(--reddit-card)] px-3 py-2 text-left font-medium text-[var(--reddit-blue)] transition hover:border-[var(--reddit-blue)] disabled:opacity-50"
          >
            + Add option
          </button>

          <button
            type="button"
            onClick={createPoll}
            disabled={!canSubmitPoll || submittingPoll}
            className="w-full rounded-md border border-[var(--reddit-blue)] bg-[var(--reddit-blue)] px-4 py-2 font-medium text-white transition disabled:opacity-50"
          >
            {submittingPoll ? "Creating..." : "Create poll"}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-[var(--reddit-danger-text)]">{error}</p>
        )}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium">{poll.question}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            disabled={deleting || Boolean(pendingOptionId)}
            className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card-muted)] px-3 py-1 text-sm font-medium text-[var(--reddit-text)] transition hover:border-[var(--reddit-hover)] disabled:opacity-60"
          >
            New poll
          </button>
          <button
            type="button"
            onClick={deletePoll}
            disabled={deleting || Boolean(pendingOptionId)}
            className="rounded-md border border-[var(--reddit-danger-border)] bg-[var(--reddit-danger-bg)] px-3 py-1 text-sm font-medium text-[var(--reddit-danger-text)] transition hover:border-[var(--reddit-danger-text)] disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
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
              disabled={Boolean(pendingOptionId || deleting)}
              aria-pressed={selected}
              className={`relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-[var(--reddit-text)] transition hover:border-[var(--reddit-blue)] disabled:cursor-wait ${
                selected
                  ? "border-[var(--reddit-blue)] bg-[var(--reddit-card)]"
                  : "border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)]"
              }`}
            >
              {showResults && (
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--reddit-blue)] opacity-15 transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? "border-[var(--reddit-blue)]"
                        : "border-[var(--reddit-muted)]"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--reddit-blue)]" />
                    )}
                  </span>
                  <span className="min-w-0 break-words">{option.label}</span>
                </span>
                {showResults && (
                  <span className="shrink-0 font-mono text-sm text-[var(--reddit-muted)]">
                    {percent}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-[var(--reddit-muted)]">
        {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
      </p>
      {error && (
        <p className="mt-2 text-sm text-[var(--reddit-danger-text)]">{error}</p>
      )}
    </section>
  );
}
