import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL || "";

const c = {
  paper: "#F5F2EC", surface: "#FFFFFF", ink: "#26231E", inkSoft: "#6B655B",
  inkFaint: "#9A9488", line: "#E4DFD4", brand: "#0F5E54", brandDeep: "#0A413A",
  rec: "#D8503D", amber: "#C98A2B",
};
const mincho = "'Hiragino Mincho ProN','Yu Mincho','YuMincho',serif";
const gothic = "'Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif";

const SECTIONS = [
  { key: "patient",         num: "①", q: "誰？",          label: "患者情報",   hint: "患者名・来院回数" },
  { key: "chief_complaint", num: "②", q: "今日何が辛い？", label: "主訴・症状", hint: "主な訴え・部位・痛みのレベル" },
  { key: "comparison",      num: "③", q: "前回と比べて？", label: "前回比較",   hint: "改善・悪化・変化なし" },
  { key: "treatment",       num: "④", q: "何をした？",     label: "施術内容",   hint: "施術箇所・アプローチ手技" },
  { key: "response",        num: "⑤", q: "どうなった？",   label: "施術後反応", hint: "施術後の反応・変化" },
  { key: "lifestyle",       num: "⑥", q: "生活の話",       label: "生活情報",   hint: "仕事・睡眠・運動・ストレス" },
  { key: "next_plan",       num: "⑦", q: "次どうする？",   label: "次回方針",   hint: "次回提案・注意事項" },
];
const emptyKarte = () => SECTIONS.reduce((a, s) => ({ ...a, [s.key]: "" }), {});

const SAMPLE = `田中さんこんにちは、今日で3回目ですね。調子はいかがですか。
実は先週から右の肩がまた重くて、特に朝起きた時がつらいんです。前回は少し楽になったんですけど。
なるほど、前回より少し戻ってしまった感じですね。デスクワークは相変わらず長いですか。
そうですね、最近残業が続いていて、夜も寝つきが悪くて。
わかりました。では今日は右の肩甲骨まわりと首の付け根を中心にほぐしていきますね。
（施術後）どうですか、肩。
あ、軽いです。さっきより全然回ります。
良かったです。寝る前のスマホを少し控えてみてください。次回は1週間後くらいにまた来ていただけると助かります。`;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "APIエラー");
  }
  return res.json();
}

