import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Symptom entries — one row per user per date.
 * Stores all 9 symptom scores, medications (JSON array), triggers (JSON array), and notes.
 */
export const symptomEntries = mysqlTable("symptom_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  dizziness: int("dizziness").default(0).notNull(),
  headache: int("headache").default(0).notNull(),
  sleepQuality: int("sleepQuality").default(5).notNull(),
  anxiety: int("anxiety").default(0).notNull(),
  fatigue: int("fatigue").default(0).notNull(),
  photosensitivity: int("photosensitivity").default(0).notNull(),
  motionSickness: int("motionSickness").default(0).notNull(),
  palpitations: int("palpitations").default(0).notNull(),
  mood: int("mood").default(5).notNull(),
  medications: json("medications").$type<{ name: string; dosage: string }[]>().default([]).notNull(),
  triggers: json("triggers").$type<string[]>().default([]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SymptomEntry = typeof symptomEntries.$inferSelect;
export type InsertSymptomEntry = typeof symptomEntries.$inferInsert;

/**
 * Custom triggers per user — user-defined trigger labels beyond the defaults.
 */
export const customTriggers = mysqlTable("custom_triggers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomTrigger = typeof customTriggers.$inferSelect;
export type InsertCustomTrigger = typeof customTriggers.$inferInsert;
