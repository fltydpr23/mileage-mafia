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

/**
 * Read values from a sheet range.
 * Example: getSheet("API_Leaderboard!A2:F200")
 */
export async function getSheet(rangeA1: string) {
  const { sheets, spreadsheetId } = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
  });

  return res.data.values ?? [];
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
}
