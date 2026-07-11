"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getEvents, normalizeEventList } from "@/lib/api";

type Fight = {
  fighter1: string;
  fighter2: string;
  rounds: number;
};

type EventData = {
  date: string;
  location: string;
  main_card?: Fight[];
  prelims?: Fight[];
  [key: string]: unknown;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Array<{ name: string; data: EventData }>>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then((data) => {
        const cutoff = Date.now() - 86400000;
        const upcoming = normalizeEventList(data)
          .filter((event): event is { name: string; data: EventData } => {
            return (
              !!event.data &&
              typeof event.data.date === "string" &&
              typeof event.data.location === "string"
            );
          })
          .filter((event) => {
            const eventTime = new Date(event.data.date).getTime();
            return eventTime >= cutoff;
          })
          .sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

        setEvents(upcoming);
      })
      .catch((err) => setError(err.message || "Could not fetch events"))
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.name.toLowerCase().includes(filter.toLowerCase()) ||
          (typeof event.data.location === "string" ? event.data.location.toLowerCase() : "").includes(filter.toLowerCase())
      ),
    [events, filter]
  );

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(160,0,0,0.22) 0%, transparent 65%)", padding: "40px 24px", color: "var(--text)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", flexWrap: "wrap", marginBottom: "40px" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "6px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "18px" }}>Events</div>
            <h1 className="title" style={{ fontSize: "clamp(48px, 5vw, 72px)", lineHeight: 1, textTransform: "uppercase", marginBottom: "16px" }}>Upcoming UFC Cards</h1>
            <p style={{ maxWidth: "720px", color: "var(--muted2)", fontSize: "14px", lineHeight: 1.8 }}>
              Browse every upcoming event with predictions for each fight. Search by event name or location to find the card you need.
            </p>
          </div>
          <Link href="/" style={{ color: "#ff4d4d", textTransform: "uppercase", fontSize: "12px", letterSpacing: "3px", textDecoration: "none", border: "1px solid rgba(255, 77, 77, 0.75)", padding: "12px 20px", display: "inline-block", background: "transparent" }}>
            Back Home
          </Link>
        </div>

        {/* Search + counter */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "32px" }}>
          <div style={{ flex: "1 1 280px", minWidth: 240, background: "#0f0f0f", border: "1px solid var(--border2)", borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "12px" }}>Search event</div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by event or city"
              style={{ width: "100%", padding: "13px 16px", borderRadius: "8px", border: "1px solid var(--border2)", background: "#0a0a0a", color: "var(--text)", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 240, background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: "12px", padding: "24px", boxShadow: "inset 0 0 40px rgba(160,0,0,0.08)" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "12px" }}>Live update</div>
            <div className="title" style={{ fontSize: "48px", lineHeight: 1, color: "var(--text)" }}>{events.length}</div>
            <div style={{ color: "var(--muted2)", marginTop: "8px", fontSize: "13px" }}>Upcoming events scheduled.</div>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>Loading events…</div>
        ) : error ? (
          <div style={{ padding: "40px", border: "1px solid #400606", borderRadius: "12px", color: "#ff7777", background: "rgba(100,0,0,0.12)" }}>{error}</div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>No event matches your search.</div>
        ) : (
          <div style={{ display: "grid", gap: "24px" }}>
            {filteredEvents.map((event, index) => {
              const mainCard = event.data.main_card || [];
              const prelims = event.data.prelims || [];
              const previewFights = mainCard.slice(0, 5);
              const hiddenMainCount = Math.max(0, mainCard.length - 5);
              const totalPrelims = prelims.length;

              return (
                <article
                  key={event.name}
                  style={{
                    border: "1px solid rgba(204,0,0,0.45)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "#110000",
                    boxShadow: "0 0 60px rgba(160,0,0,0.15)",
                  }}
                >
                  {/* Clickable header — entire top block */}
                  <Link href={`/events/${encodeURIComponent(event.name)}`} style={{ textDecoration: "none", display: "block" }}>
                    <div
                      style={{
                        display: "flex", gap: "18px", alignItems: "center", padding: "28px",
                        borderBottom: "1px solid var(--border)",
                        background: "linear-gradient(120deg, rgba(180,0,0,0.3) 0%, rgba(120,0,0,0.15) 50%, rgba(60,0,0,0.05) 100%)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        minWidth: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center",
                        background: "var(--accent)",
                        color: "#fff", borderRadius: "12px", fontWeight: 700, fontSize: "18px", flexShrink: 0,
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "3px", color: "rgba(255,100,100,0.65)", marginBottom: "8px" }}>
                          {event.data.date} · {event.data.location}
                        </div>
                        <h2 className="title" style={{ fontSize: "clamp(28px, 3vw, 38px)", lineHeight: 1.05, textTransform: "uppercase", color: "var(--text)" }}>
                          {event.name}
                        </h2>
                      </div>
                      <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "var(--accent)", flexShrink: 0 }}>
                        View →
                      </div>
                    </div>
                  </Link>

                  {/* Fight list */}
                  <div style={{ padding: "24px", display: "grid", gap: "16px" }}>

                    {/* Main card fights — all 5 */}
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "4px" }}>Main card</div>
                      {previewFights.map((fight, fi) => (
                        <div key={fi} style={{
                          display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center",
                          padding: "14px 18px", borderRadius: "10px",
                          background: "rgba(180,0,0,0.06)",
                          border: "1px solid var(--border)",
                        }}>
                          <div style={{ fontSize: "13px", color: "var(--text)", fontWeight: 700 }}>
                            {fight.fighter1} <span style={{ color: "var(--muted)", fontWeight: 400 }}>vs</span> {fight.fighter2}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", border: "1px solid var(--border)", borderRadius: "999px", padding: "5px 11px", flexShrink: 0 }}>
                            {fight.rounds}R
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Prelims — show first 2 */}
                    {totalPrelims > 0 && (
                      <div style={{ display: "grid", gap: "6px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>Preliminary card</div>
                        {prelims.slice(0, 2).map((fight, fi) => (
                          <div key={fi} style={{
                            display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center",
                            padding: "10px 16px", borderRadius: "8px", background: "rgba(100,100,100,0.03)",
                          }}>
                            <div style={{ fontSize: "12px", color: "var(--muted2)", fontWeight: 500 }}>
                              {fight.fighter1} <span style={{ color: "var(--muted)", fontWeight: 400 }}>vs</span> {fight.fighter2}
                            </div>
                            <div style={{ color: "var(--muted)", fontSize: "11px", opacity: 0.6 }}>{fight.rounds}R</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ··· more fights */}
                    {(hiddenMainCount > 0 || totalPrelims > 2) && (
                      <div style={{
                        padding: "10px 18px", borderRadius: "8px", border: "1px dashed var(--border)",
                        fontSize: "12px", color: "var(--muted)", display: "flex", gap: "10px", alignItems: "center",
                      }}>
                        <span style={{ letterSpacing: "4px", color: "var(--accent)" }}>···</span>
                        <span>
                          {[
                            hiddenMainCount > 0 && `${hiddenMainCount} more main card fight${hiddenMainCount > 1 ? "s" : ""}`,
                            totalPrelims > 2 && `${totalPrelims - 2} more prelim${totalPrelims - 2 > 1 ? "s" : ""}`,
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    )}

                    {/* View full card */}
                    <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                      <Link
                        href={`/events/${encodeURIComponent(event.name)}`}
                        style={{ textDecoration: "none", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "3px", fontSize: "11px" }}
                      >
                        View full card →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}