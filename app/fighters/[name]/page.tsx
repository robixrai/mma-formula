import Link from "next/link";
import Flag from "@/app/components/Flag";
import { getFighter, getFighterPhotos, getFighterSearch, normalizeFighterName } from "@/lib/api";

type FighterData = Record<string, unknown>;
type FighterPhotoData = {
  fighter_name?: string;
  ufc_url?: string;
  images?: string[];
  headshot?: string;
  profile_images?: string[];
  status?: string;
};

function getProfileFighterName(param: string | undefined) {
  const raw = String(param ?? "").trim();
  if (!raw) return "";

  const decoded = raw.replace(/\+/g, " ");
  let normalized = "";

  try {
    normalized = normalizeFighterName(decodeURIComponent(decoded));
  } catch {
    normalized = normalizeFighterName(decoded);
  }

  return normalized || normalizeFighterName(raw);
}

function parseHeightToCm(height?: string | null): number | null {
  if (!height) return null;
  const s = String(height).toLowerCase().trim();
  const cmMatch = s.match(/(\d+(?:\.\d+)?)\s?cm/);
  if (cmMatch) return Math.round(Number(cmMatch[1]));
  const ftInMatch = s.match(/(\d+)\s*'\s*(\d+)?|(?:(\d+)\s*ft(?:et)?\s*(\d+)?\s*in)?/i);
  if (ftInMatch) {
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
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(num) && num > 50) return Math.round(num);
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

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatCareerValue(value: unknown, key?: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === 1) return "W";
        if (item === 0) return "L";
        if (item === 2) return "D";
        return String(item);
      })
      .join(" ");
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  const text = String(value).trim();
  if (key?.toLowerCase().includes("last")) {
    return text.replace(/[\[,\]]/g, " ").trim();
  }
  return text || "—";
}

function formatFieldLabel(key: string) {
  const labelMap: Record<string, string> = {
    record: "Record",
    "ufc-record": "UFC record",
    ufc_record: "UFC record",
    "UFC Record": "UFC record",
    "last-five": "Last 5",
    last_5: "Last 5",
    last5: "Last 5",
    wins: "Wins",
    losses: "Losses",
    draws: "Draws",
    "ko tko wins": "KO/TKO Wins",
    "ko-tko-wins": "KO/TKO Wins",
    "ko_tko_wins": "KO/TKO Wins",
    ko: "KO",
    k_o: "KO",
    submissions: "Submissions",
    decision: "Decision",
    "title-bouts": "Title bouts",
    titles: "Titles",
    rank: "Rank",
  };
  return labelMap[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRecord(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const data = value as Record<string, unknown>;
    const wins = data.wins ?? data.win;
    const losses = data.losses ?? data.loss;
    const draws = data.draws ?? data.draw;
    if ((wins !== undefined && wins !== null) && (losses !== undefined && losses !== null)) {
      return `${wins}-${losses}${draws ? `-${draws}` : ""}`;
    }
    return data.record ? String(data.record) : null;
  }
  return String(value);
}

function renderRows(items: Array<[string, unknown]>) {
  return items.map(([label, value]) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "14px", color: "var(--muted2)" }}>
      <span style={{ color: "var(--muted)", minWidth: "110px", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</span>
      <span style={{ color: "var(--text)", textAlign: "right", maxWidth: "360px", wordBreak: "break-word" }}>{formatValue(value)}</span>
    </div>
  ));
}

