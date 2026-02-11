"use client";

import React, { useEffect, useMemo, useState } from "react";

type Race = {
  race_id: string;
  title: string;
  date: string;
  city: string;
  url: string;
};

type RSVP = "yes" | "maybe" | "no";

type RSVPRow = {
  timestamp: string;
  race_id: string;
  runner_name: string;
  status: RSVP;
  device_id: string;
};

const RACES_CSV_URL = process.env.NEXT_PUBLIC_RACES_CSV_URL || "";
const RSVPS_CSV_URL = process.env.NEXT_PUBLIC_RSVPS_CSV_URL || "";
const RSVP_WEBHOOK_URL = process.env.NEXT_PUBLIC_RSVP_WEBHOOK_URL || "";

/**
 * Robust CSV parser (handles commas inside quotes + escaped quotes).
 * Returns rows as arrays of raw cell strings (untrimmed except for newline removal).
 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  // Normalize to just \n (keep logic simple)
  // (We'll still handle \r\n in the loop too.)
  while (i < csv.length) {
    const ch = csv[i];

    if (ch === '"') {
      // escaped quote inside quoted field
      if (inQuotes && csv[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    // separators only when not inside quotes
    if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
      row.push(cell);
      cell = "";

      // newline handling
      if (ch === "\r" && csv[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }

      // end of row on newline
      if (ch !== ",") {
        // skip totally empty trailing row
        const isEmptyRow = row.length === 1 && row[0] === "";
        if (!isEmptyRow) rows.push(row);
        row = [];
      }
      continue;
    }

    cell += ch;
    i += 1;
  }

  // flush last cell/row
  row.push(cell);
  const isEmptyRow = row.length === 1 && row[0] === "";
  if (!isEmptyRow) rows.push(row);

  return rows;
}

function normHeader(h: string) {
  return (h || "").trim().toLowerCase();
}

function safeTrim(v: string) {
  return (v ?? "").trim();
}

function parseRacesCSV(csv: string): Race[] {
  const rows = parseCsv(csv.trim());
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => normHeader(h));
  const idx = (name: string) => headers.indexOf(normHeader(name));

  const iRace = idx("race_id");
  const iTitle = idx("title");
  const iDate = idx("date");
  const iCity = idx("city");
  const iUrl = idx("url");

  return rows
    .slice(1)
    .map((cols) => ({
      race_id: safeTrim(cols[iRace] || ""),
      title: safeTrim(cols[iTitle] || ""),
      date: safeTrim(cols[iDate] || ""),
      city: safeTrim(cols[iCity] || ""),
      url: safeTrim(cols[iUrl] || ""),
    }))
    .filter((r) => r.race_id && r.title);
}

function parseRsvpsCSV(csv: string): RSVPRow[] {
  const rows = parseCsv(csv.trim());
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => normHeader(h));
  const idx = (name: string) => headers.indexOf(normHeader(name));

  const iTs = idx("timestamp");
  const iRace = idx("race_id");
  const iName = idx("runner_name");
  const iStatus = idx("status");
  const iDev = idx("device_id");

  const toStatus = (s: string): RSVP => {
    const v = safeTrim(s).toLowerCase();
    if (v === "yes" || v === "maybe" || v === "no") return v;
    return "maybe";
  };

  return rows
    .slice(1)
    .map((cols) => ({
      timestamp: safeTrim(cols[iTs] || ""),
      race_id: safeTrim(cols[iRace] || ""),
      runner_name: safeTrim(cols[iName] || ""),
      status: toStatus(cols[iStatus] || ""),
      device_id: safeTrim(cols[iDev] || ""),
    }))
    .filter((r) => r.race_id && r.runner_name && r.device_id);
}

function getDeviceId() {
  try {
    const k = "mm_device_id";
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "unknown";
  }
}

function prettyStatus(s: RSVP) {
  if (s === "yes") return "YES";
  if (s === "maybe") return "MAYBE";
  return "NO";
}

function parseTimestampMs(ts: string) {
  // If sheet uses ISO, Date.parse is fine; if blank/invalid, treat as 0
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : 0;
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [rsvps, setRsvps] = useState<RSVPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(true);
  const [runnerName, setRunnerName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deviceId = useMemo(
    () => (typeof window !== "undefined" ? getDeviceId() : "unknown"),
    []
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mm_runner_name") || "";
      setRunnerName(saved);
    } catch {}
  }, []);

  async function loadRaces() {
    setLoading(true);
    setError(null);

    if (!RACES_CSV_URL) {
      setLoading(false);
      setError("Missing NEXT_PUBLIC_RACES_CSV_URL");
      return;
    }

    try {
      const res = await fetch(RACES_CSV_URL, { cache: "no-store" });
      const text = await res.text();
      setRaces(parseRacesCSV(text));
    } catch {
      setError("Failed to load races CSV");
    } finally {
      setLoading(false);
    }
  }

  async function loadRsvps() {
    setRsvpLoading(true);
    setError(null);

    if (!RSVPS_CSV_URL) {
      setRsvpLoading(false);
      setError("Missing NEXT_PUBLIC_RSVPS_CSV_URL");
      return;
    }

    try {
      const res = await fetch(RSVPS_CSV_URL, { cache: "no-store" });
      const text = await res.text();
      setRsvps(parseRsvpsCSV(text));
    } catch {
      setError("Failed to load RSVPs CSV");
    } finally {
      setRsvpLoading(false);
    }
  }

  useEffect(() => {
    void loadRaces();
    void loadRsvps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Latest RSVP per (race_id + device_id) wins
  const rsvpByRace = useMemo(() => {
    const map = new Map<string, Map<string, RSVPRow>>();

    for (const row of rsvps) {
      if (!map.has(row.race_id)) map.set(row.race_id, new Map());
      const inner = map.get(row.race_id)!;

      const prev = inner.get(row.device_id);
      const prevT = prev ? parseTimestampMs(prev.timestamp) : 0;
      const curT = parseTimestampMs(row.timestamp);

      if (!prev || curT >= prevT) inner.set(row.device_id, row);
    }

    return map;
  }, [rsvps]);

  const myStatusByRace = useMemo(() => {
    const out: Record<string, RSVP> = {};
    for (const [raceId, inner] of rsvpByRace.entries()) {
      const mine = inner.get(deviceId);
      if (mine) out[raceId] = mine.status;
    }
    return out;
  }, [rsvpByRace, deviceId]);

  async function submitRSVP(race_id: string, status: RSVP) {
    const name = runnerName.trim();
    if (name.length < 2) {
      alert("Enter your name first.");
      return;
    }

    try {
      localStorage.setItem("mm_runner_name", name);
    } catch {}

    // optimistic append (so UI snaps instantly)
    const optimistic: RSVPRow = {
      timestamp: new Date().toISOString(),
      race_id,
      runner_name: name,
      status,
      device_id: deviceId,
    };
    setRsvps((prev) => [...prev, optimistic]);

    // If no webhook set yet, just keep it local + refresh will still show sheet data
    if (!RSVP_WEBHOOK_URL) {
      alert("RSVP saved locally (no webhook configured yet).");
      return;
    }

    try {
      await fetch(RSVP_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          race_id,
          runner_name: name,
          status,
          device_id: deviceId,
        }),
      });
    } catch {
      alert("Webhook failed — your RSVP may not have saved to the sheet.");
    } finally {
      await loadRsvps();
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-14">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Upcoming Races</h1>
            <p className="mt-2 text-neutral-400">RSVP: Yes / Maybe / No</p>
          </div>

          <button
            onClick={() => void loadRsvps()}
            className="px-4 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-sm"
          >
            Refresh RSVPs
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl ring-1 ring-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            Your name
          </div>
          <input
            value={runnerName}
            onChange={(e) => setRunnerName(e.target.value)}
            placeholder="e.g. Adhi"
            className="mt-3 w-full bg-transparent border-b border-white/20 py-3 outline-none"
          />
          <div className="mt-2 text-xs text-neutral-500">
            Tip: your RSVP is tied to this device for now.
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="text-neutral-400">Loading races…</div>
          ) : races.length === 0 ? (
            <div className="text-neutral-400">No races yet.</div>
          ) : (
            races.map((r) => {
              const group = rsvpByRace.get(r.race_id);
              const rows = group ? Array.from(group.values()) : [];

              const yes = rows.filter((x) => x.status === "yes");
              const maybe = rows.filter((x) => x.status === "maybe");
              const no = rows.filter((x) => x.status === "no");

              const mine = myStatusByRace[r.race_id];

              return (
                <div
                  key={r.race_id}
                  className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-semibold">{r.title}</div>
                      <div className="mt-1 text-sm text-neutral-400">
                        {r.date} • {r.city}
                      </div>

                      {r.url ? (
                        <a
                          className="mt-2 inline-block text-sm underline text-neutral-300"
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Race link →
                        </a>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      {(["yes", "maybe", "no"] as RSVP[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => void submitRSVP(r.race_id, s)}
                          className={[
                            "px-4 py-2 rounded-xl ring-1 ring-white/10 text-sm transition",
                            mine === s
                              ? "bg-white text-black"
                              : "bg-black/40 text-white hover:bg-white/10",
                          ].join(" ")}
                        >
                          {prettyStatus(s)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* RSVP summary */}
                  <div className="mt-6 rounded-xl bg-black/40 ring-1 ring-white/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                        Attendance
                      </div>
                      <div className="text-xs text-neutral-500">
                        {rsvpLoading ? "Loading…" : `${rows.length} responses`}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                        <div className="text-neutral-400 text-xs">YES</div>
                        <div className="mt-1 text-lg font-semibold">
                          {yes.length}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                        <div className="text-neutral-400 text-xs">MAYBE</div>
                        <div className="mt-1 text-lg font-semibold">
                          {maybe.length}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                        <div className="text-neutral-400 text-xs">NO</div>
                        <div className="mt-1 text-lg font-semibold">
                          {no.length}
                        </div>
                      </div>
                    </div>

                    {/* Names */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-2">
                          Yes
                        </div>
                        <div className="space-y-1">
                          {yes.length ? (
                            yes.map((x) => (
                              <div key={x.device_id} className="text-neutral-200">
                                {x.runner_name}
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-600">—</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-2">
                          Maybe
                        </div>
                        <div className="space-y-1">
                          {maybe.length ? (
                            maybe.map((x) => (
                              <div key={x.device_id} className="text-neutral-200">
                                {x.runner_name}
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-600">—</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-2">
                          No
                        </div>
                        <div className="space-y-1">
                          {no.length ? (
                            no.map((x) => (
                              <div key={x.device_id} className="text-neutral-200">
                                {x.runner_name}
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-600">—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 text-xs text-neutral-600">
          Data source: Google Sheets CSV • RSVP writes:{" "}
          {RSVP_WEBHOOK_URL ? "Webhook enabled" : "Webhook not configured"}
        </div>
      </div>
    </main>
  );
}
