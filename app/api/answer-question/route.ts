type GeminiTextPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
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
    .replace(/^(answer|ai answer|comment|better answer)\s*:\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksComplete(value: string) {
  return /[.!?)]$/.test(value.trim());
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
                "You write useful answers for a beginner-friendly Q&A community.",
                "Answer the exact question in a complete, practical comment.",
                "",
                "Rules:",
                "- Start with the direct answer, not filler.",
                "- Give enough detail that the user can take the next step.",
                "- If it is a how-to question, include the main steps in plain language.",
                "- If it is a coding/setup question, mention the likely cause and what to check next.",
                "- If the question is broad, give a short recommended path instead of a vague answer.",
                "- Do not stop mid-sentence. End with a complete final sentence.",
                "- Do not add unsupported facts or pretend you saw the user's files.",
                "- Keep it friendly and concise: 3 to 6 sentences.",
                "- Return only the comment text. No heading, label, signature, bullets, or markdown.",
                "",
                "Examples:",
                "Question: How do I deploy to Vercel?",
                "Comment: Push your project to GitHub, then import that repository in Vercel. Vercel will usually detect Next.js automatically, so you can keep the default build settings. Add any required environment variables in the Vercel project settings before deploying. After the first deploy, future pushes to your main branch will redeploy automatically.",
                "",
                "Question: Why is my Gemini API key not working in Next.js?",
                "Comment: Make sure the key is stored in an environment variable on the server, such as GEMINI_API_KEY, and that you restarted the dev server after editing .env. Do not call Gemini directly from a client component because that exposes the key. Use a route handler to call Gemini, then call that route from the UI.",
                "",
                "Question: How can I make each user vote only once in Supabase?",
                "Comment: Store each vote with both the question ID and a stable user or voter ID. Add a unique constraint on those two columns so the database rejects duplicate votes. Then handle that duplicate error in your API route and show a friendly message to the user.",
                "",
                `Question: ${rawQuestion}`,
                "Comment:",
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        topP: 0.85,
        maxOutputTokens: 700,
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

  if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    return Response.json(
      { error: "Gemini returned an incomplete answer. Please try again." },
      { status: 502 }
    );
  }

  return Response.json({ answer });
}
