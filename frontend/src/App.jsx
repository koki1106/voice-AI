import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL || "";

const c = {
  paper: "#FFFFFF", surface: "#FFFFFF", ink: "#111111", inkSoft: "#666666",
  inkFaint: "#999999", line: "#E8E8E8", lineSoft: "#ECECEC", brand: "#0F4B3E", brandDeep: "#0A3B31",
  brandSoft: "#E8F3EE", accent: "#B8863B", accentDeep: "#A36B17", rec: "#D8503D", amber: "#B8863B",
};
const mincho = "'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif";
const gothic = "'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif";
const cardShadow = "0 2px 12px rgba(0,0,0,0.06)";
const cardShadowLg = "0 6px 20px rgba(0,0,0,0.08)";

// ── ロゴマーク（音声波形モチーフ）──────────────────────────────
// variant: "brand"（緑背景・白波形） / "light"（白背景・緑波形） / "onDark"（透明背景・白波形）
function LogoMark({ size = 44, variant = "brand", radius }) {
  const r = radius ?? Math.round(size * 0.27);
  const bg = variant === "brand" ? c.brand : variant === "light" ? "#fff" : "transparent";
  const stroke = variant === "light" ? c.brand : "#fff";
  const accent = c.accent;
  // 波形バーの高さ（中央対称）
  const bars = [0.32, 0.6, 1.0, 0.72, 0.44];
  const barW = size * 0.07;
  const gap = size * 0.075;
  const totalW = bars.length * barW + (bars.length - 1) * gap;
  const startX = (size - totalW) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block" }}>
      {bg !== "transparent" && <rect x="0" y="0" width={size} height={size} rx={r} fill={bg} />}
      {bars.map((h, i) => {
        const bh = size * 0.5 * h;
        const x = startX + i * (barW + gap);
        const y = (size - bh) / 2;
        const isCenter = i === 2;
        return (
          <rect key={i} x={x} y={y} width={barW} height={bh} rx={barW / 2}
            fill={isCenter ? accent : stroke} opacity={isCenter ? 1 : 0.9} />
        );
      })}
    </svg>
  );
}

// カルテ項目マスター（全候補）。defaultOn=true が初期表示項目
const ALL_FIELDS = [
  { key: "patient",         num: "①", q: "誰？",          label: "患者情報",   hint: "患者名・来院回数", defaultOn: true },
  { key: "chief_complaint", num: "②", q: "今日何が辛い？", label: "主訴・症状", hint: "主な訴え・部位・痛みのレベル", defaultOn: true },
  { key: "comparison",      num: "③", q: "前回と比べて？", label: "前回比較",   hint: "改善・悪化・変化なし", defaultOn: true },
  { key: "treatment",       num: "④", q: "何をした？",     label: "施術内容",   hint: "施術箇所・アプローチ手技", defaultOn: true },
  { key: "response",        num: "⑤", q: "どうなった？",   label: "施術後反応", hint: "施術後の反応・変化", defaultOn: true },
  { key: "lifestyle",       num: "⑥", q: "生活の話",       label: "生活情報",   hint: "仕事・睡眠・運動・ストレス", defaultOn: true },
  { key: "next_plan",       num: "⑦", q: "次どうする？",   label: "次回方針",   hint: "次回提案・注意事項", defaultOn: true },
  // 追加候補（初期はオフ）
  { key: "posture",         num: "⑧", q: "姿勢・体の歪みは？", label: "姿勢・アライメント", hint: "猫背・骨盤の歪み・脚長差など", defaultOn: false },
  { key: "range_of_motion", num: "⑨", q: "可動域は？",     label: "可動域(ROM)", hint: "関節可動域・制限のある動き", defaultOn: false },
  { key: "palpation",       num: "⑩", q: "触診所見は？",   label: "触診所見",   hint: "筋緊張・圧痛点・硬結", defaultOn: false },
  { key: "homework",        num: "⑪", q: "宿題・セルフケアは？", label: "セルフケア指導", hint: "ストレッチ・エクササイズの指示", defaultOn: false },
  { key: "mental",          num: "⑫", q: "メンタル・気分は？", label: "メンタル面", hint: "ストレス・気分・モチベーション", defaultOn: false },
  { key: "goal",            num: "⑬", q: "目標は？",       label: "目標設定",   hint: "患者の目標・ゴール", defaultOn: false },
];

// デフォルトで有効な項目キー
const DEFAULT_FIELD_KEYS = ALL_FIELDS.filter((f) => f.defaultOn).map((f) => f.key);

// 選択されたキー配列からSECTION配列を作る（番号は振り直し）
const NUM_CIRCLE = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮"];
function fieldsToSections(keys) {
  const list = (keys && keys.length ? keys : DEFAULT_FIELD_KEYS)
    .map((k) => ALL_FIELDS.find((f) => f.key === k))
    .filter(Boolean);
  return list.map((f, i) => ({ ...f, num: NUM_CIRCLE[i] || "・" }));
}

// 後方互換: SECTIONS はデフォルト構成
const SECTIONS = fieldsToSections(DEFAULT_FIELD_KEYS);
const emptyKarte = (sections = SECTIONS) => sections.reduce((a, s) => ({ ...a, [s.key]: "" }), {});

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

// 最終来院からの経過日数を計算
function daysSinceLastVisit(patient) {
  const visits = patient.visits || [];
  if (visits.length === 0) return null;
  const latest = visits.reduce((max, v) => {
    const t = new Date(v.created_at).getTime();
    return t > max ? t : max;
  }, 0);
  if (!latest) return null;
  return Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));
}

// 患者レベル定義（推奨来院間隔）
const LEVELS = {
  1: { label: "レベル1", desc: "メンテナンス", interval: 30, color: "#0F6E56", bg: "#E1F5EE" },
  2: { label: "レベル2", desc: "アジャスト", interval: 14, color: "#854F0B", bg: "#FAEEDA" },
  3: { label: "レベル3", desc: "集中ケア", interval: 7, color: "#A32D2D", bg: "#FCEBEB" },
};

