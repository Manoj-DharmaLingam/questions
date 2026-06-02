import { supabase } from "@/lib/supabase";

async function countVotes(questionId: string) {
  const { count, error } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("question_id", questionId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

// We don't check-then-insert (that has a time-of-check-to-time-of-use race).
// We just try to insert and let the unique(question_id, voter_id) constraint
// be the referee — it's enforced atomically as part of the insert.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: questionId } = await params;
  const { voterId } = await req.json();

  if (!questionId || typeof voterId !== "string" || !voterId.trim()) {
    return Response.json({ error: "Missing voter id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("votes")
    .insert({ question_id: questionId, voter_id: voterId });

  if (error) {
    if (error.code === "23505") {
      // Postgres unique violation → this voter already voted on this question.
      const votes = await countVotes(questionId);
      return Response.json({ error: "already voted", votes }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  const votes = await countVotes(questionId);
  return Response.json({ ok: true, votes });
}
