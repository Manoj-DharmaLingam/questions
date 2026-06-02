import { getPollById } from "@/lib/polls";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pollId } = await params;
  const { optionId, voterId } = await req.json();

  if (
    !pollId ||
    typeof optionId !== "string" ||
    !optionId.trim() ||
    typeof voterId !== "string" ||
    !voterId.trim()
  ) {
    return Response.json(
      { error: "Poll option and voter id are required" },
      { status: 400 }
    );
  }

  const { data: option, error: optionError } = await supabase
    .from("poll_options")
    .select("id")
    .eq("id", optionId)
    .eq("poll_id", pollId)
    .maybeSingle();

  if (optionError) {
    return Response.json({ error: optionError.message }, { status: 500 });
  }

  if (!option) {
    return Response.json({ error: "Poll option not found" }, { status: 404 });
  }

  const { error } = await supabase.from("poll_votes").insert({
    poll_id: pollId,
    option_id: optionId,
    voter_id: voterId,
  });

  if (error?.code === "23505") {
    const { data: vote } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("poll_id", pollId)
      .eq("voter_id", voterId)
      .maybeSingle();
    const poll = await getPollById(pollId);
    return Response.json(
      { error: "already voted", poll, selectedOptionId: vote?.option_id },
      { status: 409 }
    );
  }

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const poll = await getPollById(pollId);
  return Response.json({ ok: true, poll, selectedOptionId: optionId });
}
