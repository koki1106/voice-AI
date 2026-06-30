const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS: VercelのフロントエンドURLのみ許可 ──────────────────
// FRONTEND_URLに Vercel のデプロイURLを設定する（例: https://voice-karte.vercel.app）
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, "http://localhost:5173"]
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // originなし（curl等）はローカル開発用に許可
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
}));

app.use(express.json({ limit: "10mb" }));

// ── ヘルスチェック ────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Claude API プロキシ ───────────────────────────────────────
app.post("/api/generate-karte", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });
  }

  const { transcript } = req.body;
  if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
    return res.status(400).json({ error: "transcript が空です" });
  }

  const systemPrompt = `あなたは整体院・カイロプラクティック院の優秀なカルテ作成アシスタントです。施術中の会話の文字起こしから、以下7項目のカルテをJSON形式のみで生成してください。会話に該当情報がない項目は空文字("")にしてください。推測しすぎず、会話に基づいて簡潔に記述します。JSON以外の文字（前置き、説明、マークダウンのコードブロック記号など）は絶対に出力しないでください。

出力するJSONのキーと内容:
{
  "patient": "患者名・来院回数",
  "chief_complaint": "主訴・症状の部位・痛みのレベル",
  "comparison": "前回と比べての変化（改善/悪化/変化なし）",
  "treatment": "施術箇所・アプローチ手技",
  "response": "施術後の反応・変化",
  "lifestyle": "仕事・睡眠・運動・ストレスなど生活の話",
  "next_plan": "次回来院の提案・注意事項"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `次の会話からカルテを生成してください:\n\n${transcript.trim()}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return res.status(502).json({ error: "Claude APIエラー", detail: errText });
    }

    const data = await response.json();
    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // JSON部分だけを抽出
    let clean = text.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) {
      return res.status(502).json({ error: "AIの返答が正しいJSON形式ではありませんでした", raw: text });
    }
    const parsed = JSON.parse(clean.slice(s, e + 1));
    res.json({ karte: parsed });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Voice Karte backend listening on port ${PORT}`);
});
