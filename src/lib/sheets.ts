import crypto from "crypto";

export const dynamic = "force-dynamic";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function base64url(source: Buffer | string): string {
  const encoded = typeof source === "string" ? Buffer.from(source).toString("base64") : source.toString("base64");
  return encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const clientEmail = requiredEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const claimSet = JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowSec + 3600,
    iat: nowSec,
  });

  const unsignedToken = `${base64url(header)}.${base64url(claimSet)}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);
  const signature = sign
    .sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Auth Failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access_token returned from Google Auth");
  }

  const expiresIn = Number(data.expires_in) || 3600;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
  };

  return data.access_token;
}

// ─── In-Memory Data Cache & Retries ───────────────────────────────────────────
const cache = new Map<string, { data: any[][]; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

async function fetchWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Sheets API] Request attempt ${i + 1}/${maxRetries} failed:`, err?.message || err);
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 300 + Math.random() * 200));
    }
  }
  throw lastErr;
}

/**
 * Read values from a Google Sheet range.
 */
export async function getSheet(rangeA1: string): Promise<any[][]> {
  const now = Date.now();
  const cached = cache.get(rangeA1);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
    const token = await getAccessToken();

    const data = await fetchWithRetry(async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeA1)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Sheets API Read (${res.status}): ${errText}`);
      }

      const json = await res.json();
      return json.values ?? [];
    });

    cache.set(rangeA1, { data, timestamp: now });
    return data;
  } catch (err: any) {
    console.error(`[Sheets API getSheet Error] Range "${rangeA1}":`, err?.message || err);
    if (cached && cached.data) {
      console.warn(`[Sheets API Fallback] Serving cached data for "${rangeA1}"`);
      return cached.data;
    }
    return [];
  }
}

export function clearSheetCache(rangeA1?: string) {
  if (rangeA1) {
    cache.delete(rangeA1);
  } else {
    cache.clear();
  }
}

/**
 * Append a single row to a sheet.
 */
export async function appendRow(rangeA1: string, values: (string | number)[]) {
  try {
    const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
    const token = await getAccessToken();

    await fetchWithRetry(async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeA1)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Sheets API Append (${res.status}): ${errText}`);
      }
    });

    clearSheetCache();
  } catch (err: any) {
    console.error(`[Sheets API appendRow Error]:`, err?.message || err);
  }
}

/**
 * Overwrite a range with the given 2D array of values.
 */
export async function writeSheet(rangeA1: string, values: (string | number)[][]) {
  try {
    const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
    const token = await getAccessToken();

    await fetchWithRetry(async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeA1)}?valueInputOption=USER_ENTERED`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Sheets API Update (${res.status}): ${errText}`);
      }
    });

    clearSheetCache();
  } catch (err: any) {
    console.error(`[Sheets API writeSheet Error]:`, err?.message || err);
  }
}
