import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle({
  connection: {
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  },
});

const FROM = 4;
const TO = 420363;

// Note: symptom_entries, custom_triggers, notification_settings, push_subscriptions already migrated
// custom_metric_values has no userId (linked via entryId which is already migrated)
// custom_metrics has no userId column either - check:

const tables = [
  'custom_metrics',
  'alert_rules',
  'alert_history',
  'medication_reminders',
  'medication_groups',
  'drug_interactions',
  'medication_restocks',
  'article_favorites',
  'health_articles',
  'article_read_history',
  'trigger_tips',
];

for (const table of tables) {
  try {
    const [rows] = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM \`${table}\` WHERE userId = ${FROM}`));
    const cnt = rows[0].cnt;
    console.log(`${table}: ${cnt} rows`);
    if (cnt > 0) {
      await db.execute(sql.raw(`UPDATE \`${table}\` SET userId = ${TO} WHERE userId = ${FROM}`));
      console.log(`  ✓ Migrated`);
    }
  } catch (e) {
    console.log(`${table}: skipped (${e.cause?.sqlMessage || e.message})`);
  }
}

// Verify final state
console.log('\n=== Final Verification ===');
const [targetEntries] = await db.execute(sql`SELECT COUNT(*) as cnt FROM symptom_entries WHERE userId = ${TO}`);
console.log(`Target user (${TO}) symptom entries: ${targetEntries[0].cnt}`);
const [sourceEntries] = await db.execute(sql`SELECT COUNT(*) as cnt FROM symptom_entries WHERE userId = ${FROM}`);
console.log(`Source user (${FROM}) remaining entries: ${sourceEntries[0].cnt}`);

console.log('\n✅ Remaining data migration complete!');
process.exit(0);
