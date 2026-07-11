"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEvents, getFighters, getPrediction, getFighter, normalizeFighterList } from "@/lib/api";

function parseHeightToCm(height?: string | null): number | null {
  if (!height) return null;
  const s = String(height).toLowerCase().trim();
  // if already cm
  const cmMatch = s.match(/(\d+(?:\.\d+)?)\s?cm/);
  if (cmMatch) return Math.round(Number(cmMatch[1]));
  // feet/inches like 6'1" or 6 ft 1 in
  const ftInMatch = s.match(/(\d+)\s*'\s*(\d+)?|(?:(\d+)\s*ft(?:et)?\s*(\d+)?\s*in)?/i);
  if (ftInMatch) {
    // try to extract numbers
    const groups = s.match(/(\d+)\s*'\s*(\d+)?/);
    if (groups) {
      const ft = Number(groups[1]);
      const inch = Number(groups[2] || 0);
      return Math.round((ft * 12 + inch) * 2.54);
    }
    const g2 = s.match(/(\d+)\s*ft(?:et)?\s*(\d+)?\s*in/);
    if (g2) {
      const ft = Number(g2[1]);
      const inch = Number(g2[2] || 0);
      return Math.round((ft * 12 + inch) * 2.54);
    }
  }
  // fallback parse number
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(num) && num > 50) return Math.round(num); // likely cm
  return null;
}

function parseReachToInches(reach?: string | null): number | null {
  if (!reach) return null;
  const s = String(reach).toLowerCase().trim();
  const inMatch = s.match(/(\d+(?:\.\d+)?)\s?in|(\d+(?:\.\d+)?)\s?\"/);
  if (inMatch) return Math.round(Number(inMatch[1] || inMatch[2]));
  const cmMatch = s.match(/(\d+(?:\.\d+)?)\s?cm/);
  if (cmMatch) return Math.round(Number(cmMatch[1]) / 2.54);
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(num)) {
    if (num > 50) return Math.round(num / 2.54); // treat as cm
    return Math.round(num);
  }
  return null;
}

function formatHeightCm(height?: string | null) {
  const cm = parseHeightToCm(height);
  return cm ? `${cm} cm` : null;
}

function formatReachIn(reach?: string | null) {
  const inch = parseReachToInches(reach);
  return inch ? `${inch} in` : null;
}

function getLastFiveFromData(fdata: any): string | null {
  if (!fdata) return null;
  return (
    fdata?.last5 || fdata?.last_5 || fdata?.["last 5"] || fdata?.recent || fdata?.recent_form || fdata?.recent5 || null
  );
}

function getUfcRecordFromData(fdata: any, career?: any): string | null {
  // try multiple possible shapes where UFC-only record might be stored
  if (!fdata && !career) return null;
  const c = career ?? fdata?.career ?? fdata;
  if (c) {
    const wins = c?.ufc_wins ?? c?.ufcWins ?? c?.["ufc-wins"] ?? c?.ufc?.wins ?? null;
    const losses = c?.ufc_losses ?? c?.ufcLosses ?? c?.["ufc-losses"] ?? c?.ufc?.losses ?? null;
    const draws = c?.ufc_draws ?? c?.ufcDraws ?? c?.["ufc-draws"] ?? c?.ufc?.draws ?? null;
    if ((wins !== null && wins !== undefined) && (losses !== null && losses !== undefined)) {
      return `${wins}-${losses}${draws ? `-${draws}` : ""}`;
    }
    const rec = c?.ufc_record ?? c?.["ufc-only"] ?? c?.["ufc_record"] ?? c?.["UFC Record"] ?? c?.ufcRecord ?? null;
    if (rec) return rec;
  }

  // fallback: check top-level fdata keys
  const rec2 = fdata?.["ufc-only"] ?? fdata?.ufc_record ?? fdata?.["UFC Record"] ?? null;
  if (rec2) return rec2;
  return null;
}

function computeLastFiveRecord(fdata: any): string | null {
  if (!fdata) return null;
  // try career.last5 or top-level last5 keys
  const raw = fdata?.career?.['last-five'] ?? fdata?.career?.last5 ?? fdata?.career?.last_5 ?? fdata?.last5 ?? fdata?.last_5 ?? fdata?.recent5 ?? fdata?.recent ?? null;
  if (!raw) return null;
  let arr: number[] | null = null;
  if (Array.isArray(raw)) arr = raw.map((x) => Number(x));
  else if (typeof raw === 'string') {
    // try JSON
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) { arr = parsed.map((x) => Number(x)); } }
    catch (e) {
      // fallback: comma/space separated or digits
      if (raw.indexOf(',') !== -1) arr = raw.split(/[,\s]+/).map((s) => Number(s)).filter((n) => !Number.isNaN(n));
      else if (/^[0-9]+$/.test(raw)) arr = raw.split('').map((c) => Number(c));
      else arr = raw.split(/\s+/).map((s) => Number(s)).filter((n) => !Number.isNaN(n));
    }
  }
  if (!arr || arr.length === 0) return null;
  // interpret codes: 0=loss,1=win,2=draw,3=nc
  const wins = arr.filter((v) => v === 1).length;
  const losses = arr.filter((v) => v === 0).length;
  const draws = arr.filter((v) => v === 2).length;
  const ncs = arr.filter((v) => v === 3).length;
  let rec = `${wins} - ${losses}`;
  if (draws > 0) rec = `${rec} - ${draws}`;
  if (ncs > 0) rec = `${rec} (NC ${ncs})`;
  return rec;
}

