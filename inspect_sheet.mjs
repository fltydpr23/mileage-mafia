import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Assuming you have a .env.local file or similar to get the service account details.
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
});

async function run() {
    try {
        const clientEmail = env['"GOOGLE_CLIENT_EMAIL"'] || env['GOOGLE_CLIENT_EMAIL'];
        let privateKey = env['"GOOGLE_PRIVATE_KEY"'] || env['GOOGLE_PRIVATE_KEY'];
        if (privateKey) privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
        const sheetId = env['"GOOGLE_SHEETS_ID"'] || env['GOOGLE_SHEETS_ID'];
        // Remove quotes from sheetId and clientEmail if present
        const cleanSheetId = sheetId ? sheetId.replace(/^"|"$/g, '') : null;
        const cleanEmail = clientEmail ? clientEmail.replace(/^"|"$/g, '') : null;

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: cleanEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: cleanSheetId,
            range: 'API_Weekly!A1:ZZ10', // Inspect API_Weekly structure
        });

        console.log("Headers:");
        console.log(res.data.values[0].map((v, i) => `[${i}] ${v}`).join('\n'));
        console.log("\nRow 1:");
        console.log(res.data.values[1].map((v, i) => `[${i}] ${v}`).join('\n'));
    } catch(e) {
        console.error(e);
    }
}
run();
