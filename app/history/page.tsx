"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPredictionStats, getPredictions, type PredictionItem, type PredictionStatsResponse } from "@/lib/api";

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatMethod(value?: string | null) {
  if (!value) return "—";
  return value;
}

function getOutcomeBadge(prediction: PredictionItem) {
  if (prediction.status !== "resolved") {
    return { label: "Pending", color: "#f4b942", background: "rgba(244, 185, 66, 0.16)", border: "1px solid rgba(244, 185, 66, 0.16)" };
  }

  if (prediction.winner_correct) {
    return { label: "Correct", color: "#4fd1c5", background: "rgba(79, 209, 197, 0.14)", border: "1px solid rgba(79, 209, 197, 0.16)" };
  }

  return { label: "Incorrect", color: "#ff7c7c", background: "rgba(255, 124, 124, 0.16)", border: "1px solid rgba(255, 124, 124, 0.16)" };
}

function getMethodBadge(prediction: PredictionItem) {
  if (prediction.status !== "resolved") {
    return { color: "#f4b942", background: "rgba(244, 185, 66, 0.12)" };
  }

  if (prediction.winner_method_correct) {
    return { color: "#4fd1c5", background: "rgba(32, 178, 170, 0.14)" };
  }

  return { color: "#ff7c7c", background: "rgba(255, 100, 100, 0.12)" };
}

export default function HistoryPage() {
  const [stats, setStats] = useState<PredictionStatsResponse | null>(null);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPredictionStats(), getPredictions(1, 20)])
      .then(([statsData, predictionsData]) => {
        setStats(statsData);
        const resolved = predictionsData.predictions.filter((prediction) => prediction.status === "resolved");
        setPredictions(resolved.slice(0, 10));
      })
      .catch((err) => setError(err.message || "Unable to load prediction history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(34, 175, 130, 0.20) 0%, transparent 65%)", padding: "40px 24px", color: "var(--text)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", flexWrap: "wrap", marginBottom: "40px" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "6px", textTransform: "uppercase", color: "#20b2aa", marginBottom: "16px" }}>History</div>
            <h1 className="title" style={{ fontSize: "clamp(44px, 5vw, 68px)", lineHeight: 1, textTransform: "uppercase", marginBottom: "12px" }}>Prediction history</h1>
            <p style={{ maxWidth: "760px", color: "var(--muted2)", fontSize: "14px", lineHeight: 1.8 }}>
              Review the predictor’s recent scorecard, method accuracy, and the latest logged fights from the live API.
            </p>
          </div>
          <Link href="/" style={{ color: "#28c498", textTransform: "uppercase", fontSize: "12px", letterSpacing: "3px", textDecoration: "none", border: "1px solid rgba(40,196,152,0.75)", padding: "12px 20px", display: "inline-block", background: "transparent" }}>
            Back Home
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>Loading prediction history…</div>
        ) : error ? (
          <div style={{ padding: "28px 24px", borderRadius: "18px", border: "1px solid rgba(255,0,0,0.16)", background: "rgba(255,0,0,0.08)", color: "#ff8e8e" }}>
            {error}
          </div>
        ) : (
          <>
            <section style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "28px" }}>
              <div style={{ padding: "22px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--muted)" }}>Win rate</div>
                <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>{formatPercent(stats?.win_rate?.pct)}</div>
              </div>
              <div style={{ padding: "22px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--muted)" }}>Record</div>
                <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>{stats?.record?.display ?? "—"}</div>
              </div>
              <div style={{ padding: "22px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--muted)" }}>Fight method</div>
                <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>{formatPercent(stats?.fight_method_win_rate?.pct)}</div>
              </div>
              <div style={{ padding: "22px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--muted)" }}>Go to distance</div>
                <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>{formatPercent(stats?.distance_rate?.pct)}</div>
              </div>
            </section>

            <section>
              <div style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "16px" }}>Recent predictions</div>
              <div style={{ display: "grid", gap: "14px" }}>
                {predictions.filter((prediction) => prediction.status === "resolved").length > 0 ? predictions.filter((prediction) => prediction.status === "resolved").map((prediction) => {
                  const outcomeBadge = getOutcomeBadge(prediction);
                  const cardBackground = prediction.status !== "resolved"
                    ? "rgba(244, 185, 66, 0.08)"
                    : prediction.winner_correct
                      ? "rgba(79, 209, 197, 0.08)"
                      : "rgba(255, 124, 124, 0.08)";

                  return (
                    <div key={`${prediction.event_name}-${prediction.matchup}`} style={{ padding: "20px", borderRadius: "18px", background: cardBackground, border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", letterSpacing: "1.8px", textTransform: "uppercase", color: "var(--muted)" }}>{prediction.event_name}</div>
                          <div style={{ marginTop: "6px", fontSize: "18px", fontWeight: 700 }}>{prediction.matchup}</div>
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "8px 12px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: outcomeBadge.color,
                            background: outcomeBadge.background,
                            border: outcomeBadge.border,
                            lineHeight: 1,
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
                          }}
                        >
                          {outcomeBadge.label}
                        </span>
                      </div>
                      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                        <div style={{ padding: "12px 14px", borderRadius: "12px", background: prediction.status !== "resolved" ? "rgba(244, 185, 66, 0.1)" : prediction.winner_correct ? "rgba(79, 209, 197, 0.1)" : "rgba(255, 124, 124, 0.1)" }}>
                          <div style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)" }}>Predicted winner</div>
                          <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: 700 }}>{prediction.predicted_winner || "—"}</div>
                          <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted2)" }}>{formatMethod(prediction.predicted_winner_method)}</div>
                        </div>
                        <div style={{ padding: "12px 14px", borderRadius: "12px", background: prediction.status !== "resolved" ? "rgba(244, 185, 66, 0.1)" : prediction.winner_correct ? "rgba(79, 209, 197, 0.1)" : "rgba(255, 124, 124, 0.1)" }}>
                          <div style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)" }}>Actual result</div>
                          <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: 700 }}>{prediction.actual_winner || "—"}</div>
                          <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted2)" }}>{formatMethod(prediction.actual_winner_method)}</div>
                        </div>
                        <div style={{ padding: "12px 14px", borderRadius: "12px", background: (() => { const badge = getMethodBadge(prediction); return badge.background; })() }}>
                          <div style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)" }}>Winner's method</div>
                          <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: 700, color: (() => { const badge = getMethodBadge(prediction); return badge.color; })() }}>{formatMethod(prediction.predicted_winner_method)}</div>
                          <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted2)" }}>{formatMethod(prediction.actual_winner_method)}</div>
                        </div>
                      </div>
                    </div>
                  );
                }) : <div style={{ padding: "20px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--muted)" }}>No predictions available.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
