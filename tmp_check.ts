import { getSheet } from "./src/lib/sheets";

async function run() {
    const raw = await getSheet("API_Leaderboard!A2:F200");
    console.log(JSON.stringify(raw, null, 2));
}

run();
