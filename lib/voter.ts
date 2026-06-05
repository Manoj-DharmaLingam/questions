const VOTER_ID_KEY = "voter_id";
const VOTED_QUESTIONS_KEY = "voted_question_ids";
const VOTED_POLLS_KEY = "voted_poll_option_ids";

export function getVoterId(): string {
  if (typeof localStorage === "undefined") return "";

  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
}

export function getVotedQuestionIds(): string[] {
  if (typeof localStorage === "undefined") return [];

  const raw = localStorage.getItem(VOTED_QUESTIONS_KEY);
  if (!raw) return [];

  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markQuestionVoted(questionId: string) {
  if (typeof localStorage === "undefined") return;

  const ids = new Set(getVotedQuestionIds());
  ids.add(questionId);
  localStorage.setItem(VOTED_QUESTIONS_KEY, JSON.stringify([...ids]));
}

export function getVotedPollOptionId(pollId: string): string | null {
  if (typeof localStorage === "undefined") return null;

  const raw = localStorage.getItem(VOTED_POLLS_KEY);
  if (!raw) return null;

  try {
    const votes = JSON.parse(raw);
    const optionId = votes?.[pollId];
    return typeof optionId === "string" ? optionId : null;
  } catch {
    return null;
  }
}

export function markPollVoted(pollId: string, optionId: string) {
  if (typeof localStorage === "undefined") return;

  const raw = localStorage.getItem(VOTED_POLLS_KEY);
  let votes: Record<string, string> = {};

  try {
    const parsed = raw ? JSON.parse(raw) : {};
    votes = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    votes = {};
  }

  votes[pollId] = optionId;
  localStorage.setItem(VOTED_POLLS_KEY, JSON.stringify(votes));
}

export function clearPollVote(pollId: string) {
  if (typeof localStorage === "undefined") return;

  const raw = localStorage.getItem(VOTED_POLLS_KEY);
  let votes: Record<string, string> = {};

  try {
    const parsed = raw ? JSON.parse(raw) : {};
    votes = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    votes = {};
  }

  delete votes[pollId];
  localStorage.setItem(VOTED_POLLS_KEY, JSON.stringify(votes));
}