const LAPIS_BLUE = "#3598d8";

type Fighter = {
  name: string;
  rank?: string;
  age?: number;
  reach?: string;
  height?: string;
  stance?: string;
};

type Fight = {
  fighter1: string;
  fighter2: string;
  rounds: number;
  weight_class?: string;
};

type PredictionResult = Record<string, unknown> & {
  "Fighter 1": string;
  "Fighter 2": string;
  "Fighter 1 Final Score": number;
  "Fighter 2 Final Score": number;
  Rounds: number;
  Winner: string;
  "Winning fighters Confidence": number;
  "Fighter 1 % of winning": number;
  "Fighter 2 % of winning": number;
  "Winners method of victory": string;
  "Winners method of victory %": number;
  "% of KO": number;
  "% of SUB": number;
  "% of DEC": number;
};

function displayNumber(value: unknown, decimals = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function formatPercent(value: unknown, decimals = 1) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toFixed(decimals)}%`;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.trim();
    if (normalized.endsWith("%")) return normalized;
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) return `${parsed.toFixed(decimals)}%`;
    return normalized;
  }
  return "—";
}

function formatConfidence(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.trim();
    if (normalized.endsWith("%")) return normalized;
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) return `${parsed.toFixed(1)}%`;
    return normalized;
  }
  return formatPercent(value, 1);
}

function toProbabilityPercent(value: unknown): number | null {
  if (typeof value === 'boolean') {
    return value ? 100 : 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) return Math.max(0, Math.min(100, value * 100));
    return Math.max(0, Math.min(100, value));
  }
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'yes' || s === 'true' || s === 'y') return 100;
    if (s === 'no' || s === 'false' || s === 'n') return 0;
    if (s.endsWith('%')) {
      const n = Number(s.slice(0, -1));
      if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n));
    }
    const n = Number(s);
    if (!Number.isNaN(n)) {
      if (n <= 1) return Math.max(0, Math.min(100, n * 100));
      return Math.max(0, Math.min(100, n));
    }
  }
  return null;
}

function prettyMethod(value: unknown) {
  if (!value && value !== 0) return "Unknown";
  const s = String(value).trim().toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("sub")) return "Submission";
  if (s.includes("ko") || s.includes("tko") || s.includes("knock")) return "Knockout";
  if (s.includes("dec")) return "Decision";
  return String(value);
}

function extractDistanceInfo(prediction: unknown) {
  let boolValue: boolean | null = null;
  let pctValue: number | null = null;

  if (prediction && typeof prediction === "object") {
    for (const [key, value] of Object.entries(prediction as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();
      if (!normalizedKey.includes("distance")) continue;

      if (typeof value === "boolean") {
        boolValue = value;
      }

      const pctCandidate = toProbabilityPercent(value);
      if (pctCandidate !== null) {
        pctValue = pctCandidate;
      }
    }
  }

  const distanceDisplay = pctValue ?? (boolValue === true ? 100 : boolValue === false ? 0 : null);
  const distanceLabel = boolValue === true ? "Yes" : boolValue === false ? "No" : "—";

  return { distanceLabel, distanceDisplay };
}

type EventData = {
  date: string;
  location: string;
  main_card?: Fight[];
  prelims?: Fight[];
};

export default function EventDetailPage() {
  const params = useParams();
  const eventName = decodeURIComponent(params.eventName as string);

  const [event, setEvent] = useState<EventData | null>(null);
  const [fighters, setFighters] = useState<Record<string, Fighter>>({});
  const [predictions, setPredictions] = useState<Record<string, PredictionResult | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState<Record<string, boolean>>({});
  const [predictionErrors, setPredictionErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([getEvents(), getFighters()])
      .then(([eventsData, fightersData]) => {
        const eventData = (eventsData as Record<string, unknown>)[eventName];
        if (!eventData || typeof eventData !== "object") {
          setError("Event not found");
          return;
        }
        setEvent(eventData as EventData);

        const fighterList = normalizeFighterList(fightersData);
        const fighterMap: Record<string, Fighter> = {};
        fighterList.forEach((f) => {
          const fighterName = String(f.name ?? "");
          fighterMap[fighterName] = f as Fighter;
        });
        setFighters(fighterMap);
      })
      .catch(() => setError("Failed to load event data"))
      .finally(() => setLoading(false));
  }, [eventName]);

  const handlePredict = async (fighter1: string, fighter2: string, fightKey: string) => {
    setPredicting((prev) => ({ ...prev, [fightKey]: true }));
    setPredictionErrors((prev) => ({ ...prev, [fightKey]: false }));
    try {
      const data = (await getPrediction(fighter1, fighter2)) as PredictionResult;
      // fetch full fighter records if available
      try {
        const [f1Full, f2Full] = await Promise.all([getFighter(fighter1), getFighter(fighter2)]);
        console.log(`Fighter 1 (${fighter1}):`, f1Full);
        console.log(`Fighter 2 (${fighter2}):`, f2Full);
        setFighters((prev) => ({ 
          ...prev, 
          [fighter1]: { ...(prev[fighter1] || {}), ...(f1Full as Record<string, any>) }, 
          [fighter2]: { ...(prev[fighter2] || {}), ...(f2Full as Record<string, any>) } 
        }));
      } catch (err) {
        console.error("Fighter fetch error:", err);
      }
      setPredictions((prev) => ({ ...prev, [fightKey]: data }));
    } catch (err) {
      console.error("Prediction fetch error:", err);
      setPredictionErrors((prev) => ({ ...prev, [fightKey]: true }));
      setPredictions((prev) => ({ ...prev, [fightKey]: null }));
    } finally {
      setPredicting((prev) => ({ ...prev, [fightKey]: false }));
    }
  };

  if (loading) return <main style={{ padding: "40px 24px", color: "var(--text)" }}>Loading event…</main>;
  if (error || !event) return <main style={{ padding: "40px 24px", color: "var(--text)" }}>Error: {error || "Event not found"}</main>;

  const allFights = [...(event.main_card || []), ...(event.prelims || [])];

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 24px", color: "var(--text)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Link href="/events" style={{ color: "var(--accent)", fontSize: "12px", letterSpacing: "2px", textDecoration: "none", marginBottom: "32px", display: "inline-block" }}>
          ← Back to events
        </Link>

        <div style={{ marginBottom: "40px", paddingBottom: "32px", borderBottom: "1px solid var(--border)" }}>
          <h1 className="title" style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 1, marginBottom: "16px", textTransform: "uppercase" }}>
            {eventName}
          </h1>
          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", color: "var(--muted2)", fontSize: "14px" }}>
            <div>
              <span style={{ color: "var(--muted)" }}>Date:</span> {event.date}
            </div>
            <div>
              <span style={{ color: "var(--muted)" }}>Location:</span> {event.location}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          {allFights.map((fight, index) => {
            const isMainCard = event.main_card && index < event.main_card.length;
            const fightKey = `${fight.fighter1}-${fight.fighter2}-${index}`;
            const f1Data = fighters[fight.fighter1];
            const f2Data = fighters[fight.fighter2];
            const prediction = predictions[fightKey];
            const winnerChance = prediction
              ? prediction.Winner === fight.fighter1
                ? prediction["Fighter 1 % of winning"]
                : prediction.Winner === fight.fighter2
                ? prediction["Fighter 2 % of winning"]
                : undefined
              : undefined;
            const f1FullName = (f1Data as any)?.full_name ?? (f1Data as any)?.["personal-info"]?.name ?? (f1Data as any)?.name ?? fight.fighter1;
            const f2FullName = (f2Data as any)?.full_name ?? (f2Data as any)?.["personal-info"]?.name ?? (f2Data as any)?.name ?? fight.fighter2;
            const f1Nickname = (f1Data as any)?.nickname ?? (f1Data as any)?.["personal-info"]?.nickname ?? null;
            const f2Nickname = (f2Data as any)?.nickname ?? (f2Data as any)?.["personal-info"]?.nickname ?? null;
            const f1DoB = (f1Data as any)?.["personal-info"]?.["birth-date"];
            const f2DoB = (f2Data as any)?.["personal-info"]?.["birth-date"];
            const f1Age = f1DoB ? new Date().getFullYear() - new Date(f1DoB).getFullYear() : null;
            const f2Age = f2DoB ? new Date().getFullYear() - new Date(f2DoB).getFullYear() : null;
            const f1Wins = (f1Data as any)?.["career"]?.wins;
            const f1Losses = (f1Data as any)?.["career"]?.losses;
            const f1Draws = (f1Data as any)?.["career"]?.draws;
            const f1Record = (f1Wins ?? f1Losses) ? `${f1Wins ?? 0}-${f1Losses ?? 0}${f1Draws ? `-${f1Draws}` : ""}` : null;
            const f1PersonalInfo = (f1Data as any)?.["personal-info"] ?? null;
            const f1Career = (f1Data as any)?.career ?? null;
            const f1Reach = (f1Data as any)?.reach ?? (f1PersonalInfo as any)?.reach ?? null;
            const f1Height = (f1Data as any)?.height ?? (f1PersonalInfo as any)?.height ?? null;
            const f1Stance = (f1Data as any)?.stance ?? (f1PersonalInfo as any)?.stance ?? null;
            const f2Wins = (f2Data as any)?.["career"]?.wins;
            const f2Losses = (f2Data as any)?.["career"]?.losses;
            const f2Draws = (f2Data as any)?.["career"]?.draws;
            const f2Record = (f2Wins ?? f2Losses) ? `${f2Wins ?? 0}-${f2Losses ?? 0}${f2Draws ? `-${f2Draws}` : ""}` : null;
            const f2PersonalInfo = (f2Data as any)?.["personal-info"] ?? null;
            const f2Career = (f2Data as any)?.career ?? null;
            const f2Reach = (f2Data as any)?.reach ?? (f2PersonalInfo as any)?.reach ?? null;
            const f2Height = (f2Data as any)?.height ?? (f2PersonalInfo as any)?.height ?? null;
            const f2Stance = (f2Data as any)?.stance ?? (f2PersonalInfo as any)?.stance ?? null;
            const { distanceLabel, distanceDisplay } = extractDistanceInfo(prediction);

            // prefer predictor-provided personal specs if present
            const predF1Age = (prediction as any)?.["Fighter 1 Age"] ?? null;
            const predF2Age = (prediction as any)?.["Fighter 2 Age"] ?? null;
            const predF1Height = (prediction as any)?.["Fighter 1 Height"] ?? null;
            const predF2Height = (prediction as any)?.["Fighter 2 Height"] ?? null;
            const predF1Reach = (prediction as any)?.["Fighter 1 Reach"] ?? null;
            const predF2Reach = (prediction as any)?.["Fighter 2 Reach"] ?? null;
            const predF1Stance = (prediction as any)?.["Fighter 1 Stance"] ?? null;
            const predF2Stance = (prediction as any)?.["Fighter 2 Stance"] ?? null;

            const displayF1Age = predF1Age ?? f1Age;
            const displayF2Age = predF2Age ?? f2Age;
            const displayF1Height = predF1Height ?? f1Height;
            const displayF2Height = predF2Height ?? f2Height;
            const displayF1Reach = predF1Reach ?? f1Reach;
            const displayF2Reach = predF2Reach ?? f2Reach;
            const displayF1Stance = predF1Stance ?? f1Stance;
            const displayF2Stance = predF2Stance ?? f2Stance;
            // prefer per-fighter method probabilities that the predictor may return
            const predF1KO = toProbabilityPercent((prediction as any)?.["Fighter 1 % KO"] ?? (prediction as any)?.["Fighter 1 % of KO"] ?? null);
            const predF1SUB = toProbabilityPercent((prediction as any)?.["Fighter 1 % SUB"] ?? null);
            const predF1DEC = toProbabilityPercent((prediction as any)?.["Fighter 1 % DEC"] ?? null);
            const predF2KO = toProbabilityPercent((prediction as any)?.["Fighter 2 % KO"] ?? (prediction as any)?.["Fighter 2 % of KO"] ?? null);
            const predF2SUB = toProbabilityPercent((prediction as any)?.["Fighter 2 % SUB"] ?? null);
            const predF2DEC = toProbabilityPercent((prediction as any)?.["Fighter 2 % DEC"] ?? null);

            const baseKO = toProbabilityPercent(prediction?.["% of KO"] ?? null);
            const baseSUB = toProbabilityPercent(prediction?.["% of SUB"] ?? null);
            const baseDEC = toProbabilityPercent(prediction?.["% of DEC"] ?? null);
            const f1WinPct = toProbabilityPercent(prediction?.["Fighter 1 % of winning"] ?? prediction?.["F1 % of winning"] ?? null) ?? (prediction?.Winner === fight.fighter1 ? 100 : 0);
            const f2WinPct = toProbabilityPercent(prediction?.["Fighter 2 % of winning"] ?? prediction?.["F2 % of winning"] ?? null) ?? (prediction?.Winner === fight.fighter2 ? 100 : 0);

            const f1_ko = predF1KO != null ? Math.round(predF1KO * 10) / 10 : (baseKO != null ? Math.round((baseKO * (f1WinPct / 100)) * 10) / 10 : null);
            const f1_sub = predF1SUB != null ? Math.round(predF1SUB * 10) / 10 : (baseSUB != null ? Math.round((baseSUB * (f1WinPct / 100)) * 10) / 10 : null);
            const f1_dec = predF1DEC != null ? Math.round(predF1DEC * 10) / 10 : (baseDEC != null ? Math.round((baseDEC * (f1WinPct / 100)) * 10) / 10 : null);

            const f2_ko = predF2KO != null ? Math.round(predF2KO * 10) / 10 : (baseKO != null ? Math.round((baseKO * (f2WinPct / 100)) * 10) / 10 : null);
            const f2_sub = predF2SUB != null ? Math.round(predF2SUB * 10) / 10 : (baseSUB != null ? Math.round((baseSUB * (f2WinPct / 100)) * 10) / 10 : null);
            const f2_dec = predF2DEC != null ? Math.round(predF2DEC * 10) / 10 : (baseDEC != null ? Math.round((baseDEC * (f2WinPct / 100)) * 10) / 10 : null);

            return (
              <article key={fightKey} style={{ border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", background: "#0f1218" }}>
                <div style={{ padding: "24px", background: isMainCard ? "rgba(204,0,0,0.1)" : "rgba(100,100,100,0.03)", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: isMainCard ? "var(--accent)" : "var(--muted)" }}>
                    {isMainCard ? "Main Card" : "Preliminary Card"}
                    {fight.weight_class && ` • ${fight.weight_class}`}
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 className="title" style={{ fontSize: "28px", textTransform: "uppercase", lineHeight: 1 }}>
                      {fight.fighter1} <span style={{ color: "var(--muted)", fontSize: "20px" }}>vs</span> {fight.fighter2}
                    </h2>
                    <div style={{ color: "var(--muted)", fontSize: "12px", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px" }}>
                      {fight.rounds}R
                    </div>
                  </div>
                </div>

                {/* fighter summary boxes removed — fight winner shown first */}

                {!prediction && (
                  <div style={{ padding: "24px", borderTop: "1px solid var(--border)" }}>
                    <button
                      onClick={() => handlePredict(fight.fighter1, fight.fighter2, fightKey)}
                      disabled={predicting[fightKey]}
                      style={{
                        padding: "12px 24px",
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        opacity: predicting[fightKey] ? 0.5 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      {predicting[fightKey] ? "Predicting…" : "Get Prediction"}
                    </button>
                    {predictionErrors[fightKey] && (
                      <div style={{ marginTop: "12px", fontSize: "12px", color: "#ff8e8e", fontStyle: "italic" }}>
                        Sorry, this fight cannot be predicted yet
                      </div>
                    )}
                  </div>
                )}

                {prediction && (() => {
                  try {
                    return (
                  <div style={{ padding: "24px", borderTop: "1px solid var(--border)", background: "rgba(200,200,0,0.04)" }}>
                    <div style={{ marginBottom: "24px", display: "grid", gap: "20px" }}>
                      <div style={{ padding: "22px", borderRadius: "18px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: "var(--accent)", marginBottom: "12px" }}>Fight Winner</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "18px", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>{String(prediction.Winner || "Unknown")}</div>
                            <div style={{ fontSize: "16px", color: "var(--muted)", marginBottom: "8px" }}>Win probability</div>
                            <div style={{ fontSize: "40px", fontWeight: 900, color: "var(--accent)", letterSpacing: "-1px" }}>{formatPercent(winnerChance, 1)}</div>
                          </div>
                          <div style={{ padding: "22px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", minWidth: "360px" }}>
                            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: "var(--muted)", marginBottom: "10px" }}>Confidence</div>
                            <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text)" }}>{formatConfidence(prediction["Winning fighters Confidence"])}</div>
                            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: "var(--muted)", marginTop: "16px" }}>Predicted method</div>
                            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>{prettyMethod(prediction["Winners method of victory"])}</div>
                            <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "8px" }}>{formatPercent(prediction["Winners method of victory %"], 1)}</div>
                          </div>
                        </div>
                      </div>

                        <div style={{ display: "grid", gap: "16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                          <div style={{ padding: "20px", borderRadius: "14px", background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.15)" }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase" }}>{f1FullName}</div>
                            <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
                              {
                                (() => {
                                  const parts: string[] = [];
                                  if (f1Nickname) parts.push(`"${f1Nickname}"`);
                                  if (displayF1Age) parts.push(`${displayF1Age}yo`);
                                  const h = formatHeightCm(displayF1Height);
                                  if (h) parts.push(h);
                                  const r = displayF1Reach ? formatReachIn(displayF1Reach) : null;
                                  if (r) parts.push(r);
                                  return parts.map((p, i) => (
                                    <span key={i}>{i > 0 && <span style={{ opacity: 0.45, margin: '0 8px' }}>•</span>}{p}</span>
                                  ));
                                })()
                              }
                            </div>
                            <div style={{ fontSize: "40px", fontWeight: 700, color: "var(--accent)", marginTop: "12px" }}>
                              {displayNumber(prediction["Fighter 1 Final Score"], 2)}
                            </div>
                            <div style={{ fontSize: "14px", color: "var(--text)", marginTop: "10px", fontWeight: 900 }}>{formatPercent(prediction["Fighter 1 % of winning"], 1)} win chance</div>
                            <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "16px" }}>
                              <div>Record: <strong style={{ color: 'var(--text)' }}>{f1Record ?? '—'}</strong></div>
                              <div>UFC Only Record: <strong style={{ color: 'var(--text)' }}>{String(getUfcRecordFromData(f1Data, f1Career) ?? '—')}</strong></div>
                              <div>Last 5: <strong style={{ color: 'var(--text)' }}>{String(computeLastFiveRecord(f1Career) ?? computeLastFiveRecord(f1Data) ?? '—')}</strong></div>
                              <div>Stance: <strong style={{ color: 'var(--text)' }}>{displayF1Stance ?? '—'}</strong></div>
                            </div>
                          </div>
                          <div style={{ padding: "20px", borderRadius: "14px", background: "rgba(53,152,216,0.08)", border: "1px solid rgba(53,152,216,0.18)" }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: LAPIS_BLUE }}>{f2FullName}</div>
                            <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
                              {
                                (() => {
                                  const parts: string[] = [];
                                  if (f2Nickname) parts.push(`"${f2Nickname}"`);
                                  if (displayF2Age) parts.push(`${displayF2Age}yo`);
                                  const h = formatHeightCm(displayF2Height);
                                  if (h) parts.push(h);
                                  const r = displayF2Reach ? formatReachIn(displayF2Reach) : null;
                                  if (r) parts.push(r);
                                  return parts.map((p, i) => (
                                    <span key={i}>{i > 0 && <span style={{ opacity: 0.45, margin: '0 8px' }}>•</span>}{p}</span>
                                  ));
                                })()
                              }
                            </div>
                            <div style={{ fontSize: "40px", fontWeight: 700, color: LAPIS_BLUE, marginTop: "12px" }}>
                              {displayNumber(prediction["Fighter 2 Final Score"], 2)}
                            </div>
                            <div style={{ fontSize: "14px", color: "var(--text)", marginTop: "10px", fontWeight: 900 }}>{formatPercent(prediction["Fighter 2 % of winning"], 1)} win chance</div>
                            <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "16px" }}>
                              <div>Record: <strong style={{ color: 'var(--text)' }}>{f2Record ?? '—'}</strong></div>
                              <div>UFC Only Record: <strong style={{ color: 'var(--text)' }}>{String(getUfcRecordFromData(f2Data, f2Career) ?? '—')}</strong></div>
                              <div>Last 5: <strong style={{ color: 'var(--text)' }}>{String(computeLastFiveRecord(f2Career) ?? computeLastFiveRecord(f2Data) ?? '—')}</strong></div>
                              <div>Stance: <strong style={{ color: 'var(--text)' }}>{displayF2Stance ?? '—'}</strong></div>
                            </div>
                          </div>
                        </div>
                        
                      </div>

                      {/* Fighter comparison block with radar chart */}
                      <div style={{ display: "grid", gap: "16px" }}>
                        <div style={{ display: "flex", gap: "20px", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ flex: 1, padding: "16px", borderRadius: "14px", background: "rgba(204,0,0,0.06)", border: "1px solid rgba(204,0,0,0.12)" }}>
                            <div style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase" }}>{f1FullName}</div>
                            {f1Nickname && <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "4px", fontStyle: "italic" }}>&quot;{f1Nickname}&quot;</div>}
                            <div style={{ marginTop: "12px", display: "grid", gap: "8px", fontSize: "12px", justifyItems: "center" }}>
                              <div style={{ fontSize: "11px", textAlign: "center", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Method chances</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", width: "100%" }}>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", aspectRatio: "1 / 1", minHeight: "100px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>KO/TKO</div>
                                  <div style={{ fontSize: "16px", fontWeight: 900 }}>{f1_ko != null ? `${f1_ko}%` : '—'}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", aspectRatio: "1 / 1", minHeight: "100px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>SUB</div>
                                  <div style={{ fontSize: "16px", fontWeight: 900 }}>{f1_sub != null ? `${f1_sub}%` : '—'}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", aspectRatio: "1 / 1", minHeight: "100px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>DEC</div>
                                  <div style={{ fontSize: "16px", fontWeight: 900 }}>{f1_dec != null ? `${f1_dec}%` : '—'}</div>
                                </div>
                              </div>
                              {!f1Age && !f1Record && !f1Reach && <div style={{ color: "var(--muted)", fontSize: "10px", lineHeight: 1.4 }}>personal-info: {JSON.stringify(Object.keys(f1PersonalInfo || {}))}<br/>career: {JSON.stringify(Object.keys(f1Career || {}))}</div>}
                            </div>
                          </div>

                          <div style={{ width: "320px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                            {/* Simple radar chart */}
                            <svg width={280} height={280} viewBox="0 0 300 300">
                              <defs>
                                <linearGradient id="radarFill" x1="0" x2="1">
                                  <stop offset="0%" stopColor="rgba(204,0,0,0.25)" />
                                  <stop offset="100%" stopColor="rgba(53,152,216,0.25)" />
                                </linearGradient>
                              </defs>
                              {/* axes */}
                              {/* compute points in JS via template literals */}
                              {
                                (() => {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const attrs = ["Striking", "Grappling", "Clinch", "Intangibles", "Condition"];
                                  const radar1Obj = (prediction as any)["Fighter 1 Radar"] ?? (prediction as any)["F1 Radar"] ?? null;
                                  const radar2Obj = (prediction as any)["Fighter 2 Radar"] ?? (prediction as any)["F2 Radar"] ?? null;
                                  const cx = 150, cy = 150, r = 100;
                                  const toVal = (v: any) => {
                                    if (typeof v === 'number') {
                                      // values are 0-10, but realistic range is 5-10 — map 5->0, 10->1
                                      return Math.max(0, Math.min(1, (v - 5) / 5));
                                    }
                                    if (typeof v === 'string') {
                                      const n = Number(String(v).replace('%', ''));
                                      if (!Number.isNaN(n)) return Math.max(0, Math.min(1, (n - 5) / 5));
                                    }
                                    return 0;
                                  };

                                  let f1Vals = attrs.map((a) => {
                                    if (radar1Obj && typeof radar1Obj === 'object') {
                                      if (a === 'Condition') {
                                          return toVal((radar1Obj as any)['Condition Score'] ?? (radar1Obj as any)['Condition'] ?? (radar1Obj as any)['Specs Score'] ?? (radar1Obj as any)['Specs']);
                                        }
                                      return toVal((radar1Obj as any)[a] ?? (radar1Obj as any)[a + ' Score']);
                                    }
                                    return toVal((prediction as any)[`Fighter 1 ${a}`] ?? (prediction as any)[`F1 ${a}`] ?? (prediction as any)[a + " 1"]);
                                  });

                                  // fallback: derive rough skillset from career wins/losses and last-5 if radar data missing
                                  if (f1Vals.every((v) => v === 0)) {
                                    const wins = Number(f1Career?.wins ?? f1Career?.win ?? 0);
                                    const losses = Number(f1Career?.losses ?? f1Career?.loss ?? 0);
                                    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0.5;
                                    let baseScore = 5 + (winRate - 0.5) * 5; // 0-10 scale
                                    const last5Raw = String(getLastFiveFromData(f1Career) ?? "");
                                    let last5Wins = 0;
                                    const dashMatch = last5Raw.match(/(\d+)\s*-\s*(\d+)/);
                                    if (dashMatch) last5Wins = Number(dashMatch[1]);
                                    else last5Wins = (last5Raw.match(/w/gi) || []).length || 0;
                                    const lastAdj = (last5Wins - 2.5) * 0.6; // small adjustment
                                    const deltas = [0.6, -0.1, -0.05, 0.1, 0.0];
                                    f1Vals = attrs.map((_, i) => {
                                      const score = Math.max(0, Math.min(10, baseScore + deltas[i] + lastAdj));
                                      return Math.max(0, Math.min(1, (score - 5) / 5));
                                    });
                                  }

                                  let f2Vals = attrs.map((a) => {
                                    if (radar2Obj && typeof radar2Obj === 'object') {
                                      if (a === 'Condition') {
                                          return toVal((radar2Obj as any)['Condition Score'] ?? (radar2Obj as any)['Condition'] ?? (radar2Obj as any)['Specs Score'] ?? (radar2Obj as any)['Specs']);
                                        }
                                      return toVal((radar2Obj as any)[a] ?? (radar2Obj as any)[a + ' Score']);
                                    }
                                    return toVal((prediction as any)[`Fighter 2 ${a}`] ?? (prediction as any)[`F2 ${a}`] ?? (prediction as any)[a + " 2"]);
                                  });

                                  if (f2Vals.every((v) => v === 0)) {
                                    const wins = Number(f2Career?.wins ?? f2Career?.win ?? 0);
                                    const losses = Number(f2Career?.losses ?? f2Career?.loss ?? 0);
                                    const winRate = wins + losses > 0 ? wins / (wins + losses) : 0.5;
                                    let baseScore = 5 + (winRate - 0.5) * 5;
                                    const last5Raw = String(getLastFiveFromData(f2Career) ?? "");
                                    let last5Wins = 0;
                                    const dashMatch = last5Raw.match(/(\d+)\s*-\s*(\d+)/);
                                    if (dashMatch) last5Wins = Number(dashMatch[1]);
                                    else last5Wins = (last5Raw.match(/w/gi) || []).length || 0;
                                    const lastAdj = (last5Wins - 2.5) * 0.6;
                                    const deltas = [0.6, -0.1, -0.05, 0.1, 0.0];
                                    f2Vals = attrs.map((_, i) => {
                                      const score = Math.max(0, Math.min(10, baseScore + deltas[i] + lastAdj));
                                      return Math.max(0, Math.min(1, (score - 5) / 5));
                                    });
                                  }

                                  const points = (vals: number[]) => vals.map((v, i) => {
                                    const angle = (Math.PI * 2 * i) / vals.length - Math.PI / 2;
                                    const px = cx + Math.cos(angle) * r * v;
                                    const py = cy + Math.sin(angle) * r * v;
                                    return `${px},${py}`;
                                  }).join(' ');

                                  return (
                                    <g>
                                      {/* grid */}
                                      {[0.25,0.5,0.75,1].map((gValue) => (
                                        <polygon key={String(gValue)} points={points(new Array(attrs.length).fill(gValue))} fill="none" stroke="rgba(255,255,255,0.04)" />
                                      ))}
                                      {/* axes lines */}
                                      {attrs.map((_, i) => {
                                        const angle = (Math.PI * 2 * i) / attrs.length - Math.PI / 2;
                                        const x = cx + Math.cos(angle) * r;
                                        const y = cy + Math.sin(angle) * r;
                                        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.03)" />;
                                      })}
                                      {/* f1 polygon */}
                                      <polygon points={points(f1Vals)} fill="rgba(204,0,0,0.18)" stroke="rgba(204,0,0,0.7)" />
                                      {/* f2 polygon */}
                                      <polygon points={points(f2Vals)} fill="rgba(53,152,216,0.12)" stroke="rgba(53,152,216,0.7)" />
                                      {/* no point markers */}
                                      {/* labels */}
                                      {attrs.map((label, i) => {
                                        const angle = (Math.PI * 2 * i) / attrs.length - Math.PI / 2;
                                        const lx = cx + Math.cos(angle) * (r + 18);
                                        const ly = cy + Math.sin(angle) * (r + 18);
                                        return <text key={i} x={lx} y={ly} fontSize={11} fill="var(--muted)" textAnchor="middle" alignmentBaseline="middle">{label}</text>;
                                      })}
                                    </g>
                                  );
                                })()
                              }
                            </svg>
                          </div>

                          <div style={{ flex: 1, padding: "16px", borderRadius: "14px", background: "rgba(53,152,216,0.06)", border: "1px solid rgba(53,152,216,0.12)" }}>
                            <div style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: LAPIS_BLUE }}>{f2FullName}</div>
                            {f2Nickname && <div style={{ fontSize: "11px", color: LAPIS_BLUE, marginTop: "4px", fontStyle: "italic" }}>&quot;{f2Nickname}&quot;</div>}
                            <div style={{ marginTop: "12px", display: "grid", gap: "8px", fontSize: "12px", justifyItems: "center" }}>
                              <div style={{ fontSize: "11px", textAlign: "center", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Method chances</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", width: "100%" }}>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", aspectRatio: "1 / 1", minHeight: "100px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>KO/TKO</div>
                                  <div style={{ fontSize: "16px", fontWeight: 900 }}>{f2_ko != null ? `${f2_ko}%` : '—'}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", aspectRatio: "1 / 1", minHeight: "100px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>SUB</div>
                                  <div style={{ fontSize: "16px", fontWeight: 900 }}>{f2_sub != null ? `${f2_sub}%` : '—'}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", aspectRatio: "1 / 1", minHeight: "100px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>DEC</div>
                                  <div style={{ fontSize: "16px", fontWeight: 900 }}>{f2_dec != null ? `${f2_dec}%` : '—'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: "24px", borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px", alignItems: "start" }}>
                            <div style={{ display: "grid", gap: "8px", alignItems: "center", justifyItems: "center", textAlign: "center" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "var(--muted)" }}>Will it go distance?</div>
                              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", width: "120px", minWidth: "120px", aspectRatio: "1 / 1", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--text)" }}>{distanceLabel}</div>
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: "8px", justifyItems: "center", textAlign: "center" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "var(--muted)" }}>Chance to go distance</div>
                              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", width: "120px", minWidth: "120px", aspectRatio: "1 / 1", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--text)" }}>{formatPercent(distanceDisplay as unknown, 1)}</div>
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: "8px", alignItems: "center", justifyItems: "center", textAlign: "center" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Method of victory</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", width: "100%" }}>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", aspectRatio: "1 / 1", minHeight: "110px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>KO/TKO</div>
                                  <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--text)" }}>{formatPercent(baseKO, 1)}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", aspectRatio: "1 / 1", minHeight: "110px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Submission</div>
                                  <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--text)" }}>{formatPercent(baseSUB, 1)}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", aspectRatio: "1 / 1", minHeight: "110px", display: "grid", alignItems: "center", justifyItems: "center", padding: "14px" }}>
                                  <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Decision</div>
                                  <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--text)" }}>{formatPercent(baseDEC, 1)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setPredictions((prev) => ({ ...prev, [fightKey]: null }))}
                      style={{
                        padding: "10px 20px",
                        background: "transparent",
                        color: "var(--muted)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "12px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                      }}
                    >
                      Clear prediction
                    </button>
                  </div>
                    );
                  } catch (err) {
                    console.error("Prediction render error:", err);
                    setPredictionErrors((prev) => ({ ...prev, [fightKey]: true }));
                    setPredictions((prev) => ({ ...prev, [fightKey]: null }));
                    return (
                      <div style={{ padding: "24px", borderTop: "1px solid var(--border)" }}>
                        <button
                          onClick={() => handlePredict(fight.fighter1, fight.fighter2, fightKey)}
                          style={{
                            padding: "12px 24px",
                            background: "var(--accent)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 700,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                          }}
                        >
                          Try again
                        </button>
                        <div style={{ marginTop: "12px", fontSize: "12px", color: "#ff8e8e", fontStyle: "italic" }}>
                          Sorry, this fight cannot be predicted yet
                        </div>
                      </div>
                    );
                  }
                })()}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