// ── アプリ本体 ─────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:c.paper, fontFamily:gothic, color:c.inkFaint }}>
      読み込み中…
    </div>
  );

  return (
    <div style={{ background:c.paper, minHeight:"100vh", fontFamily:gothic, color:c.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        textarea, input, button { font-family: inherit; }
        @keyframes rise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.12);opacity:.55} }
        @keyframes ring { 0%{box-shadow:0 0 0 0 rgba(216,80,61,.45)} 100%{box-shadow:0 0 0 22px rgba(216,80,61,0)} }
        .rise { animation: rise .5s cubic-bezier(.2,.7,.3,1) both; }
        .hov:hover { filter: brightness(.96); }
        .card-hov { transition: transform .15s ease, box-shadow .15s ease; }
        .card-hov:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(38,35,30,.08); }
        textarea:focus, input:focus { outline: 2px solid ${c.brand}; outline-offset: 1px; }
      `}</style>

      {!session ? (
        <AuthScreen />
      ) : (
        <MainApp session={session} />
      )}
    </div>
  );
}

// ── 認証画面（ログイン・新規登録）────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("確認メールを送信しました。メールのリンクをクリックしてください。");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:20 }}>
      <div style={{ width:"100%", maxWidth:380 }} className="rise">
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:c.brand, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:22, marginBottom:12 }}>◔</div>
          <div style={{ fontFamily:mincho, fontSize:24, color:c.ink }}>音声カルテ</div>
          <div style={{ fontSize:11, letterSpacing:2, color:c.inkFaint, marginTop:2 }}>VOICE AI KARTE</div>
        </div>

        <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:28 }}>
          <div style={{ display:"flex", marginBottom:20, borderBottom:`1px solid ${c.line}`, paddingBottom:0 }}>
            {["login","signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setMessage(""); }}
                style={{ flex:1, padding:"10px 0", background:"none", border:"none", borderBottom:`2px solid ${mode===m ? c.brand : "transparent"}`, cursor:"pointer", fontSize:14, fontWeight:mode===m ? 600 : 400, color:mode===m ? c.brand : c.inkFaint, marginBottom:-1 }}>
                {m === "login" ? "ログイン" : "新規登録"}
              </button>
            ))}
          </div>

          <div style={{ display:"grid", gap:12 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス" style={inputS} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード（6文字以上）" style={inputS}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          </div>

          {error && <div style={{ color:c.rec, fontSize:13, marginTop:12 }}>{error}</div>}
          {message && <div style={{ color:c.brand, fontSize:13, marginTop:12 }}>{message}</div>}

          <button onClick={handleSubmit} disabled={loading} className="hov"
            style={{ ...primaryBtn, width:"100%", marginTop:16, padding:14, fontSize:15, opacity:loading ? 0.7 : 1 }}>
            {loading ? "処理中…" : mode === "login" ? "ログイン" : "アカウントを作成"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── メインアプリ ──────────────────────────────────────────────
function MainApp({ session }) {
  const [patients, setPatients] = useState([]);
  const [view, setView] = useState("home");
  const [activePatientId, setActivePatientId] = useState(null);
  const [query, setQuery] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const token = session.access_token;
  const activePatient = patients.find((p) => p.id === activePatientId) || null;

  useEffect(() => { loadPatients(); }, []);

  async function loadPatients() {
    setDataLoading(true);
    try {
      const data = await apiFetch("/api/patients", {}, token);
      setPatients(data.patients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  }

  async function addPatient(name, kana) {
    const data = await apiFetch("/api/patients", { method:"POST", body: JSON.stringify({ name, kana }) }, token);
    setPatients((prev) => [data.patient, ...prev]);
    return data.patient;
  }

  async function saveVisit(patientId, visit) {
    const data = await apiFetch("/api/visits", {
      method:"POST",
      body: JSON.stringify({ patient_id: patientId, date: visit.date, transcript: visit.transcript, karte: visit.karte })
    }, token);
    setPatients((prev) => prev.map((p) =>
      p.id === patientId
        ? { ...p, visits: [data.visit, ...(p.visits || [])], insights: data.insights || p.insights }
        : p
    ));
  }

  function openNewSession(patient) { setActivePatientId(patient.id); setView("session"); }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <>
      <Header onHome={() => setView("home")} onLogout={handleLogout} email={session.user.email} />
      <div style={{ maxWidth:860, margin:"0 auto", padding:"0 20px 80px" }}>
        {dataLoading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:c.inkFaint }}>読み込み中…</div>
        ) : view === "home" ? (
          <Home patients={patients} query={query} setQuery={setQuery}
            onSelect={(p) => { setActivePatientId(p.id); setView("patient"); }}
            onNew={openNewSession} addPatient={addPatient} />
        ) : view === "session" && activePatient ? (
          <Session patient={activePatient} token={token}
            onCancel={() => setView("home")}
            onSaved={async (visit) => { await saveVisit(activePatient.id, visit); setView("patient"); }} />
        ) : view === "patient" && activePatient ? (
          <PatientDetail patient={activePatient} onBack={() => setView("home")} onNew={() => openNewSession(activePatient)} />
        ) : null}
      </div>
    </>
  );
}

// ── ヘッダー ──────────────────────────────────────────────────
function Header({ onHome, onLogout, email }) {
  return (
    <div style={{ borderBottom:`1px solid ${c.line}`, background:"rgba(245,242,236,.85)", backdropFilter:"blur(6px)", position:"sticky", top:0, zIndex:10 }}>
      <div style={{ maxWidth:860, margin:"0 auto", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={onHome} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:c.brand, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15 }}>◔</div>
          <div>
            <div style={{ fontFamily:mincho, fontSize:18, letterSpacing:1, color:c.ink }}>音声カルテ</div>
            <div style={{ fontSize:10, letterSpacing:2, color:c.inkFaint, marginTop:-2 }}>VOICE AI KARTE</div>
          </div>
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:12, color:c.inkFaint, display:"none" }}>{email}</div>
          <button onClick={onLogout} className="hov" style={{ ...ghostBtn, fontSize:12, padding:"7px 12px" }}>ログアウト</button>
        </div>
      </div>
    </div>
  );
}

// ── ホーム ────────────────────────────────────────────────────
function Home({ patients, query, setQuery, onSelect, onNew, addPatient }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [kana, setKana] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = patients.filter((p) =>
    !query || p.name.replace(/\s/g,"").includes(query.replace(/\s/g,"")) || (p.kana||"").includes(query)
  );

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const p = await addPatient(name.trim(), kana.trim());
      setName(""); setKana(""); setShowNew(false);
      onNew(p);
    } catch(e) { alert(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div style={{ paddingTop:36 }}>
      <div className="rise">
        <div style={{ fontFamily:mincho, fontSize:28, lineHeight:1.4, color:c.ink }}>話すだけで、カルテになる。</div>
        <p style={{ color:c.inkSoft, fontSize:14, marginTop:8, lineHeight:1.7 }}>施術中の会話をそのまま記録。AIが7項目に整理して、確認・修正するだけ。</p>
      </div>
      <div style={{ marginTop:28, display:"flex", gap:10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="患者名・よみがなで検索"
          style={{ flex:1, padding:"12px 14px", border:`1px solid ${c.line}`, borderRadius:10, fontSize:14, background:c.surface, color:c.ink }} />
        <button onClick={() => setShowNew((v) => !v)} className="hov" style={ghostBtn}>＋ 新規患者</button>
      </div>
      {showNew && (
        <div className="rise" style={{ marginTop:12, padding:16, background:c.surface, border:`1px solid ${c.line}`, borderRadius:12 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="氏名（必須）" style={inputS} />
            <input value={kana} onChange={(e) => setKana(e.target.value)} placeholder="よみがな" style={inputS} />
            <button onClick={handleCreate} className="hov" style={{ ...primaryBtn, opacity:creating ? 0.7 : 1 }}>
              {creating ? "登録中…" : "登録して施術を開始"}
            </button>
          </div>
        </div>
      )}
      <div style={{ marginTop:30 }}>
        <SectionLabel>患者一覧</SectionLabel>
        {filtered.length === 0 && (
          <div style={{ color:c.inkFaint, fontSize:14, padding:"24px 0" }}>
            {patients.length === 0 ? "「＋ 新規患者」から最初の患者を登録してください。" : "該当する患者がいません。"}
          </div>
        )}
        <div style={{ display:"grid", gap:10, marginTop:12 }}>
          {filtered.map((p) => {
            const visits = p.visits || [];
            const last = visits[0];
            const lastKarte = last?.karte;
            return (
              <div key={p.id} className="card-hov" style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, padding:16, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                <button onClick={() => onSelect(p)} style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", flex:1, padding:0 }}>
                  <div style={{ fontSize:16, fontWeight:600, color:c.ink }}>{p.name}</div>
                  <div style={{ fontSize:12, color:c.inkFaint, marginTop:3 }}>
                    {p.kana || "—"} ・ 来院 {visits.length} 回
                    {last ? ` ・ 最終 ${last.date}` : " ・ 未来院"}
                    {lastKarte?.chief_complaint ? ` ・ ${lastKarte.chief_complaint}` : ""}
                  </div>
                </button>
                <button onClick={() => onNew(p)} className="hov" style={ghostBtn}>施術を記録 →</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 施術セッション ────────────────────────────────────────────
const SOAP_SECTIONS = [
  { key: "subjective", num: "S", label: "主観", hint: "痛む場所・つらい動き・日常生活での支障" },
  { key: "objective",  num: "O", label: "客観", hint: "姿勢の歪み・触診・可動域・筋肉の硬さ" },
  { key: "assessment", num: "A", label: "評価", hint: "症状の原因分析・評価" },
  { key: "plan",       num: "P", label: "計画", hint: "本日の施術・次回目安・生活指導" },
];
const emptySoap = () => SOAP_SECTIONS.reduce((a, s) => ({ ...a, [s.key]: "" }), {});

function Session({ patient, token, onCancel, onSaved }) {
  const [mode, setMode] = useState("voice");
  const [karteFormat, setKarteFormat] = useState("standard"); // standard | soap
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [karte, setKarte] = useState(null);
  const [error, setError] = useState("");
  const [speechOK, setSpeechOK] = useState(true);
  const recogRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechOK(false); setMode("text"); }
    return () => {
      if (recogRef.current) try { recogRef.current.stop(); } catch(e) {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "ja-JP"; r.continuous = true; r.interimResults = true;
    r.onresult = (event) => {
      let intr = "", fin = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) fin += t; else intr += t;
      }
      if (fin) setTranscript((prev) => (prev ? prev + "\n" : "") + fin);
      setInterim(intr);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") { setError("マイクが使えません。テキスト入力に切り替えてください。"); setSpeechOK(false); setMode("text"); stopRec(); }
    };
    r.onend = () => { if (recogRef.current) try { r.start(); } catch(e) {} };
    recogRef.current = r;
    try { r.start(); } catch(e) {}
    setRecording(true); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopRec() {
    setRecording(false); setInterim("");
    if (recogRef.current) { const r = recogRef.current; recogRef.current = null; try { r.stop(); } catch(e) {} }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function handleGenerate() {
    const src = (transcript + " " + interim).trim();
    if (!src) { setError("先に会話を録音するか、テキストを入力してください。"); return; }
    if (recording) stopRec();
    setError(""); setGenerating(true);
    try {
      const data = await apiFetch("/api/generate-karte", { method:"POST", body: JSON.stringify({ transcript: src, format: karteFormat }) }, token);
      const base = karteFormat === "soap" ? emptySoap() : emptyKarte();
      setKarte({ ...base, ...data.karte });
    } catch(e) { setError(`カルテ生成に失敗しました: ${e.message}`); }
    finally { setGenerating(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSaved({ date: todayStr(), transcript: (transcript + " " + interim).trim(), karte });
    } catch(e) { setError(`保存に失敗しました: ${e.message}`); setSaving(false); }
  }

  const mmss = `${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}`;
  const visits = patient.visits || [];

  return (
    <div style={{ paddingTop:28 }}>
      <BackRow onBack={onCancel} label="ホームに戻る" />
      <div style={{ marginTop:14, display:"flex", alignItems:"baseline", gap:10 }}>
        <div style={{ fontFamily:mincho, fontSize:24, color:c.ink }}>{patient.name}</div>
        <div style={{ fontSize:12, color:c.inkFaint }}>{visits.length === 0 ? "初回" : `${visits.length + 1}回目`} ・ {todayStr()}</div>
      </div>

      {!karte && (
        <>
          <div style={{ marginTop:20, display:"flex", gap:8 }}>
            <Toggle active={mode==="voice"} disabled={!speechOK} onClick={() => speechOK && setMode("voice")}>🎙 音声で記録</Toggle>
            <Toggle active={mode==="text"} onClick={() => setMode("text")}>⌨ テキストで記録</Toggle>
          </div>

          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:c.inkFaint }}>カルテ形式：</span>
            <Toggle active={karteFormat==="standard"} onClick={() => setKarteFormat("standard")}>7項目</Toggle>
            <Toggle active={karteFormat==="soap"} onClick={() => setKarteFormat("soap")}>SOAP</Toggle>
          </div>
          {!speechOK && <div style={{ fontSize:12, color:c.amber, marginTop:8 }}>※ テキスト入力をご利用ください。</div>}

          {mode === "voice" && (
            <div style={{ marginTop:18, background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:28, textAlign:"center" }}>
              <button onClick={recording ? stopRec : startRec}
                style={{ width:84, height:84, borderRadius:"50%", border:"none", cursor:"pointer", background:recording ? c.rec : c.brand, color:"#fff", fontSize:30, animation:recording ? "ring 1.4s infinite" : "none" }}>
                {recording ? "■" : "●"}
              </button>
              <div style={{ marginTop:14, fontSize:13, color:c.inkSoft }}>
                {recording
                  ? <span style={{ color:c.rec, fontWeight:600 }}><span style={{ display:"inline-block", animation:"pulse 1.2s infinite", marginRight:6 }}>●</span>録音中 {mmss}</span>
                  : "ボタンを押して施術中の会話を録音"}
              </div>
              {(transcript || interim) && (
                <div style={{ marginTop:18, textAlign:"left", background:c.paper, borderRadius:10, padding:14, maxHeight:180, overflowY:"auto", fontSize:14, lineHeight:1.7, color:c.ink, whiteSpace:"pre-wrap" }}>
                  {transcript}{interim && <span style={{ color:c.inkFaint }}> {interim}</span>}
                </div>
              )}
            </div>
          )}

          {mode === "text" && (
            <div style={{ marginTop:18 }}>
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
                placeholder="施術中の会話をそのまま入力"
                style={{ width:"100%", minHeight:180, padding:16, border:`1px solid ${c.line}`, borderRadius:12, fontSize:14, lineHeight:1.7, background:c.surface, color:c.ink, resize:"vertical" }} />
              <button onClick={() => setTranscript(SAMPLE)} className="hov" style={{ ...ghostBtn, marginTop:8 }}>サンプル会話を挿入してデモ</button>
            </div>
          )}

          {error && <div style={{ color:c.rec, fontSize:13, marginTop:12 }}>{error}</div>}
          <button onClick={handleGenerate} disabled={generating} className="hov"
            style={{ ...primaryBtn, width:"100%", marginTop:18, padding:"15px", fontSize:15, opacity:generating ? 0.7 : 1, cursor:generating ? "default" : "pointer" }}>
            {generating ? "AIがカルテを作成中…" : "✦ カルテを生成する"}
          </button>
        </>
      )}

      {karte && (
        <div style={{ marginTop:24 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <SectionLabel>生成されたカルテ（確認・修正できます）</SectionLabel>
            <button onClick={() => { setKarte(null); setError(""); }} className="hov" style={ghostBtn}>↺ 入力に戻る</button>
          </div>
          <div style={{ display:"grid", gap:10, marginTop:14 }}>
            {(karteFormat === "soap" ? SOAP_SECTIONS : SECTIONS).map((s, i) => (
              <div key={s.key} className="rise" style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, padding:14, animationDelay:`${i*70}ms` }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:6 }}>
                  <span style={{ fontFamily:mincho, fontSize:20, color:c.brand }}>{s.num}</span>
                  <span style={{ fontWeight:700, fontSize:14, color:c.ink }}>{s.label}</span>
                  {s.q && <span style={{ fontSize:11, color:c.inkFaint }}>／ {s.q}</span>}
                </div>
                <textarea value={karte[s.key]||""} onChange={(e) => setKarte({ ...karte, [s.key]: e.target.value })}
                  placeholder={s.hint}
                  style={{ width:"100%", minHeight:46, padding:"8px 10px", border:`1px solid ${c.line}`, borderRadius:8, fontSize:14, lineHeight:1.6, background:c.paper, color:c.ink, resize:"vertical" }} />
              </div>
            ))}
          </div>
          {error && <div style={{ color:c.rec, fontSize:13, marginTop:12 }}>{error}</div>}
          <button onClick={handleSave} disabled={saving} className="hov"
            style={{ ...primaryBtn, width:"100%", marginTop:18, padding:15, fontSize:15, opacity:saving ? 0.7 : 1 }}>
            {saving ? "保存中…" : "✓ カルテを保存"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── 患者詳細 ──────────────────────────────────────────────────
function isSoapKarte(karte) {
  return karte && ("subjective" in karte || "objective" in karte || "assessment" in karte || "plan" in karte);
}

function PatientDetail({ patient, onBack, onNew }) {
  const visits = (patient.visits || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [openId, setOpenId] = useState(visits[0]?.id || null);
  const insights = patient.insights;

  return (
    <div style={{ paddingTop:28 }}>
      <BackRow onBack={onBack} label="ホームに戻る" />
      <div style={{ marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <div>
          <div style={{ fontFamily:mincho, fontSize:26, color:c.ink }}>{patient.name}</div>
          <div style={{ fontSize:12, color:c.inkFaint, marginTop:4 }}>{patient.kana || "—"} ・ 来院 {visits.length} 回</div>
        </div>
        <button onClick={onNew} className="hov" style={primaryBtn}>＋ 今日の施術を記録</button>
      </div>

      {insights && <InsightsPanel insights={insights} />}

      <div style={{ marginTop:28 }}>
        <SectionLabel>来院履歴</SectionLabel>
        {visits.length === 0 && <div style={{ color:c.inkFaint, fontSize:14, padding:"20px 0" }}>まだ記録がありません。</div>}
        <div style={{ display:"grid", gap:10, marginTop:12 }}>
          {visits.map((v) => {
            const open = openId === v.id;
            const karte = v.karte || {};
            const sections = isSoapKarte(karte) ? SOAP_SECTIONS : SECTIONS;
            const preview = karte.chief_complaint || karte.subjective || "記録内容あり";
            return (
              <div key={v.id} style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, overflow:"hidden" }}>
                <button onClick={() => setOpenId(open ? null : v.id)}
                  style={{ width:"100%", textAlign:"left", background:"none", border:"none", cursor:"pointer", padding:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:c.ink }}>{v.date}</div>
                    <div style={{ fontSize:12, color:c.inkFaint, marginTop:3 }}>{preview}</div>
                  </div>
                  <span style={{ color:c.inkFaint, fontSize:18 }}>{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div style={{ padding:"0 16px 16px", borderTop:`1px solid ${c.line}` }}>
                    <div style={{ display:"grid", gap:8, marginTop:14 }}>
                      {sections.map((s) => (
                        <div key={s.key} style={{ display:"flex", gap:10 }}>
                          <div style={{ minWidth:86, fontSize:12, color:c.inkSoft }}>
                            <span style={{ fontFamily:mincho, color:c.brand, marginRight:4 }}>{s.num}</span>{s.label}
                          </div>
                          <div style={{ fontSize:13, color:c.ink, lineHeight:1.6, flex:1 }}>
                            {karte[s.key] || <span style={{ color:c.inkFaint }}>—</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── AIサマリー・今日聞くこと・次回プラン ────────────────────
function InsightsPanel({ insights }) {
  const s = insights.summary || {};
  const tq = insights.today_questions || {};
  const hasAlert = s.alert && s.alert.trim().length > 0;

  const summaryRows = [
    ["基本情報", s.basic_info],
    ["主訴・経過", s.chief_complaint_history],
    ["生活・特徴", s.lifestyle],
    ["注意点・禁忌", s.precautions],
    ["前回の施術ポイント・反応", s.last_treatment],
    ["セルフケア", s.self_care],
  ].filter(([, v]) => v && v.trim());

  return (
    <div style={{ marginTop:24, display:"grid", gap:12 }}>
      {hasAlert && (
        <div style={{ background:"#FCEBEB", border:"1px solid #F0999599", borderRadius:12, padding:14, display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <div style={{ fontSize:13, color:"#791F1F", lineHeight:1.6 }}>{s.alert}</div>
        </div>
      )}

      <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, padding:16 }}>
        <SectionLabel>AIサマリー</SectionLabel>
        <div style={{ display:"grid", gap:10, marginTop:12 }}>
          {summaryRows.length === 0 && <div style={{ fontSize:13, color:c.inkFaint }}>情報が蓄積されると自動で表示されます。</div>}
          {summaryRows.map(([label, val]) => (
            <div key={label} style={{ display:"flex", gap:10 }}>
              <div style={{ minWidth:150, fontSize:12, color:c.inkSoft, fontWeight:600 }}>{label}</div>
              <div style={{ fontSize:13, color:c.ink, lineHeight:1.6, flex:1 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {(tq.symptom?.length > 0 || tq.conversation?.length > 0) && (
        <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, padding:16 }}>
          <SectionLabel>今日聞くこと</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:c.brand, marginBottom:6 }}>症状</div>
              <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:c.ink, lineHeight:1.8 }}>
                {(tq.symptom || []).map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:c.brand, marginBottom:6 }}>会話</div>
              <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:c.ink, lineHeight:1.8 }}>
                {(tq.conversation || []).map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {insights.next_plan && (
        <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, padding:16 }}>
          <SectionLabel>次回施術プラン（AI提案）</SectionLabel>
          <div style={{ fontSize:13, color:c.ink, lineHeight:1.7, marginTop:10 }}>{insights.next_plan}</div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize:11, letterSpacing:2, color:c.inkFaint, fontWeight:700 }}>{children}</div>;
}
function BackRow({ onBack, label }) {
  return <button onClick={onBack} className="hov" style={{ background:"none", border:"none", cursor:"pointer", color:c.brand, fontSize:13, padding:0, fontWeight:600 }}>← {label}</button>;
}
function Toggle({ active, disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:"9px 14px", borderRadius:999, border:`1px solid ${active ? c.brand : c.line}`, background:active ? c.brand : c.surface, color:active ? "#fff" : disabled ? c.inkFaint : c.ink, cursor:disabled ? "not-allowed" : "pointer", fontSize:13, fontWeight:600 }}>
      {children}
    </button>
  );
}

const inputS = { flex:1, minWidth:140, padding:"11px 13px", border:`1px solid #E4DFD4`, borderRadius:10, fontSize:14, background:"#F5F2EC", color:"#26231E" };
const primaryBtn = { padding:"11px 18px", border:"none", borderRadius:10, background:"#0F5E54", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 };
const ghostBtn = { padding:"9px 14px", border:"1px solid #E4DFD4", borderRadius:10, background:"#FFFFFF", color:"#0F5E54", cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" };
