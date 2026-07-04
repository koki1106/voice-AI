const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Supabaseクライアント ───────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service_role key（バックエンド専用）
);

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, "http://localhost:5173"]
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS blocked: ${origin}`));
  },
}));
app.use(express.json({ limit: "10mb" }));

// ── ユーティリティ: JWTからユーザー取得 ──────────────────────
async function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── ヘルスチェック ────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── AIカルテ生成 ──────────────────────────────────────────────
app.post("/api/generate-karte", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY が未設定です" });

  const { transcript } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: "transcript が空です" });

  const systemPrompt = `あなたは整体院・カイロプラクティック院の優秀なカルテ作成アシスタントです。施術中の会話の文字起こしから、以下7項目のカルテをJSON形式のみで生成してください。会話に該当情報がない項目は空文字("")にしてください。JSON以外の文字は絶対に出力しないでください。

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
        messages: [{ role: "user", content: `次の会話からカルテを生成してください:\n\n${transcript.trim()}` }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "Claude APIエラー", detail: errText });
    }

    const data = await response.json();
    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let clean = text.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{"); const e = clean.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(502).json({ error: "AIの返答が不正なJSON形式です", raw: text });
    const parsed = JSON.parse(clean.slice(s, e + 1));
    res.json({ karte: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 患者一覧取得 ──────────────────────────────────────────────
app.get("/api/patients", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { data, error } = await supabase
    .from("patients")
    .select("*, visits(id, date, karte, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ patients: data });
});

// ── 患者登録 ──────────────────────────────────────────────────
app.post("/api/patients", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { name, kana } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "名前は必須です" });

  const { data, error } = await supabase
    .from("patients")
    .insert({ name: name.trim(), kana: kana?.trim() || "", user_id: user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ patient: { ...data, visits: [] } });
});

// ── カルテ保存 ────────────────────────────────────────────────
app.post("/api/visits", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { patient_id, date, transcript, karte } = req.body;
  if (!patient_id || !karte) return res.status(400).json({ error: "patient_id と karte は必須です" });

  const { data, error } = await supabase
    .from("visits")
    .insert({ patient_id, user_id: user.id, date, transcript, karte })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ visit: data });
});

app.listen(PORT, () => console.log(`Voice Karte backend listening on port ${PORT}`));
