"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getEvents } from "@/lib/api";

function Octagon() {
  const size = 700;
  const cx = size / 2;
  const cy = size / 2;
  const r = 300;
  const points = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 - 22.5) * (Math.PI / 180);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");

  const r2 = 240;
  const innerPoints = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 - 22.5) * (Math.PI / 180);
    return `${cx + r2 * Math.cos(angle)},${cy + r2 * Math.sin(angle)}`;
  }).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(90vw, 700px)",
        height: "min(90vw, 700px)",
        opacity: 0.25,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <polygon points={points} fill="none" stroke="#ff0000" strokeWidth="3" />
      <polygon points={innerPoints} fill="none" stroke="#ff0000" strokeWidth="1.5" />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#ff0000" strokeWidth="1" />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#ff0000" strokeWidth="1" />
      <line x1={cx - r * 0.707} y1={cy - r * 0.707} x2={cx + r * 0.707} y2={cy + r * 0.707} stroke="#ff0000" strokeWidth="1" />
      <line x1={cx + r * 0.707} y1={cy - r * 0.707} x2={cx - r * 0.707} y2={cy + r * 0.707} stroke="#ff0000" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={6} fill="#ff0000" />
    </svg>
  );
}

type HomeFight = {
  fighter1: string;
  fighter2: string;
  rounds: number;
};

type HomeEvent = {
  name: string;
  date: string;
  location?: string;
  main_card?: HomeFight[];
  [key: string]: unknown;
};

