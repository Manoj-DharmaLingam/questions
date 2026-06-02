import { createPoll, getLatestPoll } from "@/lib/polls";

export async function GET() {
  const poll = await getLatestPoll();
  return Response.json({ poll });
}

export async function POST(req: Request) {
  const { question, options } = await req.json();

  const cleanQuestion = typeof question === "string" ? question.trim() : "";
  const cleanOptions = Array.isArray(options)
    ? options
        .map((option) => (typeof option === "string" ? option.trim() : ""))
        .filter(Boolean)
    : [];

  if (!cleanQuestion) {
    return Response.json({ error: "Question is required" }, { status: 400 });
  }

  if (cleanOptions.length < 2) {
    return Response.json(
      { error: "At least two options are required" },
      { status: 400 }
    );
  }

  try {
    const poll = await createPoll(cleanQuestion, cleanOptions.slice(0, 10));
    return Response.json({ poll }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create poll" },
      { status: 500 }
    );
  }
}
