import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle({
  connection: {
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  },
});

// First discover the actual column names
const [cols] = await db.execute(sql`SHOW COLUMNS FROM users`);
console.log('=== Users Table Columns ===');
console.table(cols);

const [users] = await db.execute(sql`SELECT * FROM users ORDER BY createdAt`);
console.log('\n=== All Users ===');
console.table(users);

const [entries] = await db.execute(sql`SELECT userId, COUNT(*) as entry_count FROM symptom_entries GROUP BY userId`);
console.log('\n=== Symptom Entries per User ===');
console.table(entries);

const [triggers] = await db.execute(sql`SELECT userId, COUNT(*) as trigger_count FROM custom_triggers GROUP BY userId`);
console.log('\n=== Custom Triggers per User ===');
console.table(triggers);

const [notifs] = await db.execute(sql`SELECT userId, timezone FROM notification_settings`);
console.log('\n=== Notification Settings ===');
console.table(notifs);

// Check all tables
const [tables] = await db.execute(sql`SHOW TABLES`);
console.log('\n=== All Tables ===');
console.table(tables);

process.exit(0);
