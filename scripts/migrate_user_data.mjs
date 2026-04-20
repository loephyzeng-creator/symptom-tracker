import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle({
  connection: {
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  },
});

const FROM_USER_ID = 4;        // Loephy Zeng (loephyzeng@gmail.com)
const TO_USER_ID = 420363;     // Longfei ZENG (lfzeng@autelrobotics.com)

console.log(`\n=== Migrating data from user ${FROM_USER_ID} to user ${TO_USER_ID} ===\n`);

// 1. Symptom entries
const [entries] = await db.execute(sql`SELECT COUNT(*) as cnt FROM symptom_entries WHERE userId = ${FROM_USER_ID}`);
console.log(`Symptom entries to migrate: ${entries[0].cnt}`);
await db.execute(sql`UPDATE symptom_entries SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
console.log('✓ Symptom entries migrated');

// 2. Custom triggers
const [triggers] = await db.execute(sql`SELECT COUNT(*) as cnt FROM custom_triggers WHERE userId = ${FROM_USER_ID}`);
console.log(`Custom triggers to migrate: ${triggers[0].cnt}`);
await db.execute(sql`UPDATE custom_triggers SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
console.log('✓ Custom triggers migrated');

// 3. Notification settings - merge (keep target's if exists, copy source's if not)
const [notifTarget] = await db.execute(sql`SELECT COUNT(*) as cnt FROM notification_settings WHERE userId = ${TO_USER_ID}`);
const [notifSource] = await db.execute(sql`SELECT COUNT(*) as cnt FROM notification_settings WHERE userId = ${FROM_USER_ID}`);
console.log(`Notification settings: source=${notifSource[0].cnt}, target=${notifTarget[0].cnt}`);
if (notifSource[0].cnt > 0 && notifTarget[0].cnt > 0) {
  // Target already has settings, copy timezone from source if target has default
  await db.execute(sql`UPDATE notification_settings SET timezone = (SELECT timezone FROM (SELECT timezone FROM notification_settings WHERE userId = ${FROM_USER_ID}) as tmp) WHERE userId = ${TO_USER_ID}`);
  console.log('✓ Notification settings: timezone copied to target');
} else if (notifSource[0].cnt > 0) {
  await db.execute(sql`UPDATE notification_settings SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Notification settings migrated');
}

// 4. Push subscriptions
const [pushSubs] = await db.execute(sql`SELECT COUNT(*) as cnt FROM push_subscriptions WHERE userId = ${FROM_USER_ID}`);
console.log(`Push subscriptions to migrate: ${pushSubs[0].cnt}`);
if (pushSubs[0].cnt > 0) {
  await db.execute(sql`UPDATE push_subscriptions SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Push subscriptions migrated');
}

// 5. Custom metrics
const [metrics] = await db.execute(sql`SELECT COUNT(*) as cnt FROM custom_metrics WHERE userId = ${FROM_USER_ID}`);
console.log(`Custom metrics to migrate: ${metrics[0].cnt}`);
if (metrics[0].cnt > 0) {
  await db.execute(sql`UPDATE custom_metrics SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Custom metrics migrated');
}

// 6. Custom metric values
const [metricVals] = await db.execute(sql`SELECT COUNT(*) as cnt FROM custom_metric_values WHERE userId = ${FROM_USER_ID}`);
console.log(`Custom metric values to migrate: ${metricVals[0].cnt}`);
if (metricVals[0].cnt > 0) {
  await db.execute(sql`UPDATE custom_metric_values SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Custom metric values migrated');
}

// 7. Alert rules
const [alertRules] = await db.execute(sql`SELECT COUNT(*) as cnt FROM alert_rules WHERE userId = ${FROM_USER_ID}`);
console.log(`Alert rules to migrate: ${alertRules[0].cnt}`);
if (alertRules[0].cnt > 0) {
  await db.execute(sql`UPDATE alert_rules SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Alert rules migrated');
}

// 8. Alert history
const [alertHist] = await db.execute(sql`SELECT COUNT(*) as cnt FROM alert_history WHERE userId = ${FROM_USER_ID}`);
console.log(`Alert history to migrate: ${alertHist[0].cnt}`);
if (alertHist[0].cnt > 0) {
  await db.execute(sql`UPDATE alert_history SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Alert history migrated');
}

// 9. Medication reminders
const [medReminders] = await db.execute(sql`SELECT COUNT(*) as cnt FROM medication_reminders WHERE userId = ${FROM_USER_ID}`);
console.log(`Medication reminders to migrate: ${medReminders[0].cnt}`);
if (medReminders[0].cnt > 0) {
  await db.execute(sql`UPDATE medication_reminders SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Medication reminders migrated');
}

// 10. Medication groups
const [medGroups] = await db.execute(sql`SELECT COUNT(*) as cnt FROM medication_groups WHERE userId = ${FROM_USER_ID}`);
console.log(`Medication groups to migrate: ${medGroups[0].cnt}`);
if (medGroups[0].cnt > 0) {
  await db.execute(sql`UPDATE medication_groups SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Medication groups migrated');
}

// 11. Medication restocks
const [restocks] = await db.execute(sql`SELECT COUNT(*) as cnt FROM medication_restocks WHERE userId = ${FROM_USER_ID}`);
console.log(`Medication restocks to migrate: ${restocks[0].cnt}`);
if (restocks[0].cnt > 0) {
  await db.execute(sql`UPDATE medication_restocks SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Medication restocks migrated');
}

// 12. Article favorites
const [favs] = await db.execute(sql`SELECT COUNT(*) as cnt FROM article_favorites WHERE userId = ${FROM_USER_ID}`);
console.log(`Article favorites to migrate: ${favs[0].cnt}`);
if (favs[0].cnt > 0) {
  await db.execute(sql`UPDATE article_favorites SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ Article favorites migrated');
}

// 13. Health articles (user-created)
const [articles] = await db.execute(sql`SELECT COUNT(*) as cnt FROM health_articles WHERE userId = ${FROM_USER_ID}`);
console.log(`User health articles to migrate: ${articles[0].cnt}`);
if (articles[0].cnt > 0) {
  await db.execute(sql`UPDATE health_articles SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
  console.log('✓ User health articles migrated');
}

// 14. Article read history (check if table has userId)
try {
  const [readHist] = await db.execute(sql`SELECT COUNT(*) as cnt FROM article_read_history WHERE userId = ${FROM_USER_ID}`);
  console.log(`Article read history to migrate: ${readHist[0].cnt}`);
  if (readHist[0].cnt > 0) {
    await db.execute(sql`UPDATE article_read_history SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
    console.log('✓ Article read history migrated');
  }
} catch(e) {
  console.log('Article read history: skipped (table may not have userId)');
}

// 15. Trigger tips
try {
  const [tips] = await db.execute(sql`SELECT COUNT(*) as cnt FROM trigger_tips WHERE userId = ${FROM_USER_ID}`);
  console.log(`Trigger tips to migrate: ${tips[0].cnt}`);
  if (tips[0].cnt > 0) {
    await db.execute(sql`UPDATE trigger_tips SET userId = ${TO_USER_ID} WHERE userId = ${FROM_USER_ID}`);
    console.log('✓ Trigger tips migrated');
  }
} catch(e) {
  console.log('Trigger tips: skipped');
}

// Verify migration
console.log('\n=== Verification ===');
const [newEntries] = await db.execute(sql`SELECT userId, COUNT(*) as cnt FROM symptom_entries WHERE userId = ${TO_USER_ID} GROUP BY userId`);
console.log(`Target user symptom entries: ${newEntries[0]?.cnt || 0}`);
const [oldEntries] = await db.execute(sql`SELECT COUNT(*) as cnt FROM symptom_entries WHERE userId = ${FROM_USER_ID}`);
console.log(`Source user remaining entries: ${oldEntries[0].cnt}`);

console.log('\n✅ Data migration complete!');
process.exit(0);
