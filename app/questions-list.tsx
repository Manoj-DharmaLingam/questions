"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
  createdAt?: string | null;
};

type User = {
  username: string;
  email: string;
};

type FeedSort = "hot" | "new" | "top";
type FeedView = "Home" | "Popular" | "Explore" | "All" | "Saved" | "Hidden";

const COMMENTS_KEY = "kealvi_comments";
const SAVED_KEY = "kealvi_saved_posts";
const HIDDEN_KEY = "kealvi_hidden_posts";
const DOWNVOTED_KEY = "kealvi_downvoted_posts";

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

function readStringArray(key: string) {
  if (typeof localStorage === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveStringArray(key: string, value: Set<string>) {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(key, JSON.stringify([...value]));
}

function readComments(): Record<string, string[]> {
  if (typeof localStorage === "undefined") return {};

  try {
    const parsed = JSON.parse(localStorage.getItem(COMMENTS_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function formatAge(value?: string | null) {
  if (!value) return "just now";

  const then = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function QuestionsList({
  initialQuestions,
  initialHasMore,
  currentUser,
  activeView,
  activeCommunity,
  externalQuery,
  createSignal,
  onRequireAuth,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
  currentUser: User | null;
  activeView: FeedView;
  activeCommunity: string;
  externalQuery: string;
  createSignal: number;
  onRequireAuth: () => boolean;
}) {
  const createInputRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState(externalQuery);
  const [manualSort, setManualSort] = useState<FeedSort>("hot");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [enhancingDraft, setEnhancingDraft] = useState(false);
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(
    null
  );
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {}
  );
  const [comments, setComments] = useState<Record<string, string[]>>(() =>
    readComments()
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(readStringArray(SAVED_KEY))
  );
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(readStringArray(HIDDEN_KEY))
  );
  const [downvotedIds, setDownvotedIds] = useState<Set<string>>(
    () => new Set(readStringArray(DOWNVOTED_KEY))
  );
  const [shareMessage, setShareMessage] = useState<string | null>(null);
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
  const [answeringQuestionIds, setAnsweringQuestionIds] = useState<Set<string>>(
    () => new Set()
  );
  const [feedMessage, setFeedMessage] = useState<string | null>(null);

  const effectiveQuery = externalQuery || query;
  const sort: FeedSort =
    activeView === "Popular"
      ? "top"
      : activeView === "Explore"
        ? "new"
        : manualSort;
  const votedQuestionIds = new Set([
    ...(savedVotedQuestionIds ? savedVotedQuestionIds.split("\n") : []),
    ...selectedQuestionIds,
  ]);

  useEffect(() => {
    if (createSignal === 0) return;
    createInputRef.current?.focus();
    createInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [createSignal]);

  useEffect(() => {
    const id = setTimeout(async () => {
      const url = effectiveQuery
        ? `/api/questions?q=${encodeURIComponent(effectiveQuery)}`
        : `/api/questions`;
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data.questions);
      setHasMore(data.hasMore);
    }, 300);

    return () => clearTimeout(id);
  }, [effectiveQuery]);

  const visibleQuestions = useMemo(() => {
    let visible = [...questions];

    if (activeView === "Saved") {
      visible = visible.filter((question) => savedIds.has(question.id));
    } else if (activeView === "Hidden") {
      visible = visible.filter((question) => hiddenIds.has(question.id));
    } else {
      visible = visible.filter((question) => !hiddenIds.has(question.id));
    }

    return visible.sort((a, b) => {
      if (sort === "top") return b.votes - a.votes;

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (sort === "new") return bTime - aTime;
      return b.votes * 2 + bTime / 100000000 - (a.votes * 2 + aTime / 100000000);
    });
  }, [activeView, hiddenIds, questions, savedIds, sort]);

  async function submit() {
    if (!draft.trim() || posting) return;
    if (!onRequireAuth()) return;

    setPosting(true);
    setFeedMessage(null);

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft,
          author: currentUser?.username ?? "kealvi_user",
        }),
      });
      const created = await res.json();

      if (!res.ok) {
        setFeedMessage(created.error ?? "Could not create your post.");
        return;
      }

      setQuestions((qs) => [
        {
          id: created.id,
          body: created.body,
          author: created.author,
          createdAt: created.created_at,
          votes: 0,
        },
        ...qs,
      ]);
      setDraft("");
      setManualSort("new");
      setFeedMessage("Post created.");
    } catch {
      setFeedMessage("Could not create your post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function enhanceDraftQuestion() {
    const question = draft.trim();

    if (!question || enhancingDraft) {
      setFeedMessage("Type a question first.");
      return;
    }

    if (!onRequireAuth()) return;

    setEnhancingDraft(true);
    setFeedMessage(null);

    try {
      const res = await fetch("/api/enhance-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedMessage(data.error ?? "Could not enhance your question.");
        return;
      }

      setDraft(data.enhancedQuestion);
      setFeedMessage("Question enhanced.");
      createInputRef.current?.focus();
      window.setTimeout(() => setFeedMessage(null), 2500);
    } catch {
      setFeedMessage("Could not enhance your question.");
    } finally {
      setEnhancingDraft(false);
    }
  }

  async function upvote(id: string) {
    if (!onRequireAuth()) return;
    if (votedQuestionIds.has(id) || pendingVoteIds.has(id)) return;

    setFeedMessage(null);
    setPendingVoteIds((ids) => new Set(ids).add(id));
    setDownvotedIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      saveStringArray(DOWNVOTED_KEY, next);
      return next;
    });

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
            ? {
                ...q,
                votes: typeof data.votes === "number" ? data.votes : q.votes - 1,
              }
            : q
        )
      );

      if (res.status === 409) {
        markQuestionVoted(id);
        window.dispatchEvent(new Event("question-vote"));
        setSelectedQuestionIds((ids) => new Set(ids).add(id));
      }

      setFeedMessage(data.error ?? "Could not record your vote.");
    } catch {
      setQuestions((qs) =>
        qs.map((q) => (q.id === id ? { ...q, votes: q.votes - 1 } : q))
      );
      setFeedMessage("Could not record your vote. Please try again.");
    } finally {
      setPendingVoteIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }

  function downvote(id: string) {
    if (!onRequireAuth()) return;
    if (votedQuestionIds.has(id)) {
      setFeedMessage("You already upvoted this post.");
      return;
    }

    setDownvotedIds((ids) => {
      const next = new Set(ids);
      const alreadyDownvoted = next.has(id);

      if (alreadyDownvoted) {
        next.delete(id);
      } else {
        next.add(id);
      }

      saveStringArray(DOWNVOTED_KEY, next);
      setQuestions((qs) =>
        qs.map((q) =>
          q.id === id
            ? { ...q, votes: q.votes + (alreadyDownvoted ? 1 : -1) }
            : q
        )
      );
      return next;
    });
  }

  function toggleSaved(id: string) {
    if (!onRequireAuth()) return;

    setSavedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveStringArray(SAVED_KEY, next);
      return next;
    });
  }

  async function sharePost(id: string) {
    const url = `${window.location.origin}/?post=${id}`;

    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("Post link copied");
    } catch {
      setShareMessage(url);
    }

    window.setTimeout(() => setShareMessage(null), 2500);
  }

  function toggleHidden(id: string) {
    if (!onRequireAuth()) return;

    setHiddenIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveStringArray(HIDDEN_KEY, next);
      return next;
    });
  }

  function submitComment(id: string) {
    if (!onRequireAuth()) return;

    const comment = commentDrafts[id]?.trim();
    if (!comment) return;

    setComments((items) => {
      const next = {
        ...items,
        [id]: [
          `${currentUser?.username ?? "local_user"}: ${comment}`,
          ...(items[id] ?? []),
        ],
      };
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(next));
      return next;
    });
    setCommentDrafts((items) => ({ ...items, [id]: "" }));
  }

  async function addAiAnswer(question: Question) {
    if (!onRequireAuth()) return;
    if (answeringQuestionIds.has(question.id)) return;

    setFeedMessage(null);
    setExpandedCommentId(question.id);
    setAnsweringQuestionIds((ids) => new Set(ids).add(question.id));

    try {
      const res = await fetch("/api/answer-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.body }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedMessage(data.error ?? "Could not generate an AI answer.");
        return;
      }

      setComments((items) => {
        const next = {
          ...items,
          [question.id]: [
            `${currentUser?.username ?? "local_user"} AI: ${data.answer}`,
            ...(items[question.id] ?? []),
          ],
        };
        localStorage.setItem(COMMENTS_KEY, JSON.stringify(next));
        return next;
      });
      setFeedMessage("AI answer added.");
      window.setTimeout(() => setFeedMessage(null), 2500);
    } catch {
      setFeedMessage("Could not generate an AI answer.");
    } finally {
      setAnsweringQuestionIds((ids) => {
        const next = new Set(ids);
        next.delete(question.id);
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
    <section className="min-w-0 space-y-3">
      <div className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-3">
        <div className="flex gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--reddit-card-muted)] font-bold text-[var(--reddit-muted)]">
            kealvi
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex gap-2">
              <input
                ref={createInputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => {
                  if (!currentUser) onRequireAuth();
                }}
                placeholder={
                  currentUser ? `Create Post in ${activeCommunity}` : "Log in to create a post"
                }
                className="min-w-0 flex-1 rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2 text-[var(--reddit-text)] outline-none placeholder:text-[var(--reddit-muted)] focus:border-[var(--reddit-blue)]"
              />
              <button
                onClick={enhanceDraftQuestion}
                disabled={!draft.trim() || enhancingDraft || posting}
                className="rounded-md border border-[var(--reddit-border-soft)] px-3 py-2 text-sm font-bold text-[var(--reddit-blue)] hover:border-[var(--reddit-blue)] disabled:opacity-45"
                title="Enhance question with Gemini"
                aria-label="Enhance question with Gemini"
              >
                {enhancingDraft ? "..." : "AI"}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--reddit-muted)]">
                Posting as {currentUser ? `${currentUser.username}` : "guest"}
              </p>
              <button
                onClick={submit}
                disabled={!draft.trim() || posting}
                className="rounded-full bg-[var(--reddit-blue)] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {(["hot", "new", "top"] as FeedSort[]).map((item) => (
              <button
                key={item}
                onClick={() => setManualSort(item)}
                className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${
                  sort === item
                    ? "bg-[var(--reddit-card-muted)] text-[var(--reddit-blue)]"
                    : "text-[var(--reddit-muted)] hover:bg-[var(--reddit-card-muted)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts"
            className="w-full rounded-full border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-4 py-2 text-sm text-[var(--reddit-text)] outline-none placeholder:text-[var(--reddit-muted)] focus:border-[var(--reddit-blue)] md:max-w-xs"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--reddit-muted)]">
          {activeView} in {activeCommunity}
          {effectiveQuery ? ` - searching "${effectiveQuery}"` : ""}
        </p>
      </div>

      {(feedMessage || shareMessage) && (
        <p className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] px-3 py-2 text-sm text-[var(--reddit-muted)]">
          {feedMessage ?? shareMessage}
        </p>
      )}

      <ul className="space-y-3">
        {visibleQuestions.map((q) => {
          const voted = votedQuestionIds.has(q.id);
          const voting = pendingVoteIds.has(q.id);
          const saved = savedIds.has(q.id);
          const hidden = hiddenIds.has(q.id);
          const downvoted = downvotedIds.has(q.id);
          const commentCount = comments[q.id]?.length ?? 0;
          const commentsOpen = expandedCommentId === q.id;
          const answering = answeringQuestionIds.has(q.id);

          return (
            <li
              key={q.id}
              className="grid grid-cols-[48px_minmax(0,1fr)] overflow-hidden rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] hover:border-[var(--reddit-hover)]"
            >
              <div className="flex flex-col items-center bg-[var(--reddit-card-muted)] px-2 py-3">
                <button
                  onClick={() => upvote(q.id)}
                  disabled={voted || voting}
                  aria-pressed={voted}
                  aria-label={
                    voted
                      ? `Already voted for post with ${q.votes} votes`
                      : `Vote for post with ${q.votes} votes`
                  }
                  title={voted ? "You voted for this post" : "Upvote"}
                  className={`h-7 w-7 rounded text-lg leading-none ${
                    voted
                      ? "text-[var(--reddit-orange)]"
                      : "text-[var(--reddit-muted)] hover:bg-[var(--reddit-card)] hover:text-[var(--reddit-orange)]"
                  } disabled:opacity-80`}
                >
                  ^
                </button>
                <span className="py-1 text-xs font-bold">{q.votes}</span>
                <button
                  onClick={() => downvote(q.id)}
                  disabled={voted}
                  aria-pressed={downvoted}
                  aria-label="Downvote post"
                  title="Downvote"
                  className={`h-7 w-7 rounded text-lg leading-none ${
                    downvoted
                      ? "text-[var(--reddit-blue)]"
                      : "text-[var(--reddit-muted)] hover:bg-[var(--reddit-card)] hover:text-[var(--reddit-blue)]"
                  } disabled:opacity-45`}
                >
                  v
                </button>
              </div>

              <article className="min-w-0 p-3">
                <p className="mb-2 text-xs text-[var(--reddit-muted)]">
                  <span className="font-bold text-[var(--reddit-text)]">
                    {activeCommunity}
                  </span>
                  {" posted by "}
                  <span>{q.author || "anonymous"}</span>
                  {" - "}
                  <span>{formatAge(q.createdAt)}</span>
                </p>
                <h2 className="mb-3 break-words text-lg font-medium leading-snug">
                  {q.body}
                </h2>

                <div className="flex flex-wrap gap-1 text-xs font-bold text-[var(--reddit-muted)]">
                  <button
                    onClick={() =>
                      setExpandedCommentId(commentsOpen ? null : q.id)
                    }
                    className="rounded px-2 py-1 hover:bg-[var(--reddit-card-muted)]"
                  >
                    {commentCount} Comments
                  </button>
                  <button
                    onClick={() => sharePost(q.id)}
                    className="rounded px-2 py-1 hover:bg-[var(--reddit-card-muted)]"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => addAiAnswer(q)}
                    disabled={answering}
                    className="rounded px-2 py-1 text-[var(--reddit-blue)] hover:bg-[var(--reddit-card-muted)] disabled:opacity-50"
                  >
                    {answering ? "Answering..." : "AI Answer"}
                  </button>
                  <button
                    onClick={() => toggleSaved(q.id)}
                    className="rounded px-2 py-1 hover:bg-[var(--reddit-card-muted)]"
                  >
                    {saved ? "Saved" : "Save"}
                  </button>
                  <button
                    onClick={() => toggleHidden(q.id)}
                    className="rounded px-2 py-1 hover:bg-[var(--reddit-card-muted)]"
                  >
                    {hidden ? "Unhide" : "Hide"}
                  </button>
                </div>

                {commentsOpen && (
                  <div className="mt-3 space-y-3 border-t border-[var(--reddit-border-soft)] pt-3">
                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[q.id] ?? ""}
                        onFocus={() => {
                          if (!currentUser) onRequireAuth();
                        }}
                        onChange={(e) =>
                          setCommentDrafts((drafts) => ({
                            ...drafts,
                            [q.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          currentUser ? "Add a comment" : "Log in to comment"
                        }
                        className="min-w-0 flex-1 rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2 text-sm outline-none placeholder:text-[var(--reddit-muted)] focus:border-[var(--reddit-blue)]"
                      />
                      <button
                        onClick={() => submitComment(q.id)}
                        className="rounded-full bg-[var(--reddit-blue)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                      >
                        Reply
                      </button>
                    </div>
                    {(comments[q.id] ?? []).map((comment, index) => {
                      const [name, ...bodyParts] = comment.split(": ");
                      return (
                        <div
                          key={`${q.id}-${index}`}
                          className="border-l-2 border-[var(--reddit-border-soft)] pl-3 text-sm"
                        >
                          <p className="mb-1 text-xs font-bold text-[var(--reddit-muted)]">
                            {name}
                          </p>
                          <p>{bodyParts.join(": ")}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      {visibleQuestions.length === 0 && (
        <div className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-6 text-center text-sm text-[var(--reddit-muted)]">
          No posts match this view.
        </div>
      )}

      {hasMore && !effectiveQuery && activeView !== "Saved" && activeView !== "Hidden" && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] px-4 py-3 text-sm font-bold text-[var(--reddit-text)] hover:border-[var(--reddit-hover)] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more posts"}
        </button>
      )}
    </section>
  );
}
