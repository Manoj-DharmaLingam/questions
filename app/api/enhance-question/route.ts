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

function getEnhancedText(data: GeminiResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function cleanQuestion(value: string) {
  const cleaned = value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(better|improved|enhanced|rewritten)\s+(question|post)\s*:\s*/i, "")
    .replace(/^(better|improved|enhanced|rewritten)\s*:\s*/i, "")
    .replace(/^question\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (/[?.!]$/.test(cleaned)) return cleaned;

  return `${cleaned}?`;
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
    return Response.json({ error: "Enter a question first." }, { status: 400 });
  }

  if (rawQuestion.length > 500) {
    return Response.json(
      { error: "Question is too long to enhance." },
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
                "You are a careful editor for a student-friendly Q&A community.",
                "Your job is to turn rough draft text into a smooth, natural question someone would actually post.",
                "",
                "Rewrite the draft as one complete, fluent question.",
                "Keep the meaning, tone, and important words from the draft.",
                "Fix grammar and clarity, but do not make it sound robotic, keyword-stuffed, or chopped into fragments.",
                "Do not add details that are not in the draft.",
                "Prefer a natural sentence of about 10 to 24 words. Use more words only if the draft truly needs them.",
                "Return only the improved question, with no label or explanation.",
                "",
                "Examples:",
                "Draft: ai enhancement question is not good tune it",
                "Better: How can I improve the AI question enhancement so it sounds more natural?",
                "Draft: gemini api button not working in post box",
                "Better: Why is the Gemini AI button not working in the post box?",
                "Draft: supabase vote one user only how",
                "Better: How can I make sure each user can vote only once in Supabase?",
                "Draft: next env api key not reading",
                "Better: Why is Next.js not reading my API key from the .env file?",
                "",
                `Draft: ${rawQuestion}`,
                "Improved question:",
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.55,
        topP: 0.9,
        maxOutputTokens: 96,
      },
    }),
  });

  const data = (await geminiRes.json()) as GeminiResponse;

  if (!geminiRes.ok) {
    return Response.json(
      { error: data.error?.message ?? "Gemini could not enhance the question." },
      { status: geminiRes.status }
    );
  }

  const enhancedQuestion = cleanQuestion(getEnhancedText(data));

  if (!enhancedQuestion) {
    return Response.json(
      { error: "Gemini returned an empty question." },
      { status: 502 }
    );
  }

  return Response.json({ enhancedQuestion });
}
