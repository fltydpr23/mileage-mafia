import { google } from "googleapis";

export const dynamic = "force-dynamic";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getSheetsClient() {
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");

  // Service account creds
  const clientEmail = requiredEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, spreadsheetId };
}

// ─── Simple In-Memory Cache to prevent 429s ───────────────────────────────────
const cache = new Map<string, { data: any[][]; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Read values from a sheet range.
 * Example: getSheet("API_Leaderboard!A2:F200")
 */
export async function getSheet(rangeA1: string) {
  const now = Date.now();
  const cached = cache.get(rangeA1);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const { sheets, spreadsheetId } = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
  });

  const data = res.data.values ?? [];
  cache.set(rangeA1, { data, timestamp: now });
  return data;
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
 * Example: appendRow("API_ContractLog!A:G", ["...", "..."])
 */
export async function appendRow(rangeA1: string, values: (string | number)[]) {
  const { sheets, spreadsheetId } = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: rangeA1,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [values],
    },
  });
  
  clearSheetCache();
}

/**
 * Overwrite a range with the given 2D array of values.
 * Example: writeSheet("_StravaTokens!A2:D2", [["tok", "ref", "123", ""]])
 */
export async function writeSheet(rangeA1: string, values: (string | number)[][]) {
  const { sheets, spreadsheetId } = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: rangeA1,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
  
  clearSheetCache();
}
