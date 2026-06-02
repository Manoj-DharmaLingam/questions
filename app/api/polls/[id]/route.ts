import { getPollById } from "@/lib/polls";

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
