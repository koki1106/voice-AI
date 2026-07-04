const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Supabaseクライアント ───────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
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

// ── Claude APIを呼ぶ共通関数 ──────────────────────────────────
async function callClaude(system, userMessage, maxTokens = 1000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude APIエラー: ${errText}`);
  }

  const data = await response.json();
  const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"); const e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("AIの返答が不正なJSON形式です: " + text.slice(0, 200));
  return JSON.parse(clean.slice(s, e + 1));
}

// ── ヘルスチェック ────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── AIカルテ生成（7項目 or SOAP形式） ─────────────────────────
app.post("/api/generate-karte", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { transcript, format } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: "transcript が空です" });

  const is_soap = format === "soap";

  const systemPrompt = is_soap
    ? `あなたは整体院・カイロプラクティック院の優秀なカルテ作成アシスタントです。施術中の会話の文字起こしから、SOAP形式のカルテをJSON形式のみで生成してください。該当情報がない項目は空文字("")にしてください。JSON以外の文字は絶対に出力しないでください。

{
  "subjective": "S（主観）：痛む場所、つらい動き、日常生活での支障",
  "objective": "O（客観）：姿勢の歪み、触診、可動域、筋肉の硬さ",
  "assessment": "A（評価）：症状の原因分析・評価",
  "plan": "P（計画）：本日行った施術内容、次回の目安、生活指導",
  "vas": 痛みのレベルを0〜10の整数で（会話から読み取れない場合はnull）
}`
    : `あなたは整体院・カイロプラクティック院の優秀なカルテ作成アシスタントです。施術中の会話の文字起こしから、以下の項目のカルテをJSON形式のみで生成してください。会話に該当情報がない項目は空文字("")にしてください。JSON以外の文字は絶対に出力しないでください。

{
  "patient": "患者名・来院回数",
  "chief_complaint": "主訴・症状の部位・痛みのレベル",
  "comparison": "前回と比べての変化（改善/悪化/変化なし）",
  "treatment": "施術箇所・アプローチ手技",
  "response": "施術後の反応・変化",
  "lifestyle": "仕事・睡眠・運動・ストレスなど生活の話",
  "next_plan": "次回来院の提案・注意事項",
  "vas": 痛みのレベルを0〜10の整数で（会話から「8/10」「10段階で7」等が読み取れる場合。読み取れない場合はnull）
}`;

  try {
    const parsed = await callClaude(systemPrompt, `次の会話からカルテを生成してください:\n\n${transcript.trim()}`, 1000);
    // vasをkarteから分離して返す（数値 or null）
    let vas = null;
    if (typeof parsed.vas === "number" && parsed.vas >= 0 && parsed.vas <= 10) vas = Math.round(parsed.vas);
    delete parsed.vas;
    res.json({ karte: parsed, vas, format: is_soap ? "soap" : "standard" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── AIインサイト生成（サマリー・今日聞くこと・次回プラン）────
async function generateInsights(patientName, visits) {
  // 直近10件までを解析対象にする（コスト・精度のバランス）
  const recent = visits.slice(0, 10);
  const history = recent.map((v, i) =>
    `【来院${i + 1}: ${v.date}】\n${JSON.stringify(v.karte, null, 0)}`
  ).join("\n\n");

  const system = `あなたは整体院・カイロプラクティック院の優秀な臨床アシスタントです。患者の過去すべての来院記録（カルテ）を解析し、以下の3項目をJSON形式のみで生成してください。情報が不足している項目は空文字または空配列にしてください。JSON以外の文字は絶対に出力しないでください。

{
  "summary": {
    "basic_info": "名前・年齢性別など分かる範囲の基本情報",
    "chief_complaint_history": "主訴とその経過の要約",
    "lifestyle": "生活・特徴（仕事・睡眠・運動など）",
    "precautions": "注意点・禁忌・既往歴・服薬など",
    "last_treatment": "前回の施術ポイントと反応・改善度",
    "self_care": "指導しているセルフケア",
    "alert": "離脱リスク（来院間隔が空きすぎている場合の警告と対策案）や危険信号があれば記載。なければ空文字"
  },
  "today_questions": {
    "symptom": ["症状に関して今日確認すべきこと（2〜3件）"],
    "conversation": ["雑談で話すと良い話題（2〜3件、前回の会話の続きがあれば優先）"]
  },
  "next_plan": "次回施術プランの提案（具体的な施術箇所・アプローチ）"
}

来院間隔は日付から計算し、直近の間隔が広がっている場合はalertに離脱リスクとして明記してください。`;

  const userMsg = `患者名: ${patientName}\n\n来院履歴（新しい順）:\n\n${history}`;
  return callClaude(system, userMsg, 1500);
}

// ── 患者一覧取得 ──────────────────────────────────────────────
app.get("/api/patients", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { data, error } = await supabase
    .from("patients")
    .select("*, visits(id, date, karte, vas, created_at)")
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

// ── カルテ保存 + AIインサイト自動更新 ─────────────────────────
app.post("/api/visits", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { patient_id, date, transcript, karte, vas } = req.body;
  if (!patient_id || !karte) return res.status(400).json({ error: "patient_id と karte は必須です" });

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({ patient_id, user_id: user.id, date, transcript, karte, vas: (typeof vas === "number" ? vas : null) })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // カルテ保存には成功したので、まず応答を返す準備をしつつ、インサイト生成を試みる
  let insights = null;
  try {
    const { data: patient } = await supabase
      .from("patients")
      .select("name, visits(id, date, karte, vas, created_at)")
      .eq("id", patient_id)
      .single();

    if (patient) {
      const sortedVisits = (patient.visits || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      insights = await generateInsights(patient.name, sortedVisits);

      await supabase
        .from("patients")
        .update({ insights })
        .eq("id", patient_id);
    }
  } catch (e) {
    // インサイト生成に失敗してもカルテ保存自体は成功させる
    console.error("insight generation failed:", e.message);
  }

  res.json({ visit, insights });
});

// ── 離脱リスク患者向けLINEメッセージ下書き生成 ────────────────
app.post("/api/line-draft", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { patient_id } = req.body;
  if (!patient_id) return res.status(400).json({ error: "patient_id が必要です" });

  try {
    const { data: patient } = await supabase
      .from("patients")
      .select("name, visits(date, karte, created_at)")
      .eq("id", patient_id)
      .eq("user_id", user.id)
      .single();

    if (!patient) return res.status(404).json({ error: "患者が見つかりません" });

    const visits = (patient.visits || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastVisit = visits[0];
    const history = visits.slice(0, 5).map((v) => `${v.date}: ${JSON.stringify(v.karte)}`).join("\n");

    const system = `あなたは整体院の丁寧で温かい受付スタッフです。しばらく来院していない患者に送る、来院を促すLINEメッセージの文面を作成してください。以下のJSON形式のみで出力してください。

{
  "message": "LINEメッセージ本文（親しみやすく、プレッシャーを与えず、前回の施術内容や症状に軽く触れながら再来院を促す。150文字程度）"
}

過度に営業的にならず、体調を気遣うトーンで。患者の名前を使ってください。`;

    const userMsg = `患者名: ${patient.name}\n最終来院日: ${lastVisit?.date || "不明"}\n\n過去の記録:\n${history}`;
    const result = await callClaude(system, userMsg, 500);
    res.json({ draft: result.message || "" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── サイト内AIチャット（症状相談） ────────────────────────────
app.post("/api/chat", async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "認証が必要です" });

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages が必要です" });
  }
  const trimmed = messages.slice(-8).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 1000),
  }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY が未設定です" });

  const system = `あなたは整体・カイロプラクティック・身体のケアに詳しい、経験豊富なアシスタントです。施術者からの症状・アプローチ・解剖学などの質問に、簡潔で実践的に答えてください。医療診断はできないため、必要に応じて医療機関の受診を勧めてください。回答は日本語で、施術者向けの専門的だが分かりやすい説明を心がけてください。`;

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
        max_tokens: 800,
        system,
        messages: trimmed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "Claude APIエラー", detail: errText });
    }

    const data = await response.json();
    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    res.json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Voice Karte backend listening on port ${PORT}`));