// 離脱リスク患者を抽出（レベルの推奨間隔の2倍を超えたら要フォロー）
function getDropoutRiskPatients(patients) {
  return patients
    .map((p) => {
      const days = daysSinceLastVisit(p);
      const level = LEVELS[p.level || 2];
      const threshold = level.interval * 2;
      return { ...p, daysSince: days, overdue: days !== null ? days - level.interval : null, threshold };
    })
    .filter((p) => p.daysSince !== null && p.daysSince >= p.threshold)
    .sort((a, b) => (b.daysSince - b.threshold) - (a.daysSince - a.threshold));
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
  const [showSplash, setShowSplash] = useState(false);
  const prevSession = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      prevSession.current = session;
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      // 未ログイン→ログインに変わった瞬間だけスプラッシュを表示
      if (s && !prevSession.current) setShowSplash(true);
      prevSession.current = s;
      setSession(s);
    });
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
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.12);opacity:.55} }
        @keyframes ring { 0%{box-shadow:0 0 0 0 rgba(216,80,61,.45)} 100%{box-shadow:0 0 0 22px rgba(216,80,61,0)} }
        @keyframes wave { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
        @keyframes splashRing { 0%{opacity:0;transform:scale(.85)} 40%{opacity:1} 100%{opacity:0;transform:scale(1.25)} }
        @keyframes splashSweep { 0%{transform:translateX(-120%)} 100%{transform:translateX(320%)} }
        .rise { animation: rise .5s cubic-bezier(.2,.7,.3,1) both; }
        .fade-in { animation: fadeIn .6s ease both; }
        .hov { transition: transform .15s ease, filter .15s ease; }
        .hov:hover { filter: brightness(.97); }
        .hov:active { transform: scale(.96); }
        .card-hov { transition: transform .15s ease, box-shadow .15s ease; }
        .card-hov:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.10); }
        textarea:focus, input:focus { outline: 2px solid ${c.brand}; outline-offset: 1px; }
      `}</style>

      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {!session ? (
        <AuthScreen />
      ) : (
        <div className="fade-in"><MainApp session={session} /></div>
      )}
    </div>
  );
}

// ── スプラッシュアニメーション（静かで高級感のあるブランド演出）──
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),   // ロゴ静かに出現
      setTimeout(() => setPhase(2), 1100),  // テキスト出現
      setTimeout(() => setLeaving(true), 2400), // フェードアウト開始
      setTimeout(() => onDone(), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:100, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"linear-gradient(160deg, #0F4B3E 0%, #0A3B31 55%, #072019 100%)",
      opacity: leaving ? 0 : 1, transition:"opacity .6s ease",
    }}>
      {/* 中央ロゴ（静かにフェード＋わずかに上昇） */}
      <div style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(12px)", transition:"opacity .9s ease, transform .9s cubic-bezier(.2,.7,.3,1)", textAlign:"center" }}>
        <div style={{ width:88, height:88, margin:"0 auto", position:"relative" }}>
          <LogoMark size={88} variant="onDark" radius={22} />
          {/* ロゴを囲む細いリング（静かに広がる） */}
          <div style={{ position:"absolute", inset:-10, borderRadius:26, border:"1px solid rgba(255,255,255,.18)", animation: phase >= 1 ? "splashRing 2.2s ease-out forwards" : "none" }} />
        </div>
      </div>

      {/* サービス名（少し遅れて出現） */}
      <div style={{ marginTop:26, textAlign:"center", opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(8px)", transition:"opacity .8s ease, transform .8s ease" }}>
        <div style={{ fontFamily:mincho, fontSize:26, fontWeight:600, color:"#fff", letterSpacing:4 }}>音声カルテ</div>
        <div style={{ fontSize:10, letterSpacing:4, color:"rgba(255,255,255,.5)", marginTop:8 }}>VOICE&nbsp;&nbsp;AI&nbsp;&nbsp;KARTE</div>
      </div>

      {/* 下部の細い光のスイープ（1回だけ） */}
      <div style={{ position:"absolute", bottom:"30%", width:120, height:1, background:"rgba(255,255,255,.1)", overflow:"hidden", opacity: phase >= 2 ? 1 : 0, transition:"opacity .6s ease" }}>
        <div style={{ position:"absolute", inset:0, width:"40%", background:"linear-gradient(90deg, transparent, rgba(200,180,120,.9), transparent)", animation: phase >= 2 ? "splashSweep 1.6s ease-in-out infinite" : "none" }} />
      </div>
    </div>
  );
}

// ── 認証画面（ログイン・新規登録）────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwValid = password.length >= 6;
  const canSubmit = emailValid && pwValid && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
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
      // よくあるエラーを日本語化
      const msg = e.message || "";
      if (/Invalid login credentials/i.test(msg)) setError("メールアドレスまたはパスワードが正しくありません。");
      else if (/already registered/i.test(msg)) setError("このメールアドレスは既に登録されています。");
      else if (/rate limit/i.test(msg)) setError("試行回数が多すぎます。しばらく待ってから再度お試しください。");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!emailValid) { setError("パスワードをリセットするには、先にメールアドレスを入力してください。"); return; }
    setError(""); setMessage(""); setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage("パスワード再設定用のメールを送信しました。メールをご確認ください。");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"linear-gradient(165deg, #0F4B3E 0%, #0A3B31 100%)" }}>
      {/* 上部ブランドエリア */}
      <div style={{ paddingTop:"clamp(48px, 12vh, 110px)", paddingBottom:40, textAlign:"center" }} className="fade-in">
        <div style={{ width:76, height:76, margin:"0 auto 18px" }}>
          <LogoMark size={76} variant="onDark" radius={20} />
        </div>
        <div style={{ fontFamily:mincho, fontSize:30, fontWeight:600, color:"#fff", letterSpacing:3 }}>音声カルテ</div>
        <div style={{ fontSize:11, letterSpacing:4, color:"rgba(255,255,255,.55)", marginTop:8 }}>VOICE&nbsp;&nbsp;AI&nbsp;&nbsp;KARTE</div>
      </div>

      {/* 白カードエリア */}
      <div style={{ flex:1, background:c.paper, borderRadius:"28px 28px 0 0", padding:"32px 24px 40px", boxShadow:"0 -8px 30px rgba(0,0,0,.15)" }}>
        <div style={{ width:"100%", maxWidth:400, margin:"0 auto" }} className="rise">
          {/* タブ */}
          <div style={{ display:"flex", background:"#F2EFE9", borderRadius:14, padding:4, marginBottom:24 }}>
            {["login","signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setMessage(""); }}
                style={{ flex:1, padding:"11px 0", background: mode===m ? c.accent : "transparent", border:"none", borderRadius:11, cursor:"pointer", fontSize:14, fontWeight:600, color: mode===m ? "#fff" : c.inkSoft, transition:"all .2s ease", boxShadow: mode===m ? "0 2px 8px rgba(184,134,59,.35)" : "none" }}>
                {m === "login" ? "ログイン" : "新規登録"}
              </button>
            ))}
          </div>

          {/* メール */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:c.inkSoft, display:"block", marginBottom:6 }}>メールアドレス</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width:"100%", height:52, padding:"0 16px", border:`1px solid ${email && !emailValid ? "#E0A9A2" : c.line}`, borderRadius:14, fontSize:15, background:"#fff", color:c.ink }} />
            {email && !emailValid && <div style={{ fontSize:12, color:c.rec, marginTop:5 }}>正しいメールアドレスを入力してください。</div>}
          </div>

          {/* パスワード（表示切替つき） */}
          <div style={{ marginBottom:8 }}>
            <label style={{ fontSize:12, fontWeight:600, color:c.inkSoft, display:"block", marginBottom:6 }}>パスワード</label>
            <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{ width:"100%", height:52, padding:"0 48px 0 16px", border:`1px solid ${password && !pwValid ? "#E0A9A2" : c.line}`, borderRadius:14, fontSize:15, background:"#fff", color:c.ink }} />
              <button onClick={() => setShowPw((v) => !v)} type="button"
                style={{ position:"absolute", right:8, height:38, width:38, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", color:c.inkFaint, fontSize:16 }}>
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
            {password && !pwValid && <div style={{ fontSize:12, color:c.rec, marginTop:5 }}>パスワードは6文字以上で入力してください。</div>}
          </div>

          {/* パスワードを忘れた方 */}
          {mode === "login" && (
            <div style={{ textAlign:"right", marginBottom:16 }}>
              <button onClick={handleReset} type="button" style={{ background:"none", border:"none", cursor:"pointer", color:c.brand, fontSize:12, fontWeight:600, padding:0 }}>
                パスワードを忘れた方はこちら
              </button>
            </div>
          )}

          {error && <div style={{ background:"#FCEBEB", color:"#A32D2D", fontSize:13, padding:"10px 12px", borderRadius:10, marginBottom:14, lineHeight:1.6 }}>{error}</div>}
          {message && <div style={{ background:c.brandSoft, color:c.brand, fontSize:13, padding:"10px 12px", borderRadius:10, marginBottom:14, lineHeight:1.6 }}>{message}</div>}

          {/* 送信ボタン（ゴールド・状態制御つき） */}
          <button onClick={handleSubmit} disabled={!canSubmit} className="hov"
            style={{ width:"100%", height:54, border:"none", borderRadius:16, background: canSubmit ? `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})` : "#D8D3C8", color:"#fff", cursor: canSubmit ? "pointer" : "not-allowed", fontSize:15, fontWeight:700, letterSpacing:1, boxShadow: canSubmit ? "0 4px 14px rgba(184,134,59,.35)" : "none", transition:"all .2s ease" }}>
            {loading ? "処理中…" : mode === "login" ? "ログイン" : "アカウントを作成"}
          </button>

          <div style={{ textAlign:"center", marginTop:20, fontSize:11, color:c.inkFaint, lineHeight:1.7 }}>
            医療AIによる施術記録支援サービス
          </div>
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
  const [fieldKeys, setFieldKeys] = useState(DEFAULT_FIELD_KEYS);

  const token = session.access_token;
  const activePatient = patients.find((p) => p.id === activePatientId) || null;
  const sections = fieldsToSections(fieldKeys);

  useEffect(() => { loadPatients(); loadSettings(); }, []);

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

  async function loadSettings() {
    try {
      const data = await apiFetch("/api/settings", {}, token);
      if (data.karte_fields && data.karte_fields.length) setFieldKeys(data.karte_fields);
    } catch (e) { console.error(e); }
  }

  async function saveSettings(keys) {
    setFieldKeys(keys);
    try {
      await apiFetch("/api/settings", { method:"PUT", body: JSON.stringify({ karte_fields: keys }) }, token);
    } catch (e) { alert(e.message); }
  }

  async function addPatient(name, kana) {
    const data = await apiFetch("/api/patients", { method:"POST", body: JSON.stringify({ name, kana }) }, token);
    setPatients((prev) => [data.patient, ...prev]);
    return data.patient;
  }

  async function saveVisit(patientId, visit) {
    const data = await apiFetch("/api/visits", {
      method:"POST",
      body: JSON.stringify({ patient_id: patientId, date: visit.date, transcript: visit.transcript, karte: visit.karte, vas: visit.vas })
    }, token);
    setPatients((prev) => prev.map((p) =>
      p.id === patientId
        ? { ...p, visits: [data.visit, ...(p.visits || [])], insights: data.insights || p.insights }
        : p
    ));
    return data;
  }

  async function updateVisit(patientId, visitId, patch) {
    const data = await apiFetch(`/api/visits/${visitId}`, { method:"PATCH", body: JSON.stringify(patch) }, token);
    setPatients((prev) => prev.map((p) =>
      p.id === patientId
        ? { ...p, visits: (p.visits || []).map((v) => v.id === visitId ? { ...v, ...data.visit } : v) }
        : p
    ));
    return data;
  }

  async function deleteVisit(patientId, visitId) {
    await apiFetch(`/api/visits/${visitId}`, { method:"DELETE" }, token);
    setPatients((prev) => prev.map((p) =>
      p.id === patientId
        ? { ...p, visits: (p.visits || []).filter((v) => v.id !== visitId) }
        : p
    ));
  }

  function openNewSession(patient) { setActivePatientId(patient.id); setView("session"); }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <>
      <Header onHome={() => setView("home")} onStats={() => setView("stats")} onSettings={() => setView("settings")} onChat={() => setView("chat")} onLogout={handleLogout} email={session.user.email} />
      <div style={{ maxWidth:860, margin:"0 auto", padding:"0 20px 80px" }}>
        {dataLoading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:c.inkFaint }}>読み込み中…</div>
        ) : view === "home" ? (
          <Home patients={patients} query={query} setQuery={setQuery} token={token}
            onSelect={(p) => { setActivePatientId(p.id); setView("patient"); }}
            onNew={openNewSession} addPatient={addPatient} />
        ) : view === "session" && activePatient ? (
          <Session patient={activePatient} token={token} sections={sections}
            onCancel={() => setView("home")}
            onSaved={async (visit) => { return await saveVisit(activePatient.id, visit); }}
            onDone={() => setView("patient")} />
        ) : view === "patient" && activePatient ? (
          <PatientDetail patient={activePatient} token={token}
            onBack={() => setView("home")} onNew={() => openNewSession(activePatient)}
            onLevelUpdated={(lv) => setPatients((prev) => prev.map((p) => p.id === activePatient.id ? { ...p, level: lv } : p))}
            onUpdateVisit={(vid, patch) => updateVisit(activePatient.id, vid, patch)}
            onDeleteVisit={(vid) => deleteVisit(activePatient.id, vid)} />
        ) : view === "chat" ? (
          <ChatView token={token} onBack={() => setView("home")} />
        ) : view === "stats" ? (
          <StatsView token={token} onBack={() => setView("home")} />
        ) : view === "settings" ? (
          <SettingsView fieldKeys={fieldKeys} onSave={saveSettings} onBack={() => setView("home")} />
        ) : null}
      </div>
    </>
  );
}

// ── ヘッダー ──────────────────────────────────────────────────
function Header({ onHome, onStats, onSettings, onChat, onLogout, email }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ borderBottom:`1px solid ${c.line}`, background:"#fff", position:"sticky", top:0, zIndex:20 }}>
      <div style={{ maxWidth:860, margin:"0 auto", height:72, padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <button onClick={onHome} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
          <LogoMark size={44} variant="brand" />
          <div style={{ textAlign:"left", minWidth:0 }}>
            <div style={{ fontFamily:mincho, fontSize:22, fontWeight:700, letterSpacing:1, color:c.ink, whiteSpace:"nowrap", lineHeight:1.2 }}>音声カルテ</div>
            <div style={{ fontSize:10, letterSpacing:1.5, color:c.inkFaint, whiteSpace:"nowrap", lineHeight:1.2 }}>VOICE&nbsp;AI&nbsp;KARTE</div>
          </div>
        </button>

        {/* デスクトップ：横並び */}
        <div className="hdr-desktop" style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={onStats} className="hov" style={headerBtn}>📊 統計</button>
          <button onClick={onSettings} className="hov" style={headerBtn}>⚙ 設定</button>
          <button onClick={onChat} className="hov" style={headerBtn}>💬 AI相談</button>
          <button onClick={onLogout} className="hov" style={headerBtn}>⎋ ログアウト</button>
        </div>

        {/* モバイル：ハンバーガー */}
        <div className="hdr-mobile" style={{ position:"relative" }}>
          <button onClick={() => setMenuOpen((v) => !v)} className="hov" style={{ ...headerBtn, padding:"0 12px" }}>☰</button>
          {menuOpen && (
            <div style={{ position:"absolute", right:0, top:52, background:"#fff", border:`1px solid ${c.line}`, borderRadius:14, boxShadow:cardShadowLg, padding:6, minWidth:170, zIndex:30 }}>
              {[["📊", "統計", onStats], ["⚙", "設定", onSettings], ["💬", "AI相談", onChat], ["⎋", "ログアウト", onLogout]].map(([icon, label, fn]) => (
                <button key={label} onClick={() => { setMenuOpen(false); fn(); }} className="hov"
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", textAlign:"left", background:"none", border:"none", padding:"11px 12px", borderRadius:10, cursor:"pointer", fontSize:14, color:c.ink, fontWeight:500 }}>
                  <span style={{ width:22, textAlign:"center" }}>{icon}</span> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) { .hdr-desktop { display: none !important; } .hdr-mobile { display: block !important; } }
        @media (min-width: 641px) { .hdr-mobile { display: none !important; } }
      `}</style>
    </div>
  );
}
const headerBtn = { height:44, padding:"0 14px", display:"flex", alignItems:"center", gap:6, background:"#fff", border:`1px solid ${c.line}`, borderRadius:14, color:c.brand, cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" };

// ── ホーム ────────────────────────────────────────────────────
function Home({ patients, query, setQuery, onSelect, onNew, addPatient, token }) {
  const [showNew, setShowNew] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [name, setName] = useState("");
  const [kana, setKana] = useState("");
  const [creating, setCreating] = useState(false);

  const dropoutPatients = getDropoutRiskPatients(patients);

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

  // 直近患者（最終来院が新しい順）上位5名。検索中は絞り込み結果を全件表示
  const sortedByRecent = [...patients].sort((a, b) => {
    const da = daysSinceLastVisit(a); const db = daysSinceLastVisit(b);
    if (da === null) return 1; if (db === null) return -1;
    return da - db;
  });
  const displayed = query ? filtered : sortedByRecent.slice(0, 5);

  return (
    <div style={{ paddingTop:24 }}>
      {/* メインビジュアルカード（深緑背景） */}
      <div className="rise" style={{ position:"relative", background:`linear-gradient(140deg, ${c.brand} 0%, ${c.brandDeep} 100%)`, borderRadius:24, padding:"32px 28px", overflow:"hidden", boxShadow:cardShadowLg }}>
        <div style={{ position:"absolute", right:-10, top:"50%", transform:"translateY(-50%)", opacity:0.12 }}>
          <LogoMark size={150} variant="onDark" radius={30} />
        </div>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontFamily:mincho, fontSize:34, fontWeight:700, lineHeight:1.4, color:"#fff" }}>話すだけで、<br/>カルテになる。</div>
          <p style={{ color:"rgba(255,255,255,.8)", fontSize:15, marginTop:14, lineHeight:1.8 }}>施術中の会話をそのまま記録。<br/>AIが項目に整理して、確認・修正するだけ。</p>
        </div>
      </div>

      {dropoutPatients.length > 0 && (
        <FollowUpSection patients={dropoutPatients} token={token} onSelect={onSelect} />
      )}

      {/* 検索エリア */}
      <div style={{ marginTop:24, display:"flex", gap:12 }}>
        <div style={{ flex:"1 1 68%", position:"relative", display:"flex", alignItems:"center", background:"#fff", borderRadius:16, boxShadow:cardShadow }}>
          <span style={{ position:"absolute", left:16, fontSize:16, color:c.inkFaint }}>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="患者名・よみがなで検索"
            style={{ width:"100%", height:56, padding:"0 16px 0 42px", border:"none", borderRadius:16, fontSize:15, background:"transparent", color:c.ink }} />
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="hov"
          style={{ flex:"1 1 32%", height:56, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:`linear-gradient(135deg, ${c.accent}, ${c.accentDeep})`, color:"#fff", border:"none", borderRadius:16, cursor:"pointer", fontSize:15, fontWeight:700, boxShadow:"0 4px 14px rgba(184,134,59,.3)" }}>
          ＋ 新規患者
        </button>
      </div>

      {showNew && (
        <div className="rise" style={{ marginTop:12, padding:20, background:"#fff", borderRadius:18, boxShadow:cardShadow }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="氏名（必須）" style={inputS} />
            <input value={kana} onChange={(e) => setKana(e.target.value)} placeholder="よみがな" style={inputS} />
            <button onClick={handleCreate} className="hov" style={{ ...primaryBtn, opacity:creating ? 0.7 : 1 }}>
              {creating ? "登録中…" : "登録して施術を開始"}
            </button>
          </div>
        </div>
      )}

      {/* 患者一覧 */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16, color:c.brand }}>◷</span>
            <span style={{ fontSize:15, fontWeight:600, color:c.ink }}>{query ? "検索結果" : "最近の患者"}</span>
          </div>
          {!query && patients.length > 5 && (
            <button onClick={() => setShowAll(true)} className="hov" style={{ background:"none", border:"none", cursor:"pointer", color:c.brand, fontSize:14, fontWeight:600, padding:0 }}>
              すべての患者を見る ›
            </button>
          )}
        </div>

        {displayed.length === 0 && (
          <div style={{ color:c.inkFaint, fontSize:14, padding:"24px 0" }}>
            {patients.length === 0 ? "「＋ 新規患者」から最初の患者を登録してください。" : "該当する患者がいません。"}
          </div>
        )}

        <div style={{ display:"grid", gap:12 }}>
          {displayed.map((p) => <PatientCard key={p.id} patient={p} onSelect={onSelect} onNew={onNew} />)}
        </div>
      </div>

      {showAll && <AllPatientsModal patients={sortedByRecent} onClose={() => setShowAll(false)} onSelect={onSelect} onNew={onNew} />}
    </div>
  );
}