export default function Home() {
  const [nextEvent, setNextEvent] = useState<HomeEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then((data) => {
        const cutoff = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const entries = Object.entries(data as Record<string, unknown>);

        type EventValue = { date: string } & Record<string, unknown>;

        const upcoming = entries
          .filter((entry): entry is [string, EventValue] => {
            const e = entry[1];
            return (
              !!e &&
              typeof e === "object" &&
              "date" in e &&
              typeof (e as { date?: unknown }).date === "string" &&
              (e as { date: string }).date >= cutoff
            );
          })
          .sort(([, a], [, b]) => a.date.localeCompare(b.date));

        if (upcoming.length > 0) {
          const [name, event] = upcoming[0];
          setNextEvent({ name, ...event });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const daysUntil = nextEvent
    ? Math.ceil((new Date(nextEvent.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;


  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", position: "relative" }}>

      {/* Hero */}
      <div style={{ position: "relative", textAlign: "center", padding: "120px 24px 160px", overflow: "hidden", background: "linear-gradient(180deg, rgba(180,0,0,0.35) 0%, rgba(80,0,0,0.15) 40%, rgba(15,15,20,0.8) 70%, rgba(10,10,10,1) 100%)" }}>
        <Octagon />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-block",
            fontSize: "10px", letterSpacing: "6px", color: "var(--accent)",
            textTransform: "uppercase", border: "1px solid var(--accent)",
            padding: "6px 16px", marginBottom: "40px"
          }}>
            Advanced Analytical Formula
          </div>

          <h1 className="title" style={{
            fontSize: "clamp(80px, 15vw, 170px)",
            lineHeight: 0.85,
            textTransform: "uppercase",
            letterSpacing: "-2px",
            marginBottom: "8px"
          }}>
            The MMA
          </h1>
          <h1 className="title" style={{
            fontSize: "clamp(80px, 15vw, 170px)",
            lineHeight: 0.85,
            textTransform: "uppercase",
            letterSpacing: "-2px",
            color: "var(--accent)",
            marginBottom: "48px"
          }}>
            Formula
          </h1>

          <p style={{
            color: "var(--muted2)", fontSize: "12px", letterSpacing: "3px",
            textTransform: "uppercase", maxWidth: "500px", margin: "0 auto", lineHeight: 2
          }}>
            UFC fight predictions built on fighter analytics,<br />
            historical data & a custom scoring formula
          </p>
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        maxWidth: "1200px", margin: "0 auto 100px", padding: "40px 24px",
        gap: "1px", background: "var(--border)", border: "1px solid var(--border)",
        position: "relative", zIndex: 2,
        backgroundColor: "rgba(20, 20, 30, 0.8)"
      }}>
        {[
          { num: "01", href: "/events", title: "Upcoming\nCards", sub: "Events", desc: "Every upcoming UFC event with the model's predictions for each bout on the card.", cta: "View Events" },
          { num: "02", href: "/fighters", title: "Fighter\nDatabase", sub: "Fighters", desc: "Search any UFC fighter. View career stats, physical specs, and full skillset ratings.", cta: "Search Fighters" },
          { num: "03", href: "/history", title: "Prediction\nHistory", sub: "History", desc: "Track the model's accuracy across past events. Every prediction logged and scored.", cta: "View History" },
        ].map((card, i) => (
          <Link key={i} href={card.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card-hover" style={{ 
              padding: "52px 40px", 
              background: i === 0 ? "rgba(196, 30, 58, 0.12)" : i === 1 ? "rgba(0, 100, 150, 0.08)" : "rgba(32, 178, 170, 0.10)", 
              height: "100%",
              borderLeft: i === 0 ? "4px solid #DC143C" : i === 1 ? "4px solid #0066cc" : "4px solid #20B2AA"
            }}>
              <div style={{ fontSize: "10px", letterSpacing: "4px", color: "var(--accent)", marginBottom: "8px", textTransform: "uppercase" }}>{card.num}</div>
              <div style={{ fontSize: "10px", letterSpacing: "4px", color: "var(--muted)", marginBottom: "28px", textTransform: "uppercase" }}>{card.sub}</div>
              <div className="title" style={{ fontSize: "40px", letterSpacing: "1px", marginBottom: "16px", textTransform: "uppercase", lineHeight: 1.1, whiteSpace: "pre-line" }}>{card.title}</div>
              <div style={{ color: "var(--muted)", fontSize: "12px", lineHeight: 1.8 }}>{card.desc}</div>
              <div className="card-arrow" style={{ marginTop: "40px", fontSize: "11px", letterSpacing: "3px", color: "var(--muted)", textTransform: "uppercase", transition: "color 0.2s" }}>{card.cta} →</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Next Event Preview */}
{!loading && nextEvent && (
  <div style={{ maxWidth: "1200px", margin: "0 auto 80px", padding: "50px 24px", position: "relative", zIndex: 2, background: "linear-gradient(135deg, rgba(40, 30, 35, 0.9) 0%, rgba(25, 35, 45, 0.9) 100%)", borderRadius: "8px" }}>
    
    {/* Section header */}
    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
      <div style={{ width: "4px", height: "40px", background: "var(--accent)" }} />
      <div>
        <div style={{ fontSize: "10px", letterSpacing: "5px", color: "var(--accent)", textTransform: "uppercase", marginBottom: "4px" }}>
          Next Event — {daysUntil === 0 ? "Tonight" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
        </div>
        <div className="title" style={{ fontSize: "48px", letterSpacing: "2px", textTransform: "uppercase", lineHeight: 1 }}>{nextEvent.name}</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{nextEvent.date}</div>
        <div style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>{nextEvent.location}</div>
        <Link href={`/events/${encodeURIComponent(nextEvent.name)}`} style={{
          textDecoration: "none", color: "var(--accent)",
          fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase",
          border: "1px solid var(--accent)", padding: "10px 20px",
          display: "inline-block"
        }}>Full Card →</Link>
      </div>
    </div>

    {/* Fight rows */}
    <div style={{ border: "1px solid var(--border)", borderRadius: "4px", overflow: "hidden" }}>
      {nextEvent.main_card?.slice(0, 5).map((fight, i) => (
        <div key={i} style={{
          padding: "22px 28px",
          borderBottom: i < 4 ? "1px solid var(--border)" : "none",
          display: "flex", alignItems: "center", gap: "20px",
          background: i === 0 ? "rgba(200, 50, 50, 0.15)" : i === 1 ? "rgba(0, 100, 150, 0.08)" : "rgba(50, 50, 60, 0.3)",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Red left bar for main event */}
          {i === 0 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: "var(--accent)" }} />}

          {/* Badge */}
          <div style={{ minWidth: "80px" }}>
            {i === 0 && (
              <span style={{ fontSize: "9px", letterSpacing: "3px", color: "var(--accent)", textTransform: "uppercase", border: "1px solid var(--accent)", padding: "4px 8px" }}>Main</span>
            )}
            {i === 1 && (
              <span style={{ fontSize: "9px", letterSpacing: "3px", color: "var(--muted2)", textTransform: "uppercase", border: "1px solid var(--border2)", padding: "4px 8px" }}>Co-Main</span>
            )}
            {i > 1 && (
              <span style={{ fontSize: "9px", letterSpacing: "3px", color: "var(--muted)", textTransform: "uppercase", padding: "4px 8px", opacity: 0.5 }}>Card</span>
            )}
          </div>

          {/* Fighters */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "16px" }}>
            <span className="title" style={{
              fontSize: i === 0 ? "28px" : "22px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: i === 0 ? "var(--text)" : "#aaa"
            }}>{fight.fighter1}</span>
            <span style={{
              fontSize: "12px", color: "var(--accent)",
              letterSpacing: "3px", fontWeight: "bold",
              border: "1px solid rgba(200,0,0,0.3)",
              padding: "2px 8px"
            }}>VS</span>
            <span className="title" style={{
              fontSize: i === 0 ? "28px" : "22px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: i === 0 ? "var(--text)" : "#aaa"
            }}>{fight.fighter2}</span>
          </div>

          {/* Rounds */}
          <div style={{
            fontSize: "11px", color: "var(--muted)",
            letterSpacing: "2px", textTransform: "uppercase",
            border: "1px solid var(--border)",
            padding: "4px 12px"
          }}>{fight.rounds}R</div>
        </div>
      ))}
    </div>
  </div>
)}
      {/* Footer */}
      <div style={{
        textAlign: "center", padding: "32px",
        fontSize: "10px", color: "var(--border2)",
        letterSpacing: "4px", textTransform: "uppercase",
        borderTop: "1px solid var(--border)",
        background: "linear-gradient(180deg, rgba(15,15,20,0.4) 0%, rgba(25, 20, 25, 0.6) 100%)"
      }}>
        The MMA Formula © 2026
      </div>

    </main>
  );
}