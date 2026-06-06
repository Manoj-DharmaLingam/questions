type GeminiTextPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_MODEL = "gemini-2.5-flash";

function getAnswerText(data: GeminiResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function cleanAnswer(value: string) {
  return value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(answer|ai answer|comment)\s*:\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const { question } = (await req.json()) as { question?: unknown };
  const rawQuestion = typeof question === "string" ? question.trim() : "";

  if (!rawQuestion) {
    return Response.json({ error: "Question is required." }, { status: 400 });
  }

  if (rawQuestion.length > 1000) {
    return Response.json(
      { error: "Question is too long to answer." },
      { status: 400 }
    );
  }

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Write a helpful comment that answers this community question.",
                "The answer should be appropriate to the exact question, practical, and easy to understand.",
                "If the question is about code or setup, give the likely cause and the next step to try.",
                "If the question is unclear, answer the most likely meaning and mention what detail would help.",
                "Do not pretend to know facts that are not in the question.",
                "Keep it friendly and concise: 2 to 5 short sentences.",
                "Return only the comment text. No markdown heading, no label, no signature.",
                "",
                `Question: ${rawQuestion}`,
                "Comment:",
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.45,
        topP: 0.85,
        maxOutputTokens: 180,
      },
    }),
  });

  const data = (await geminiRes.json()) as GeminiResponse;

  if (!geminiRes.ok) {
    return Response.json(
      { error: data.error?.message ?? "Gemini could not answer the question." },
      { status: geminiRes.status }
    );
  }

  const answer = cleanAnswer(getAnswerText(data));

  if (!answer) {
    return Response.json(
      { error: "Gemini returned an empty answer." },
      { status: 502 }
    );
  }

  return Response.json({ answer });
}