// ── 患者カード ────────────────────────────────────────────────
function PatientCard({ patient, onSelect, onNew }) {
  const visits = patient.visits || [];
  const last = visits[0];
  const initial = (patient.name || "?").trim().charAt(0);
  const levelInfo = LEVELS[patient.level || 2];
  const lastKarte = last?.karte || {};
  const symptom = lastKarte.chief_complaint || lastKarte.subjective || "";
  // 症状を短いタグに（最初の読点/句点/スペースまで、最大12文字）
  const symptomTag = symptom ? symptom.split(/[、。・\s]/)[0].slice(0, 12) : "";
  const daysSince = daysSinceLastVisit(patient);
  const isFollow = daysSince !== null && daysSince >= levelInfo.interval * 2;

  return (
    <div className="card-hov" style={{ position:"relative", background:"#fff", borderRadius:18, boxShadow:cardShadow, padding:"20px 20px 20px 24px", display:"flex", alignItems:"center", gap:16, overflow:"hidden" }}>
      {/* 左アクセントライン（レベル色） */}
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:5, background:levelInfo.color }} />
      <div style={{ width:52, height:52, minWidth:52, borderRadius:"50%", background:c.brandSoft, color:c.brand, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, fontFamily:mincho }}>{initial}</div>
      <button onClick={() => onSelect(patient)} style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", flex:1, padding:0, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:18, fontWeight:700, color:c.ink }}>{patient.name}</span>
          {symptomTag && <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:6, background:c.brandSoft, color:c.brand }}>{symptomTag}</span>}
          {isFollow && <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:6, background:"#FCEBEB", color:"#A32D2D" }}>要フォロー</span>}
        </div>
        <div style={{ fontSize:13, color:c.inkSoft, marginTop:5 }}>
          {patient.kana || "—"} ・ 来院 {visits.length} 回 ・ {last ? `最終 ${last.date}` : "未来院"}
        </div>
      </button>
      <button onClick={() => onNew(patient)} className="hov"
        style={{ height:42, width:130, minWidth:130, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"#fff", border:`1px solid ${c.line}`, borderRadius:12, color:c.brand, cursor:"pointer", fontSize:13, fontWeight:600 }}>
        施術を記録 ›
      </button>
    </div>
  );
}

