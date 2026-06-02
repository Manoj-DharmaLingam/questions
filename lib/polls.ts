import { supabase } from "@/lib/supabase";

export type PollOption = {
  id: string;
  label: string;
  votes: number;
};

export type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
};

type PollRow = {
  id: string;
  question: string;
};

type PollOptionRow = {
  id: string;
  label: string;
  poll_votes?: { count: number }[] | null;
};

export async function getLatestPoll() {
  const { data, error } = await supabase
    .from("polls")
    .select("id, question, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return getPoll(data as PollRow);
}

export async function getPoll(poll: PollRow): Promise<Poll> {
  const { data, error } = await supabase
    .from("poll_options")
    .select("id, label, position, poll_votes(count)")
    .eq("poll_id", poll.id)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);

  const options = ((data ?? []) as PollOptionRow[]).map((option) => ({
    id: option.id,
    label: option.label,
    votes: option.poll_votes?.[0]?.count ?? 0,
  }));

  return {
    id: poll.id,
    question: poll.question,
    options,
    totalVotes: options.reduce((total, option) => total + option.votes, 0),
  };
}

export async function getPollById(id: string) {
  const { data, error } = await supabase
    .from("polls")
    .select("id, question")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return getPoll(data as PollRow);
}

export async function createPoll(question: string, options: string[]) {
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .insert({ question })
    .select("id, question")
    .single();

  if (pollError) throw new Error(pollError.message);

  const optionRows = options.map((label, index) => ({
    poll_id: poll.id,
    label,
    position: index,
  }));

  const { error: optionsError } = await supabase
    .from("poll_options")
    .insert(optionRows);

  if (optionsError) throw new Error(optionsError.message);

  return getPoll(poll as PollRow);
}
