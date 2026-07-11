"use client";

import Link from "next/link";
import Flag from "@/app/components/Flag";
import { useEffect, useMemo, useState } from "react";
import { getFighterSearch, getFighters, getFighter, normalizeFighterName } from "@/lib/api";

type FighterData = Record<string, unknown>;

type FighterCard = {
  name: string;
  fighter?: FighterData;
};

function getFighterField(fighter: FighterData, path: Array<string | string[]>): unknown {
  let current: any = fighter;
  for (const segment of path) {
    if (current == null) return undefined;
    if (Array.isArray(segment)) {
      const [keyA, keyB] = segment;
      current = current[keyA] ?? current[keyB];
    } else {
      current = current[segment];
    }
  }
  return current;
}

function getFighterName(fighter: FighterData): string {
  const value = fighter.name ?? getFighterField(fighter, [["personal-info", "personalInfo", "personal_info"], "name"]) ?? (fighter["personal-info"] as any)?.name ?? (fighter.personalInfo as any)?.name ?? "";
  const name = String(value ?? "").trim();
  return name && name.toLowerCase() !== "undefined" && name.toLowerCase() !== "null" ? name : "";
}

function formatRecord(fighter: FighterData) {
  const record = getFighterField(fighter, ["record"]);
  if (typeof record === "string" && record.trim()) return record;
  const career = getFighterField(fighter, ["career"]);
  if (career && typeof career === "object") {
    const wins = Number((career as any).wins ?? (career as any).win ?? 0);
    const losses = Number((career as any).losses ?? (career as any).loss ?? 0);
    const draws = Number((career as any).draws ?? (career as any).draw ?? 0);
    if (!Number.isNaN(wins) && !Number.isNaN(losses)) {
      return `${wins}-${losses}${draws ? `-${draws}` : ""}`;
    }
  }
  return undefined;
}

function safeString(value: unknown) {
  const raw = typeof value === "string" ? value : value == null ? "" : String(value);
  const trimmed = raw.trim();
  return trimmed && trimmed.toLowerCase() !== "undefined" && trimmed.toLowerCase() !== "null" ? trimmed : "";
}

function getDisplayName(name: string, nickname: string) {
  if (!nickname) return name;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return `${name} "${nickname}"`;
  const last = parts.pop();
  return `${parts.join(" ")} "${nickname}" ${last}`;
}