// ── 全患者一覧モーダル ────────────────────────────────────────
function AllPatientsModal({ patients, onClose, onSelect, onNew }) {
  const [q, setQ] = useState("");
  const list = patients.filter((p) => !q || p.name.replace(/\s/g,"").includes(q.replace(/\s/g,"")) || (p.kana||"").includes(q));
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.35)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 16px", overflowY:"auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="rise" style={{ width:"100%", maxWidth:640, background:c.paper, borderRadius:20, padding:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontFamily:mincho, fontSize:22, fontWeight:700, color:c.ink }}>すべての患者（{patients.length}名）</div>
          <button onClick={onClose} className="hov" style={{ background:"none", border:"none", fontSize:22, color:c.inkFaint, cursor:"pointer" }}>×</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="患者名・よみがなで検索"
          style={{ width:"100%", height:48, padding:"0 16px", border:`1px solid ${c.line}`, borderRadius:14, fontSize:14, background:"#fff", color:c.ink, marginBottom:16 }} />
        <div style={{ display:"grid", gap:10 }}>
          {list.map((p) => <PatientCard key={p.id} patient={p} onSelect={(pt) => { onClose(); onSelect(pt); }} onNew={(pt) => { onClose(); onNew(pt); }} />)}
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

// ── フォーマット別ガイド（録音前に見る「聞くこと」チェックリスト）──
function FormatGuide({ format, sections = SECTIONS }) {
  const items = format === "soap" ? SOAP_SECTIONS : sections;
  return (
    <div style={{ marginTop:12, background:c.brand+"0D", border:`1px solid ${c.brand}33`, borderRadius:12, padding:"12px 16px" }}>
      <div style={{ fontSize:11, letterSpacing:1, color:c.brand, fontWeight:700, marginBottom:8 }}>
        この形式で聞く・確認すること
      </div>
      <div style={{ display:"grid", gap:6 }}>
        {items.map((s) => (
          <div key={s.key} style={{ display:"flex", gap:8, alignItems:"baseline" }}>
            <span style={{ fontFamily:mincho, fontSize:14, color:c.brand, minWidth:20 }}>{s.num}</span>
            <span style={{ fontSize:12, fontWeight:600, color:c.ink, minWidth:64 }}>{s.label}</span>
            <span style={{ fontSize:12, color:c.inkSoft }}>{s.q ? s.q + "／" : ""}{s.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Session({ patient, token, onCancel, onSaved, onDone, sections = SECTIONS }) {
  const [mode, setMode] = useState("voice");
  const [karteFormat, setKarteFormat] = useState("standard"); // standard | soap
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [karte, setKarte] = useState(null);
  const [vas, setVas] = useState(null);
  const [contraindication, setContraindication] = useState("");
  const [thanks, setThanks] = useState(null);
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
      const base = karteFormat === "soap" ? emptySoap() : emptyKarte(sections);
      setKarte({ ...base, ...data.karte });
      setVas(typeof data.vas === "number" ? data.vas : null);
      setContraindication(data.contraindication || "");
    } catch(e) { setError(`カルテ生成に失敗しました: ${e.message}`); }
    finally { setGenerating(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await onSaved({ date: todayStr(), transcript: (transcript + " " + interim).trim(), karte, vas });
      if (result && result.thanks) { setThanks(result.thanks); setSaving(false); }
    } catch(e) { setError(`保存に失敗しました: ${e.message}`); setSaving(false); }
  }

  const mmss = `${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}`;
  const visits = patient.visits || [];

  // 保存後：お礼メッセージ表示
  if (thanks !== null) {
    return <ThanksScreen patientName={patient.name} thanks={thanks} onDone={onDone} />;
  }

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
            <Toggle active={karteFormat==="standard"} onClick={() => setKarteFormat("standard")}>項目</Toggle>
            <Toggle active={karteFormat==="soap"} onClick={() => setKarteFormat("soap")}>SOAP</Toggle>
          </div>

          <FormatGuide format={karteFormat} sections={sections} />

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
          {contraindication && (
            <div style={{ marginBottom:16, background:"#FCEBEB", border:"2px solid #E24B4A", borderRadius:12, padding:16, display:"flex", gap:12, alignItems:"flex-start" }}>
              <span style={{ fontSize:22 }}>⚠️</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#A32D2D", marginBottom:4 }}>要注意：医療機関への紹介を検討してください</div>
                <div style={{ fontSize:13, color:"#791F1F", lineHeight:1.6 }}>{contraindication}</div>
              </div>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <SectionLabel>生成されたカルテ（確認・修正できます）</SectionLabel>
            <button onClick={() => { setKarte(null); setError(""); }} className="hov" style={ghostBtn}>↺ 入力に戻る</button>
          </div>
          <div style={{ display:"grid", gap:10, marginTop:14 }}>
            {(karteFormat === "soap" ? SOAP_SECTIONS : sections).map((s, i) => (
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

          {/* VAS痛みスコア */}
          <div style={{ marginTop:12, background:c.surface, border:`1px solid ${c.line}`, borderRadius:12, padding:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontWeight:700, fontSize:14, color:c.ink }}>痛みスコア（VAS）</span>
              <span style={{ fontSize:11, color:c.inkFaint }}>0＝なし 〜 10＝最大</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:10 }}>
              <input type="range" min="0" max="10" step="1"
                value={vas ?? 0}
                onChange={(e) => setVas(Number(e.target.value))}
                style={{ flex:1 }} />
              <span style={{ fontSize:20, fontWeight:600, color:c.brand, minWidth:52, textAlign:"right" }}>
                {vas ?? "—"}<span style={{ fontSize:12, color:c.inkFaint }}>/10</span>
              </span>
            </div>
            {vas === null && (
              <button onClick={() => setVas(5)} className="hov" style={{ ...ghostBtn, marginTop:8, fontSize:12, padding:"6px 12px" }}>
                痛みスコアを記録する
              </button>
            )}
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

function PatientDetail({ patient, token, onBack, onNew, onLevelUpdated, onUpdateVisit, onDeleteVisit }) {
  const visits = (patient.visits || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [openId, setOpenId] = useState(visits[0]?.id || null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const insights = patient.insights;
  const hasVas = visits.some((v) => typeof v.vas === "number");
  const shownVisits = showAllHistory ? visits : visits.slice(0, 3);

  return (
    <div style={{ paddingTop:24 }}>
      <BackRow onBack={onBack} label="ホームに戻る" />

      {/* 患者ヘッダー */}
      <div style={{ marginTop:16, display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontFamily:mincho, fontSize:36, fontWeight:700, color:c.ink, lineHeight:1.2 }}>{patient.name}</div>
          <div style={{ fontSize:16, color:c.inkSoft, marginTop:6 }}>{patient.kana || "—"} ・ 来院 {visits.length} 回</div>
        </div>
        <button onClick={onNew} className="hov"
          style={{ height:56, padding:"0 22px", background:c.brand, color:"#fff", border:`2px solid ${c.accent}`, borderRadius:16, cursor:"pointer", fontSize:15, fontWeight:700, boxShadow:"0 4px 14px rgba(15,75,62,.25)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:c.accent, fontSize:18 }}>●</span> 今日の施術を記録
        </button>
      </div>

      <div style={{ marginTop:16 }}>
        <LevelSelector patient={patient} token={token} onUpdated={onLevelUpdated} />
      </div>

      {/* 縦スクロール構成 */}
      {insights ? (
        <div style={{ display:"grid", gap:16, marginTop:24 }}>
          <AiSummaryCard insights={insights} patient={patient} />
          <TodayQuestionsCard insights={insights} />
          {hasVas && (
            <div style={{ background:"#fff", borderRadius:20, boxShadow:cardShadowLg, padding:24 }}>
              <div style={{ fontSize:18, fontWeight:700, color:c.ink, marginBottom:16, fontFamily:mincho }}>痛みの推移</div>
              <VasChart visits={visits} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ color:c.inkFaint, fontSize:14, padding:"30px 0" }}>カルテを記録すると、AIサマリーが自動生成されます。</div>
      )}

      {/* 来院履歴 */}
      <div style={{ marginTop:28 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ fontFamily:mincho, fontSize:20, fontWeight:700, color:c.ink }}>来院履歴</div>
          {visits.length > 3 && (
            <button onClick={() => setShowAllHistory((v) => !v)} className="hov" style={{ background:"none", border:"none", cursor:"pointer", color:c.brand, fontSize:14, fontWeight:600, padding:0 }}>
              {showAllHistory ? "折りたたむ ›" : "すべての履歴を見る ›"}
            </button>
          )}
        </div>
        {visits.length === 0 && <div style={{ color:c.inkFaint, fontSize:14, padding:"20px 0" }}>まだ記録がありません。</div>}
        <div style={{ display:"grid", gap:14 }}>
          {shownVisits.map((v) => (
            <VisitCard key={v.id} visit={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
              onUpdate={onUpdateVisit} onDelete={onDeleteVisit} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AIサマリーカード（ダークグリーン）─────────────────────────
function AiSummaryCard({ insights, patient }) {
  const s = insights.summary || {};
  const hasAlert = s.alert && s.alert.trim().length > 0;
  const rows = [
    ["主訴", s.chief_complaint_history],
    ["経過", s.last_treatment],
    ["生活・特徴", s.lifestyle],
    ["注意点", s.precautions],
  ].filter(([, v]) => v && v.trim());

  return (
    <div style={{ position:"relative", background:c.brand, borderRadius:20, padding:24, overflow:"hidden", boxShadow:cardShadowLg }}>
      {/* 装飾（透明度低め） */}
      <div style={{ position:"absolute", right:-20, bottom:-30, width:180, height:180, opacity:0.1, pointerEvents:"none" }}>
        <svg viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth="1.5">
          <circle cx="50" cy="26" r="12" /><line x1="50" y1="38" x2="50" y2="70" />
          <line x1="50" y1="46" x2="30" y2="60" /><line x1="50" y1="46" x2="70" y2="60" />
          <line x1="50" y1="70" x2="36" y2="92" /><line x1="50" y1="70" x2="64" y2="92" />
        </svg>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ background:"#fff", color:c.brand, fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:6, letterSpacing:1 }}>AI</span>
          <span style={{ color:"#fff", fontSize:18, fontWeight:600, fontFamily:mincho }}>AI要約サマリー</span>
        </div>
        <button onClick={() => exportSummaryPDF(patient)} className="hov"
          style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", color:"#fff", borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          📄 PDF
        </button>
      </div>

      {hasAlert && (
        <div style={{ background:"rgba(216,80,61,.25)", border:"1px solid rgba(255,180,170,.5)", borderRadius:10, padding:"10px 12px", marginBottom:16, fontSize:13, color:"#FFE3DE", lineHeight:1.6 }}>
          ⚠️ {s.alert}
        </div>
      )}

      <div style={{ display:"grid", gap:0, position:"relative", zIndex:1 }}>
        {rows.length === 0 && <div style={{ color:"rgba(255,255,255,.6)", fontSize:13 }}>情報が蓄積されると表示されます。</div>}
        {rows.map(([label, val], i) => (
          <div key={label} style={{ display:"flex", gap:14, padding:"12px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.15)" }}>
            <div style={{ minWidth:88, fontSize:13, fontWeight:600, color:"rgba(255,255,255,.85)" }}>{label}</div>
            <div style={{ fontSize:13, color:"#fff", lineHeight:1.7, flex:1 }}>{val}</div>
          </div>
        ))}
      </div>

      {insights.next_plan && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid rgba(255,255,255,.15)", position:"relative", zIndex:1 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,.7)", marginBottom:6 }}>次回施術プラン</div>
          <div style={{ fontSize:13, color:"#fff", lineHeight:1.7 }}>{insights.next_plan}</div>
        </div>
      )}
    </div>
  );
}

// ── 今日聞くことカード（ゴールドアクセント）───────────────────
function TodayQuestionsCard({ insights }) {
  const tq = insights.today_questions || {};
  const symptom = tq.symptom || [];
  const conversation = tq.conversation || [];
  if (symptom.length === 0 && conversation.length === 0) return null;

  return (
    <div style={{ position:"relative", background:"#fff", borderRadius:20, boxShadow:cardShadowLg, padding:24, borderLeft:`4px solid ${c.accent}`, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:c.accent, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18 }}>❝</div>
          <div style={{ fontFamily:mincho, fontSize:20, fontWeight:600, color:c.accentDeep }}>今日聞くこと</div>
        </div>
        <span style={{ fontSize:13, color:c.inkFaint }}>次回来院の確認ポイント</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:c.accentDeep, marginBottom:8 }}>症状について</div>
          <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:c.ink, lineHeight:2 }}>
            {symptom.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:c.accentDeep, marginBottom:8 }}>会話のきっかけ</div>
          <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:c.ink, lineHeight:2 }}>
            {conversation.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── 来院履歴カード（ヘッダーがダークグリーン）─────────────────
function VisitCard({ visit, open, onToggle, onUpdate, onDelete }) {
  const karte = visit.karte || {};
  const isSoap = isSoapKarte(karte);
  const sections = isSoap ? SOAP_SECTIONS : fieldsToSections(Object.keys(karte).filter((k) => ALL_FIELDS.some((f) => f.key === k)));
  const displaySections = sections.length ? sections : (isSoap ? SOAP_SECTIONS : SECTIONS);
  const preview = karte.chief_complaint || karte.subjective || "記録内容あり";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(karte);
  const [draftDate, setDraftDate] = useState(visit.date);
  const [draftVas, setDraftVas] = useState(visit.vas ?? null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onUpdate(visit.id, { date: draftDate, karte: draft, vas: draftVas });
      setEditing(false);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm("このカルテを削除しますか？この操作は取り消せません。")) return;
    try { await onDelete(visit.id); } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ background:"#fff", borderRadius:20, boxShadow:cardShadow, overflow:"hidden" }}>
      <button onClick={onToggle}
        style={{ width:"100%", minHeight:60, textAlign:"left", background:c.brand, border:"none", cursor:"pointer", padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{visit.date}</span>
          <span style={{ fontSize:12, color:"rgba(255,255,255,.8)" }}>{preview}</span>
          {typeof visit.vas === "number" && (
            <span style={{ fontSize:11, fontWeight:600, padding:"2px 10px", borderRadius:999, background:"rgba(255,255,255,.2)", color:"#fff" }}>痛み {visit.vas}/10</span>
          )}
        </div>
        <span style={{ color:"#fff", fontSize:18 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding:"16px 18px" }}>
          {!editing ? (
            <>
              <div style={{ display:"grid", gap:10 }}>
                {displaySections.map((s) => (
                  <div key={s.key} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:96 }}>
                      <span style={{ width:22, height:22, borderRadius:"50%", background:c.brand, color:"#fff", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:mincho }}>{s.num}</span>
                      <span style={{ fontSize:12, color:c.inkSoft, fontWeight:600 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize:13, color:c.ink, lineHeight:1.7, flex:1 }}>
                      {karte[s.key] || <span style={{ color:c.inkFaint }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
                <button onClick={() => { setDraft(karte); setDraftDate(visit.date); setDraftVas(visit.vas ?? null); setEditing(true); }} className="hov" style={{ ...ghostBtn, fontSize:12, padding:"7px 14px" }}>✎ 編集</button>
                <button onClick={remove} className="hov" style={{ ...ghostBtn, fontSize:12, padding:"7px 14px", color:c.rec, borderColor:"#F0B4AC" }}>🗑 削除</button>
              </div>
            </>
          ) : (
            <div style={{ display:"grid", gap:12 }}>
              <div>
                <div style={{ fontSize:12, color:c.inkSoft, fontWeight:600, marginBottom:4 }}>来院日</div>
                <input value={draftDate} onChange={(e) => setDraftDate(e.target.value)} style={{ ...inputS, flex:"unset", width:160 }} />
              </div>
              {displaySections.map((s) => (
                <div key={s.key}>
                  <div style={{ fontSize:12, color:c.inkSoft, fontWeight:600, marginBottom:4 }}>{s.num} {s.label}</div>
                  <textarea value={draft[s.key] || ""} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                    style={{ width:"100%", minHeight:44, padding:"8px 10px", border:`1px solid ${c.line}`, borderRadius:8, fontSize:13, lineHeight:1.6, background:"#fff", color:c.ink, resize:"vertical" }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize:12, color:c.inkSoft, fontWeight:600, marginBottom:4 }}>痛みスコア（VAS）: {draftVas ?? "—"}</div>
                <input type="range" min="0" max="10" step="1" value={draftVas ?? 0} onChange={(e) => setDraftVas(Number(e.target.value))} style={{ width:"100%" }} />
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={() => setEditing(false)} className="hov" style={{ ...ghostBtn, fontSize:12, padding:"8px 14px" }}>キャンセル</button>
                <button onClick={save} disabled={saving} className="hov" style={{ ...primaryBtn, fontSize:12, padding:"8px 16px", opacity:saving ? 0.7 : 1 }}>{saving ? "保存中…" : "保存"}</button>
              </div>
            </div>
          )}
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

const inputS = { flex:1, minWidth:140, padding:"13px 14px", border:`1px solid ${c.line}`, borderRadius:14, fontSize:14, background:"#fff", color:c.ink };
const primaryBtn = { padding:"13px 20px", border:"none", borderRadius:14, background:c.brand, color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 };
const ghostBtn = { padding:"10px 14px", border:`1px solid ${c.line}`, borderRadius:12, background:"#fff", color:c.brand, cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" };

// ── 要フォロー患者セクション（離脱リスク + LINE下書き）──────
function FollowUpSection({ patients, token, onSelect }) {
  const [draftFor, setDraftFor] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function makeDraft(patient) {
    setDraftFor(patient.id); setDraft(""); setLoading(true); setCopied(false);
    try {
      const data = await apiFetch("/api/line-draft", { method:"POST", body: JSON.stringify({ patient_id: patient.id }) }, token);
      setDraft(data.draft || "");
    } catch(e) { setDraft(`生成に失敗しました: ${e.message}`); }
    finally { setLoading(false); }
  }

  function copyDraft() {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function riskLevel(p) {
    const info = LEVELS[p.level || 2];
    const ratio = p.daysSince / info.interval;
    if (ratio >= 4) return { label: "離脱リスク高", color: "#A32D2D", bg: "#FCEBEB" };
    if (ratio >= 3) return { label: "要注意", color: "#854F0B", bg: "#FAEEDA" };
    return { label: "フォロー推奨", color: "#0F6E56", bg: "#E1F5EE" };
  }

  return (
    <div className="rise" style={{ marginTop:24, background:c.surface, border:`1px solid ${c.line}`, borderRadius:14, padding:18 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <span style={{ fontSize:16 }}>🔔</span>
        <SectionLabel>フォローすべき患者（{patients.length}名）</SectionLabel>
      </div>
      <div style={{ display:"grid", gap:10 }}>
        {patients.map((p) => {
          const risk = riskLevel(p);
          const info = LEVELS[p.level || 2];
          return (
            <div key={p.id} style={{ border:`1px solid ${c.line}`, borderRadius:10, padding:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <button onClick={() => onSelect(p)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:15, fontWeight:600, color:c.ink }}>{p.name}</button>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:6, background:risk.bg, color:risk.color }}>{risk.label}</span>
                  <span style={{ fontSize:10, color:info.color }}>{info.label}（{info.interval}日毎）</span>
                  <span style={{ fontSize:12, color:c.inkFaint }}>最終来院から {p.daysSince} 日</span>
                </div>
                <button onClick={() => makeDraft(p)} className="hov" style={{ ...ghostBtn, fontSize:12, padding:"7px 12px" }}>
                  ✉️ LINE文章を作成
                </button>
              </div>
              {draftFor === p.id && (
                <div style={{ marginTop:12 }}>
                  {loading ? (
                    <div style={{ fontSize:13, color:c.inkFaint }}>AIが文章を作成中…</div>
                  ) : (
                    <>
                      <div style={{ background:c.paper, borderRadius:8, padding:12, fontSize:13, lineHeight:1.7, color:c.ink, whiteSpace:"pre-wrap" }}>{draft}</div>
                      <button onClick={copyDraft} className="hov" style={{ ...primaryBtn, marginTop:8, fontSize:13, padding:"8px 14px" }}>
                        {copied ? "✓ コピーしました" : "📋 コピー"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VAS改善率グラフ ───────────────────────────────────────────
function VasChart({ visits }) {
  // 時系列（古い順）でvasがある来院のみ
  const points = [...visits]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .filter((v) => typeof v.vas === "number")
    .map((v) => ({ date: v.date, vas: v.vas }));

  if (points.length === 0) {
    return <div style={{ fontSize:13, color:c.inkFaint, padding:"16px 0" }}>痛みスコア（VAS）の記録がまだありません。カルテ生成時に会話から自動で記録されます。</div>;
  }

  const first = points[0].vas;
  const last = points[points.length - 1].vas;
  const improveRate = first > 0 ? Math.round(((first - last) / first) * 100) : 0;

  const W = 300, H = 120, pad = 24;
  const maxV = 10;
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const scaleY = (v) => H - pad - (v / maxV) * (H - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${scaleY(p.vas)}`).join(" ");

  return (
    <div>
      <div style={{ display:"flex", gap:20, marginBottom:16, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:11, color:c.inkFaint }}>初回</div>
          <div style={{ fontSize:22, fontWeight:600, color:c.ink }}>{first}<span style={{ fontSize:13, color:c.inkFaint }}>/10</span></div>
        </div>
        <div>
          <div style={{ fontSize:11, color:c.inkFaint }}>最新</div>
          <div style={{ fontSize:22, fontWeight:600, color:c.ink }}>{last}<span style={{ fontSize:13, color:c.inkFaint }}>/10</span></div>
        </div>
        <div>
          <div style={{ fontSize:11, color:c.inkFaint }}>改善率</div>
          <div style={{ fontSize:22, fontWeight:600, color:improveRate >= 0 ? c.brand : c.rec }}>{improveRate >= 0 ? "" : ""}{improveRate}%</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", maxWidth:W, height:"auto" }}>
        {[0, 5, 10].map((g) => (
          <g key={g}>
            <line x1={pad} y1={scaleY(g)} x2={W-pad} y2={scaleY(g)} stroke={c.line} strokeWidth="1" />
            <text x={pad-6} y={scaleY(g)+3} fontSize="9" fill={c.inkFaint} textAnchor="end">{g}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={c.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={pad + i * stepX} cy={scaleY(p.vas)} r="4" fill={c.brand} />
        ))}
      </svg>
      <div style={{ fontSize:11, color:c.inkFaint, marginTop:4 }}>※ 痛みスコアは会話からAIが自動抽出します（0＝痛みなし〜10＝最大）</div>
    </div>
  );
}

// ── AI相談チャット ────────────────────────────────────────────
function ChatView({ token, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const data = await apiFetch("/api/chat", { method:"POST", body: JSON.stringify({ messages: newMessages }) }, token);
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch(e) {
      setMessages([...newMessages, { role: "assistant", content: `エラー: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = ["五十肩の施術アプローチは？", "坐骨神経痛の原因と対処法", "頚椎の可動域評価の方法"];

  return (
    <div style={{ paddingTop:28 }}>
      <BackRow onBack={onBack} label="ホームに戻る" />
      <div style={{ marginTop:14, marginBottom:16 }}>
        <div style={{ fontFamily:mincho, fontSize:24, color:c.ink }}>AI相談</div>
        <div style={{ fontSize:13, color:c.inkSoft, marginTop:4 }}>症状・施術アプローチ・解剖学など、気になることをAIに相談できます。</div>
      </div>

      <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:14, padding:16, minHeight:340, display:"flex", flexDirection:"column" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:12, marginBottom:12 }}>
          {messages.length === 0 && (
            <div style={{ padding:"20px 0" }}>
              <div style={{ fontSize:13, color:c.inkFaint, marginBottom:12 }}>例えばこんな質問ができます：</div>
              <div style={{ display:"grid", gap:8 }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="hov"
                    style={{ textAlign:"left", background:c.paper, border:`1px solid ${c.line}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:c.ink, cursor:"pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth:"85%", padding:"10px 14px", borderRadius:12, fontSize:14, lineHeight:1.7, whiteSpace:"pre-wrap",
                background: m.role === "user" ? c.brand : c.paper,
                color: m.role === "user" ? "#fff" : c.ink }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div style={{ fontSize:13, color:c.inkFaint }}>AIが考えています…</div>}
          <div ref={endRef} />
        </div>

        <div style={{ display:"flex", gap:8, borderTop:`1px solid ${c.line}`, paddingTop:12 }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="質問を入力（Enterで送信）"
            style={{ flex:1, minHeight:44, maxHeight:120, padding:"10px 12px", border:`1px solid ${c.line}`, borderRadius:10, fontSize:14, lineHeight:1.6, background:c.paper, color:c.ink, resize:"vertical" }} />
          <button onClick={send} disabled={loading} className="hov" style={{ ...primaryBtn, padding:"0 18px", opacity:loading ? 0.7 : 1 }}>送信</button>
        </div>
      </div>
    </div>
  );
}

// ── 保存後のお礼メッセージ画面 ────────────────────────────────
function ThanksScreen({ patientName, thanks, onDone }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(thanks).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div style={{ paddingTop:40, textAlign:"center" }} className="rise">
      <div style={{ fontSize:44, marginBottom:12 }}>✓</div>
      <div style={{ fontFamily:mincho, fontSize:22, color:c.ink }}>カルテを保存しました</div>
      <div style={{ fontSize:13, color:c.inkSoft, marginTop:6 }}>{patientName}様の記録を追加しました。</div>

      <div style={{ maxWidth:520, margin:"28px auto 0", textAlign:"left", background:c.surface, border:`1px solid ${c.line}`, borderRadius:14, padding:18 }}>
        <SectionLabel>患者さまへのお礼メッセージ（AI生成）</SectionLabel>
        <div style={{ background:c.paper, borderRadius:10, padding:14, fontSize:14, lineHeight:1.7, color:c.ink, whiteSpace:"pre-wrap", marginTop:12 }}>{thanks}</div>
        <button onClick={copy} className="hov" style={{ ...primaryBtn, marginTop:12, fontSize:13, padding:"9px 16px" }}>
          {copied ? "✓ コピーしました" : "📋 コピーして送る"}
        </button>
      </div>

      <button onClick={onDone} className="hov" style={{ ...ghostBtn, marginTop:24 }}>患者ページへ →</button>
    </div>
  );
}

// ── 患者レベル設定 ────────────────────────────────────────────
function LevelSelector({ patient, token, onUpdated }) {
  const [level, setLevel] = useState(patient.level || 2);
  const [saving, setSaving] = useState(false);

  async function change(newLevel) {
    setLevel(newLevel); setSaving(true);
    try {
      await apiFetch(`/api/patients/${patient.id}`, { method:"PATCH", body: JSON.stringify({ level: newLevel }) }, token);
      onUpdated(newLevel);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
      <span style={{ fontSize:12, color:c.inkFaint }}>通院レベル：</span>
      {[1, 2, 3].map((lv) => {
        const info = LEVELS[lv];
        const active = level === lv;
        return (
          <button key={lv} onClick={() => change(lv)} disabled={saving} className="hov"
            style={{ padding:"6px 12px", borderRadius:999, border:`1px solid ${active ? info.color : c.line}`, background:active ? info.bg : c.surface, color:active ? info.color : c.inkFaint, cursor:"pointer", fontSize:12, fontWeight:600 }}>
            {info.label}・{info.desc}（{info.interval}日）
          </button>
        );
      })}
    </div>
  );
}

// ── サマリーPDF出力 ───────────────────────────────────────────
function exportSummaryPDF(patient) {
  const insights = patient.insights;
  const s = insights?.summary || {};
  const rows = [
    ["基本情報", s.basic_info],
    ["主訴・経過", s.chief_complaint_history],
    ["生活・特徴", s.lifestyle],
    ["注意点・禁忌", s.precautions],
    ["前回の施術ポイント・反応", s.last_treatment],
    ["セルフケア", s.self_care],
  ].filter(([, v]) => v && v.trim());

  const win = window.open("", "_blank");
  if (!win) { alert("ポップアップがブロックされました。許可してください。"); return; }
  const esc = (t) => String(t || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  win.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${esc(patient.name)}様 サマリー</title>
  <style>
    body { font-family: 'Hiragino Mincho ProN', serif; color: #26231E; padding: 40px; line-height: 1.8; }
    h1 { font-size: 22px; border-bottom: 2px solid #0F5E54; padding-bottom: 8px; }
    .meta { color: #6B655B; font-size: 13px; margin-bottom: 24px; }
    .row { margin-bottom: 16px; }
    .label { font-weight: bold; color: #0F5E54; font-size: 13px; }
    .val { font-size: 14px; margin-top: 4px; }
    .next { background: #E4EEEB; padding: 14px; border-radius: 8px; margin-top: 20px; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <h1>${esc(patient.name)} 様 施術サマリー</h1>
  <div class="meta">${esc(patient.kana || "")} ／ 来院 ${(patient.visits||[]).length} 回 ／ 発行日 ${todayStr()}</div>
  ${rows.map(([label, val]) => `<div class="row"><div class="label">${esc(label)}</div><div class="val">${esc(val)}</div></div>`).join("")}
  ${insights?.next_plan ? `<div class="next"><div class="label">次回施術プラン</div><div class="val">${esc(insights.next_plan)}</div></div>` : ""}
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── 統計・傾向分析ダッシュボード ──────────────────────────────
function StatsView({ token, onBack }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/stats", {}, token)
      .then((d) => setStats(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ paddingTop:40, textAlign:"center", color:c.inkFaint }}>集計中…</div>;
  if (error) return <div style={{ paddingTop:28 }}><BackRow onBack={onBack} label="ホームに戻る" /><div style={{ marginTop:20, color:c.rec }}>{error}</div></div>;

  const maxCount = Math.max(1, ...stats.monthlyTrend.map((m) => m.count));

  const cards = [
    { label: "登録患者数", value: stats.totalPatients, unit: "名" },
    { label: "累計来院数", value: stats.totalVisits, unit: "回" },
    { label: "アクティブ患者", value: stats.activePatients, unit: "名", sub: "30日以内に来院" },
    { label: "要フォロー", value: stats.dropoutPatients, unit: "名", sub: "離脱リスク", warn: stats.dropoutPatients > 0 },
    { label: "平均来院回数", value: stats.avgVisits, unit: "回/人" },
    { label: "平均改善率", value: stats.vasImprovement !== null ? stats.vasImprovement : "—", unit: stats.vasImprovement !== null ? "%" : "", sub: "VAS初回→最新" },
  ];

  return (
    <div style={{ paddingTop:24 }}>
      <BackRow onBack={onBack} label="ホームに戻る" />
      <div style={{ marginTop:16, marginBottom:20 }}>
        <div style={{ fontFamily:mincho, fontSize:32, fontWeight:700, color:c.ink }}>店舗の統計</div>
        <div style={{ fontSize:14, color:c.inkSoft, marginTop:6 }}>院全体の傾向を把握できます。</div>
      </div>

      {/* KPIカード */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:12 }}>
        {cards.map((k) => (
          <div key={k.label} style={{ background:"#fff", borderRadius:18, boxShadow:cardShadow, padding:18 }}>
            <div style={{ fontSize:12, color:c.inkSoft, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:30, fontWeight:700, color: k.warn ? c.rec : c.brand, fontFamily:mincho, lineHeight:1 }}>
              {k.value}<span style={{ fontSize:13, color:c.inkFaint, fontWeight:400, marginLeft:2 }}>{k.unit}</span>
            </div>
            {k.sub && <div style={{ fontSize:11, color:c.inkFaint, marginTop:6 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* 月別来院数グラフ */}
      <div style={{ marginTop:20, background:"#fff", borderRadius:20, boxShadow:cardShadowLg, padding:24 }}>
        <div style={{ fontSize:18, fontWeight:700, color:c.ink, marginBottom:20, fontFamily:mincho }}>月別来院数（直近6ヶ月）</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:12, height:180 }}>
          {stats.monthlyTrend.map((m) => (
            <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:c.brand }}>{m.count}</div>
              <div style={{ width:"100%", maxWidth:44, height:`${(m.count / maxCount) * 130}px`, minHeight:m.count > 0 ? 6 : 2, background: m.count > 0 ? c.brand : c.line, borderRadius:"8px 8px 0 0", transition:"height .3s ease" }} />
              <div style={{ fontSize:11, color:c.inkFaint }}>{m.month.split("/")[1]}月</div>
            </div>
          ))}
        </div>
      </div>

      {stats.avgVasFirst !== null && (
        <div style={{ marginTop:16, background:c.brandSoft, borderRadius:18, padding:20 }}>
          <div style={{ fontSize:13, color:c.brand, fontWeight:600, marginBottom:8 }}>痛みスコアの平均改善</div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ fontSize:15, color:c.ink }}>初回 平均 <b style={{ fontSize:24, fontFamily:mincho }}>{stats.avgVasFirst}</b></div>
            <span style={{ color:c.brand, fontSize:20 }}>→</span>
            <div style={{ fontSize:15, color:c.ink }}>最新 平均 <b style={{ fontSize:24, fontFamily:mincho, color:c.brand }}>{stats.avgVasLast}</b></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── カルテ項目カスタマイズ設定 ────────────────────────────────
function SettingsView({ fieldKeys, onSave, onBack }) {
  const [selected, setSelected] = useState(fieldKeys);
  const [saved, setSaved] = useState(false);

  function toggle(key) {
    setSaved(false);
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  function handleSave() {
    // ALL_FIELDSの順序を維持して保存
    const ordered = ALL_FIELDS.filter((f) => selected.includes(f.key)).map((f) => f.key);
    onSave(ordered.length ? ordered : DEFAULT_FIELD_KEYS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ paddingTop:24 }}>
      <BackRow onBack={onBack} label="ホームに戻る" />
      <div style={{ marginTop:16, marginBottom:8 }}>
        <div style={{ fontFamily:mincho, fontSize:32, fontWeight:700, color:c.ink }}>カルテ項目の設定</div>
        <div style={{ fontSize:14, color:c.inkSoft, marginTop:6, lineHeight:1.7 }}>
          院のスタイルに合わせて、カルテに表示する項目を選べます。録音時のガイドと生成カルテに反映されます。
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:20, boxShadow:cardShadow, padding:20, marginTop:16 }}>
        <div style={{ fontSize:12, color:c.inkFaint, marginBottom:14 }}>チェックした項目がカルテに含まれます（{selected.length}項目選択中）</div>
        <div style={{ display:"grid", gap:8 }}>
          {ALL_FIELDS.map((f) => {
            const on = selected.includes(f.key);
            return (
              <button key={f.key} onClick={() => toggle(f.key)} className="hov"
                style={{ display:"flex", alignItems:"center", gap:12, textAlign:"left", background: on ? c.brandSoft : "#fff", border:`1px solid ${on ? c.brand : c.line}`, borderRadius:12, padding:"12px 14px", cursor:"pointer" }}>
                <div style={{ width:22, height:22, minWidth:22, borderRadius:6, background: on ? c.brand : "#fff", border:`1px solid ${on ? c.brand : c.line}`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13 }}>{on ? "✓" : ""}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:c.ink }}>{f.label}</div>
                  <div style={{ fontSize:12, color:c.inkFaint, marginTop:2 }}>{f.hint}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background:c.brandSoft, borderRadius:14, padding:14, marginTop:14, fontSize:12, color:c.brand, lineHeight:1.7 }}>
        ℹ️ 痛みスコア（VAS）・SOAP形式・AI離脱リスク検知は、専用機能として常に有効です。カルテ生成時のトグルや患者ページで確認できます。
      </div>

      <button onClick={handleSave} className="hov" style={{ ...primaryBtn, width:"100%", marginTop:16, padding:15, fontSize:15 }}>
        {saved ? "✓ 保存しました" : "設定を保存"}
      </button>
    </div>
  );
}
