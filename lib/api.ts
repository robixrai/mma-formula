export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://ufc-predictor-v1.onrender.com";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`API request failed (${response.status})${message ? `: ${message}` : ""}`);
  }

  return response.json() as Promise<T>;
}

export function normalizeFighterList(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data as Array<Record<string, unknown>>;
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).map(([name, payload]) => ({
      name,
      ...(payload as Record<string, unknown>),
    }));
  }

  return [];
}

export function normalizeFighterName(name: string) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeEventList(data: unknown): Array<{ name: string; data: Record<string, unknown> }> {
  if (!data || typeof data !== "object") {
    return [];
  }

  return Object.entries(data as Record<string, unknown>).map(([name, payload]) => ({
    name,
    data: payload as Record<string, unknown>,
  }));
}

export function getFighters() {
  return fetchJson<unknown>("/fighters");
}

export function getEvents() {
  return fetchJson<unknown>("/events");
}

export function getPrediction(fighter1: string, fighter2: string) {
  return fetchJson<unknown>(`/predict/${encodeURIComponent(fighter1)}/${encodeURIComponent(fighter2)}`);
}

function normalizeFighterApiName(name: string) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getFighterSearch(query: string) {
  const normalizedQuery = String(query).trim();
  if (!normalizedQuery) {
    throw new Error("Fighter search query must not be empty");
  }

  return fetchJson<unknown>(`/fighters/search?q=${encodeURIComponent(normalizedQuery)}`);
}

export function getFighter(name: string) {
  const normalized = normalizeFighterName(name);
  if (!normalized) {
    throw new Error("Fighter name must not be empty");
  }

  return fetchJson<unknown>(`/fighters/${encodeURIComponent(normalized)}`);
}

export function getFighterPhotos(name: string) {
  const normalized = normalizeFighterName(name);
  if (!normalized) {
    throw new Error("Fighter name must not be empty");
  }

  return fetchJson<unknown>(`/photos/${encodeURIComponent(normalized)}`);
}

export interface PredictionStatsResponse {
  total_resolved: number;
  record: {
    wins: number;
    losses: number;
    display: string;
  } | null;
  win_rate: {
    correct: number;
    total: number;
    pct: number | null;
  } | null;
  winner_method_win_rate: {
    correct: number;
    total: number;
    pct: number | null;
  } | null;
  fight_method_win_rate: {
    correct: number;
    total: number;
    pct: number | null;
  } | null;
  distance_rate: {
    correct: number;
    total: number;
    pct: number | null;
  } | null;
  method_pick_rate: Record<string, { count: number; pct: number }> | null;
}

export interface PredictionItem {
  event_name: string;
  event_date?: string | null;
  locked_at?: string | null;
  matchup: string;
  fighter_a: string;
  fighter_b: string;
  predicted_winner?: string | null;
  predicted_winner_method?: string | null;
  predicted_fight_method?: string | null;
  win_probability?: number | null;
  actual_winner?: string | null;
  actual_winner_method?: string | null;
  actual_fight_method?: string | null;
  winner_correct?: boolean | null;
  winner_method_correct?: boolean | null;
  fight_method_correct?: boolean | null;
  distance_correct?: boolean | null;
  status: "resolved" | "pending";
}

export interface PredictionListResponse {
  predictions: PredictionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export function getHistory() {
  return fetchJson<PredictionStatsResponse>("/predictions/stats");
}

export function getPredictionStats(dateFrom?: string, dateTo?: string) {
  return fetchJson<PredictionStatsResponse>(`/predictions/stats${buildQuery({ date_from: dateFrom, date_to: dateTo })}`);
}

export function getPredictions(page = 1, limit = 20, result?: string, eventName?: string) {
  return fetchJson<PredictionListResponse>(`/predictions${buildQuery({ page, limit, result, event_name: eventName })}`);
}