export default function FightersPage() {
  const [fighterNames, setFighterNames] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<FighterCard[] | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [fighterDetails, setFighterDetails] = useState<Record<string, FighterData>>({});
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedGender, setSelectedGender] = useState("");

  useEffect(() => {
    getFighters()
      .then((data) => {
        if (Array.isArray(data)) {
          setFighterNames(
            data
              .map((item) => String(item).trim())
              .filter((name) => name && name.toLowerCase() !== "undefined")
              .sort((a, b) => a.localeCompare(b))
          );
        } else if (data && typeof data === "object") {
          setFighterNames(
            Object.keys(data)
              .map((item) => String(item).trim())
              .filter((name) => name && name.toLowerCase() !== "undefined")
              .sort((a, b) => a.localeCompare(b))
          );
        } else {
          throw new Error("Unexpected /fighters response");
        }
      })
      .catch((err) => setError(err.message || "Could not fetch fighters"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!filter.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setSearchLoading(true);
      getFighterSearch(filter.trim())
        .then((data) => {
          if (!active) return;

          if (Array.isArray(data)) {
            setSearchResults(
              data.map((fighter) => ({
                fighter,
                name: getFighterName(fighter),
              }))
            );
          } else if (data && typeof data === "object") {
            const fighter = data as FighterData;
            setSearchResults([{ fighter, name: getFighterName(fighter) }]);
          } else {
            setSearchResults([]);
          }
        })
        .catch((err) => {
          if (!active) return;
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("404")) {
            setSearchResults([]);
          } else {
            setError(message || "Search failed");
          }
        })
        .finally(() => {
          if (!active) return;
          setSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filter]);

  const showSearchResults = filter.trim().length > 0;
  const divisions = useMemo(() => {
    const set = new Set<string>();
    Object.values(fighterDetails).forEach((fd) => {
      const personal = (fd as any)["personal-info"] ?? (fd as any).personalInfo ?? (fd as any).personal_info ?? {};
      const div = personal["weight-class"] ?? personal["weight_class"] ?? (fd as any).division ?? "";
      if (div) set.add(String(div));
    });
    return Array.from(set).sort();
  }, [fighterDetails]);

  const genders = useMemo(() => {
    const set = new Set<string>();
    Object.values(fighterDetails).forEach((fd) => {
      const personal = (fd as any)["personal-info"] ?? (fd as any).personalInfo ?? (fd as any).personal_info ?? {};
      const g = personal.gender ?? personal.sex ?? "";
      if (g) set.add(String(g));
    });
    return Array.from(set).sort();
  }, [fighterDetails]);

  const displayedFighters = useMemo<FighterCard[]>(() => {
    const base: FighterCard[] = showSearchResults ? searchResults ?? [] : fighterNames.map((name) => ({ name }));

    if (!selectedDivision && !selectedGender) return base;

    return base.filter((item) => {
      const name = item.name as string;
      const fd = (item as FighterCard).fighter ?? fighterDetails[name];
      if (!fd) return false; // can't evaluate filters
      const personal = (fd as any)["personal-info"] ?? (fd as any).personalInfo ?? (fd as any).personal_info ?? {};
      const div = String(personal["weight-class"] ?? personal["weight_class"] ?? fd.division ?? "").toLowerCase();
      const gen = String(personal.gender ?? personal.sex ?? "").toLowerCase();
      if (selectedDivision && div !== selectedDivision.toLowerCase()) return false;
      if (selectedGender && gen !== selectedGender.toLowerCase()) return false;
      return true;
    });
  }, [fighterNames, searchResults, showSearchResults, fighterDetails, selectedDivision, selectedGender]);

  // Background fetch details for name-only entries so we can display flags and extra info
  useEffect(() => {
    if (showSearchResults || fighterNames.length === 0) return;

    const namesToFetch = fighterNames.filter((name) => name && !fighterDetails[name]);
    if (namesToFetch.length === 0) return;

    let active = true;
    (async () => {
      const batchDetails: Record<string, FighterData> = {};

      await Promise.all(
        namesToFetch.map(async (name) => {
          try {
            const data = await getFighter(name);
            if (!active) return;
            if (data && typeof data === "object") {
              batchDetails[name] = data as FighterData;
            }
          } catch {
            // ignore failed fetches; we'll leave the name without details
          }
        })
      );

      if (!active) return;
      if (Object.keys(batchDetails).length > 0) {
        setFighterDetails((prev) => ({ ...prev, ...batchDetails }));
      }
    })();

    return () => {
      active = false;
    };
  }, [fighterNames, showSearchResults]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(0, 120, 255, 0.20) 0%, transparent 65%)", padding: "40px 24px", color: "var(--text)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", flexWrap: "wrap", marginBottom: "40px" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "6px", textTransform: "uppercase", color: "#3598d8", marginBottom: "18px" }}>Fighters</div>
            <h1 className="title" style={{ fontSize: "clamp(48px, 5vw, 72px)", lineHeight: 1, textTransform: "uppercase", marginBottom: "16px" }}>Fighter Database</h1>
            <p style={{ maxWidth: "720px", color: "var(--muted2)", fontSize: "14px", lineHeight: 1.8 }}>
              Search for UFC fighters. Each profile will show the fighter’s full stats when selected.
            </p>
          </div>
          <Link href="/" style={{ color: "#3598d8", textTransform: "uppercase", fontSize: "12px", letterSpacing: "3px", textDecoration: "none", border: "1px solid #3598d8", padding: "12px 20px", display: "inline-block", background: "transparent" }}>
            Back Home
          </Link>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "32px" }}>
          <div style={{ flex: "1 1 280px", minWidth: 240, background: "#071421", border: "1px solid #102a44", borderRadius: "10px", padding: "24px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Search fighter</div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type a fighter name"
              style={{ width: "100%", marginTop: "12px", padding: "14px 16px", borderRadius: "10px", border: "1px solid #233f59", background: "#08192c", color: "var(--text)", fontSize: "14px" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <div style={{ flex: "1 1 0" }}>
                <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Division</label>
                <select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value)} style={{ width: "100%", marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "#08192c", color: "var(--text)", border: "1px solid #233f59" }}>
                  <option value="">All</option>
                  {divisions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 140 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Gender</label>
                <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} style={{ width: "100%", marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "#08192c", color: "var(--text)", border: "1px solid #233f59" }}>
                  <option value="">All</option>
                  {genders.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 240, background: "rgba(53, 152, 216, 0.08)", border: "1px solid #164a74", borderRadius: "10px", padding: "24px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: "#3598d8" }}>Roster</div>
            <div style={{ marginTop: "12px", fontSize: "40px", lineHeight: 1, color: "var(--text)" }}>{fighterNames.length}</div>
            <div style={{ color: "var(--muted2)", marginTop: "8px", fontSize: "13px" }}>Fighters available.</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>Loading fighters…</div>
        ) : error ? (
          <div style={{ padding: "40px", border: "1px solid #0b2b3d", borderRadius: "12px", color: "#8fbbbb", background: "rgba(8, 25, 36, 0.92)" }}>
            {error}
            <div style={{ marginTop: "12px", color: "var(--muted2)" }}>If this API is not ready yet, the search will be available once the endpoint is connected.</div>
          </div>
        ) : showSearchResults && searchLoading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>Searching fighters…</div>
        ) : displayedFighters.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
            {showSearchResults ? "No fighters match that search." : "No fighters available."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))", gap: "18px" }}>
            {displayedFighters.map((item, index) => {
              const itemData = (item as FighterCard).fighter ?? (item as FighterData);
              const itemName = safeString(item.name ?? getFighterName(itemData));
              const fighterData = (item as FighterCard).fighter ?? fighterDetails[itemName] ?? itemData;
              const fighterName = safeString(getFighterName(fighterData) || itemName);
              const normalizedFighterName = fighterName ? normalizeFighterName(fighterName) : "";
              const nickname = safeString(getFighterField(fighterData, [["personal-info", "personalInfo", "personal_info"], "nickname"]));
              const division = safeString(getFighterField(fighterData, [["personal-info", "personalInfo", "personal_info"], ["weight-class", "weight_class"]]));
              const country = safeString(getFighterField(fighterData, [["personal-info", "personalInfo", "personal_info"], "nationality"]));
              // Prefer explicit ISO2 country code when available
              const personalObj = (fighterData as any)["personal-info"] ?? (fighterData as any).personalInfo ?? (fighterData as any).personal_info ?? {};
              const flagCode = safeString(personalObj["country-code"] ?? personalObj["country_code"] ?? personalObj.countryCode ?? personalObj.cc ?? "");
              const record = formatRecord(fighterData);
              const displayName = fighterName || "Unknown";
              const href = normalizedFighterName ? `/fighters/${normalizedFighterName}` : undefined;

              return (
                <div key={`${displayName}-${index}`} style={{ display: "block", width: "100%" }}>
                  {href ? (
                    <Link href={href} style={{ display: "block", width: "100%", textDecoration: "none", color: "inherit" }}>
                      <div style={{ border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", background: "#0b1320", padding: "22px", display: "grid", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0, flex: "1 1 0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "nowrap", marginBottom: 8 }}>
                              <h2 className="title" style={{ fontSize: "26px", margin: 0, textTransform: "uppercase", lineHeight: 1.05, wordBreak: "break-word", minWidth: 0, marginRight: 12 }}>{displayName}</h2>
                              {flagCode || country ? (
                                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56 }}>
                                  <Flag code={flagCode || country} size={56} />
                                </div>
                              ) : null}
                            </div>
                            {country && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--muted)", fontSize: "13px" }}>
                                {nickname ? (
                                  <>
                                    <span style={{ color: "var(--muted)" }}>&quot;{nickname}&quot;</span>
                                    <span style={{ color: "var(--muted)", margin: "0 8px" }}>•</span>
                                  </>
                                ) : null}
                                <span>{country}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", minWidth: 140 }}>
                            {division && (
                              <span style={{ background: "rgba(53,152,216,0.06)", color: "#9bd6f0", padding: "6px 10px", borderRadius: 999, fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>
                                {division}
                              </span>
                            )}
                            {record && <span style={{ color: "#3db2ff", fontSize: "22px", fontWeight: 900 }}>{record}</span>}
                          </div>
                        </div>
                        <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--accent)", letterSpacing: "1px", textTransform: "uppercase" }}>
                          View profile →
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div style={{ border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", background: "#0b1320", padding: "22px", display: "grid", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0, flex: "1 1 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "nowrap", marginBottom: 8 }}>
                            <h2 className="title" style={{ fontSize: "26px", margin: 0, textTransform: "uppercase", lineHeight: 1.05, wordBreak: "break-word", minWidth: 0, marginRight: 12 }}>{displayName}</h2>
                            {flagCode || country ? (
                              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56 }}>
                                <Flag code={flagCode || country} size={56} />
                              </div>
                            ) : null}
                          </div>
                          {country && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--muted)", fontSize: "13px" }}>
                              {nickname ? (
                                <>
                                  <span style={{ color: "var(--muted)" }}>&quot;{nickname}&quot;</span>
                                  <span style={{ color: "var(--muted)", margin: "0 8px" }}>•</span>
                                </>
                              ) : null}
                              <span>{country}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", minWidth: 140 }}>
                          {division && (
                            <span style={{ background: "rgba(53,152,216,0.06)", color: "#9bd6f0", padding: "6px 10px", borderRadius: 999, fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>
                              {division}
                            </span>
                          )}
                          {record && <span style={{ color: "#3db2ff", fontSize: "22px", fontWeight: 900 }}>{record}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