function renderCareerStatsUI(careerRows: Array<[string, unknown]>) {
  // Filter out redundant stats and reorganize
  const excludeList = ['wins', 'losses', 'ufc wins', 'ufc losses', 'api id', 'draws', 'fight history', 'no contests', 'ufc ko tko wins', 'ufc sub wins', 'record', 'ufc record', 'last 5'];
  
  const filteredRows = careerRows.filter(([label]) => {
    const labelLower = label.toLowerCase();
    return !excludeList.includes(labelLower);
  });

  // Find and prioritize key stats
  const keyStatNames = ['win streak', 'ko/tko wins', 'sub wins'];
  const keyStats: Array<[string, unknown]> = [];
  const remainingStats: Array<[string, unknown]> = [];

  const normalizeLabel = (text: string) => text.toLowerCase().replace(/[\/ _-]+/g, " ").trim();
  const normalizedKeyStatNames = keyStatNames.map(normalizeLabel);

  filteredRows.forEach((row) => {
    const labelNormalized = normalizeLabel(row[0]);
    if (normalizedKeyStatNames.includes(labelNormalized)) {
      keyStats.push(row);
    } else {
      remainingStats.push(row);
    }
  });

  // Reorder key stats to match desired order
  const orderedKeyStats = normalizedKeyStatNames
    .map(name => keyStats.find(([label]) => normalizeLabel(label) === name))
    .filter((stat): stat is [string, unknown] => stat !== undefined);

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Key stats in large cards - linear layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        {orderedKeyStats.map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: "20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(53, 152, 216, 0.12) 0%, rgba(53, 152, 216, 0.06) 100%)",
              border: "1px solid rgba(53, 152, 216, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ fontSize: "16px", letterSpacing: "1.2px", textTransform: "uppercase", color: "#7ab8d9", fontWeight: 700 }}>{label}</div>
            <div style={{ color: "#7ab8d9", fontWeight: 600 }}>-</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#3db2ff", lineHeight: 1.1 }}>{formatValue(value)}</div>
          </div>
        ))}
      </div>

      {/* Additional stats in grid - linear layout */}
      {remainingStats.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
          {remainingStats.map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: "14px",
                borderRadius: "11px",
                background: "rgba(255, 255, 255, 0.045)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "9px", letterSpacing: "0.8px", textTransform: "uppercase", color: "#8a9fb0", fontWeight: 600 }}>{label}</div>
              <div style={{ color: "#8a9fb0", fontWeight: 600, fontSize: "12px" }}>-</div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#e0e8f0" }}>{formatValue(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isFighterData(value: unknown): value is FighterData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return !keys.every((key) => /^[0-9]+$/.test(key));
}

function normalizeSearchResult(data: unknown): FighterData | null {
  if (Array.isArray(data)) {
    const item = data.find((entry) => isFighterData(entry));
    return (item as FighterData) ?? null;
  }
  if (isFighterData(data)) return data;
  return null;
}

function getProfileImage(photoData: unknown) {
  if (!photoData) return "";
  
  // Handle different response structures
  const data = typeof photoData === "object" ? (photoData as any) : {};
  
  // Try to get headshot directly
  let headshot = data.headshot;
  
  // If headshot is an object, get the URL from it
  if (headshot && typeof headshot === "object") {
    headshot = headshot.url || headshot.src || Object.values(headshot)[0];
  }
  
  // Convert to string and trim
  const url = headshot ? String(headshot).trim() : "";
  
  console.log("Photo data received:", photoData); // Debug log
  console.log("Extracted headshot URL:", url); // Debug log
  
  return url;
}

export default async function FighterProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name: paramName } = await params;
  const fighterName = getProfileFighterName(paramName);
  let fighter: FighterData | null = null;
  let fetchError: string | null = null;
  let photoData: FighterPhotoData | null = null;

  try {
    const response = await getFighter(fighterName);
    if (isFighterData(response)) {
      fighter = response;
    } else {
      const fallback = await getFighterSearch(fighterName);
      const normalized = normalizeSearchResult(fallback);
      if (normalized) {
        fighter = normalized;
      } else {
        throw new Error(`Fighter ${fighterName} not found / Not in database`);
      }
    }
  } catch (error) {
    fetchError = error instanceof Error ? error.message : String(error);
  }

  try {
    const photos = await getFighterPhotos(fighterName);
    if (photos && typeof photos === "object" && !Array.isArray(photos)) {
      photoData = photos as FighterPhotoData;
    }
  } catch {
    photoData = null;
  }

  if (!fighter || typeof fighter !== "object" || Array.isArray(fighter)) {
    fighter = { name: fighterName };
  }

  const personal = (fighter["personal-info"] ?? fighter.personalInfo ?? fighter["personalInfo"] ?? {}) as FighterData;
  const specs = (fighter.specs ?? fighter["specs"] ?? {}) as FighterData;
  const career = (fighter.career ?? {}) as FighterData;
  const name = String(fighter.name ?? personal.name ?? fighterName);
  const nickname = String(fighter.nickname ?? personal.nickname ?? "").trim();
  const displayName = nickname
    ? (() => {
        const parts = name.split(" ").filter(Boolean);
        if (parts.length > 1) {
          return `${parts.slice(0, -1).join(" ")} "${nickname}" ${parts[parts.length - 1]}`;
        }
        return `${name} "${nickname}"`;
      })()
    : name;
  const division = String(personal["weight-class"] ?? personal["weight_class"] ?? fighter.division ?? "").trim();
  const country = String(personal.nationality ?? personal.country ?? fighter.country ?? "").trim();
  const flagCode = String(
    personal["country-code"] ?? personal["country_code"] ?? personal.countryCode ?? personal.cc ?? fighter["country-code"] ?? fighter["country_code"] ?? ""
  )
    .trim()
    .toLowerCase();
  const fightingOutOf = String(personal["fighting-out-of"] ?? personal.fightingOutOf ?? "").trim();
  const gym = String(personal.gym ?? "").trim();
  const status = String(personal.status ?? "").trim();
  const gender = String(personal.gender ?? "").trim();
  const height = String(specs.height ?? fighter.height ?? "").trim();
  const reach = String(specs.reach ?? fighter.reach ?? "").trim();
  const stance = String(specs.stance ?? fighter.stance ?? "").trim();
  const birthDate = String(personal["birth-date"] ?? personal["birth_date"] ?? personal.birthDate ?? "").trim();
  const ageValue = fighter.age ?? personal.age ?? null;
  const age = birthDate
    ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear())
    : typeof ageValue === "number" || typeof ageValue === "string"
    ? ageValue
    : null;
  const record = String(fighter.record ?? getRecord(career) ?? "").trim();
  const ufcRecord = String(getRecord(career["ufc-record"] ?? career["ufc_record"] ?? career["UFC Record"] ?? { wins: career["ufc-wins"], losses: career["ufc-losses"] }) ?? "").trim();
  const last5 = Array.isArray(career["last-five"])
    ? (career["last-five"] as any[]).map((v) => (v === 1 ? "W" : v === 0 ? "L" : v === 2 ? "D" : String(v))).join(" ")
    : String(career["last-five"] ?? career["last_5"] ?? fighter["last5"] ?? fighter["last_5"] ?? personal["last5"] ?? personal["last_5"] ?? "").trim();
  const heroImage = getProfileImage(photoData);

  const careerRows: Array<[string, unknown]> = [
    ["Record", record || "—"],
    ["UFC record", ufcRecord || "—"],
    ["Last 5", last5 || "—"],
    ...Object.entries(career)
      .filter(
        ([key]) =>
          ![
            "record",
            "ufc-record",
            "ufc_record",
            "UFC Record",
            "last-five",
            "last_5",
            "last5",
          ].includes(key)
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [formatFieldLabel(key), formatCareerValue(value, key)] as [string, unknown]),
  ];

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 24px", color: "var(--text)" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <Link href="/fighters" style={{ color: "#3598d8", textTransform: "uppercase", fontSize: "12px", letterSpacing: "3px", textDecoration: "none", marginBottom: "24px", display: "inline-block" }}>
          ← Back to fighters
        </Link>

        <div style={{ display: "grid", gap: "28px" }}>
          <section style={{ padding: "30px", borderRadius: "18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {fetchError ? (
              <div style={{ marginBottom: "22px", padding: "18px", borderRadius: "14px", background: "rgba(255,0,0,0.08)", color: "#ff7676", border: "1px solid rgba(255,0,0,0.16)" }}>
                Could not load fighter data: {fetchError}
              </div>
            ) : null}
            <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 430px)", alignItems: "stretch" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <div style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", color: "#3598d8", marginBottom: "10px" }}>Fighter profile</div>
                  <h1 className="title" style={{ fontSize: "clamp(42px, 6vw, 68px)", lineHeight: 1, textTransform: "uppercase" }}>{name}</h1>
                  {nickname && <div style={{ fontSize: "16px", color: "var(--muted)", marginTop: "8px" }}>&quot;{nickname}&quot;</div>}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {country && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.06)", color: "var(--text)", padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                      <Flag code={flagCode || country} size={16} />
                      <span>{country}</span>
                    </span>
                  )}
                  {division && (
                    <span style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                      {division}
                    </span>
                  )}
                  {gender && (
                    <span style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                      {gender}
                    </span>
                  )}
                  {stance && (
                    <span style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                      {stance}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
                  <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Age</div>
                    <div style={{ marginTop: "8px", fontSize: "24px", fontWeight: 800 }}>{age ?? "—"}</div>
                  </div>
                  <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Height</div>
                    <div style={{ marginTop: "8px", fontSize: "24px", fontWeight: 800 }}>{formatHeightCm(height) || height || "—"}</div>
                  </div>
                  <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Reach</div>
                    <div style={{ marginTop: "8px", fontSize: "24px", fontWeight: 800 }}>{formatReachIn(reach) || reach || "—"}</div>
                  </div>
                </div>

                <div style={{ padding: "18px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", height: "100%" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Record</div>
                      <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: 700 }}>{record || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Fighting out of</div>
                      <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: 700 }}>{fightingOutOf || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>Gym</div>
                      <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: 700 }}>{gym || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted)" }}>UFC record</div>
                      <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: 700 }}>{ufcRecord || record || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {heroImage ? (
                <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
                  <div style={{ width: "100%", minHeight: "100%", borderRadius: "18px", overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <img
                      src={heroImage}
                      alt={`${name} profile photo`}
                      style={{ width: "100%", height: "100%", minHeight: "420px", objectFit: "cover", objectPosition: "center top" }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "240px", borderRadius: "18px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)", color: "var(--muted)" }}>
                  No profile image available.
                </div>
              )}
            </div>

            {careerRows.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                {renderCareerStatsUI(careerRows)}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
