import { getPollById } from "@/lib/polls";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poll = await getPollById(id);

  if (!poll) {
    return Response.json({ error: "Poll not found" }, { status: 404 });
  }

  return Response.json({ poll });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Poll id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("polls").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
