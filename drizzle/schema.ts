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
  medications: json("medications").$type<{ name: string; dosage: string; reminderId?: number }[]>().default([]).notNull(),
  triggers: json("triggers").$type<string[]>().default([]).notNull(),
  severeHeadache: int("severeHeadache").default(0).notNull(), // 1 = yes, 0 = no
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

/**
 * Notification settings per user — controls daily reminder push.
 */
export const notificationSettings = mysqlTable("notification_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  enabled: int("enabled").default(1).notNull(), // 1 = on, 0 = off
  reminderHour: int("reminderHour").default(21).notNull(), // 0-23, default 9pm
  reminderMinute: int("reminderMinute").default(0).notNull(), // 0-59
  lastNotifiedDate: varchar("lastNotifiedDate", { length: 10 }), // YYYY-MM-DD, prevent duplicate notifications
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = typeof notificationSettings.$inferInsert;

/**
 * Push subscriptions — stores Web Push subscription info per user per device.
 */
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

/**
 * Custom symptom metrics per user — user-defined symptom indicators beyond the default 9.
 * Each metric has a name and optional description, scored 0-10 like built-in metrics.
 * Values are stored in the customMetricValues table.
 */
export const customMetrics = mysqlTable("custom_metrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  icon: varchar("icon", { length: 50 }).default("Activity"),
  isHighGood: int("isHighGood").default(0).notNull(), // 0 = high is bad (like headache), 1 = high is good (like mood)
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomMetric = typeof customMetrics.$inferSelect;
export type InsertCustomMetric = typeof customMetrics.$inferInsert;

/**
 * Custom metric values — stores the score for each custom metric per entry.
 */
export const customMetricValues = mysqlTable("custom_metric_values", {
  id: int("id").autoincrement().primaryKey(),
  entryId: int("entryId").notNull(),
  metricId: int("metricId").notNull(),
  value: int("value").default(0).notNull(), // 0-10
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomMetricValue = typeof customMetricValues.$inferSelect;
export type InsertCustomMetricValue = typeof customMetricValues.$inferInsert;

/**
 * Symptom alert rules per user — triggers notification when a metric exceeds
 * a threshold for consecutive days.
 */
export const alertRules = mysqlTable("alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  metricKey: varchar("metricKey", { length: 50 }).notNull(), // e.g. "dizziness", "headache"
  threshold: int("threshold").default(7).notNull(), // score threshold (0-10)
  consecutiveDays: int("consecutiveDays").default(3).notNull(), // how many days in a row
  direction: mysqlEnum("direction", ["above", "below"]).default("above").notNull(), // above = score >= threshold triggers alert
  enabled: int("enabled").default(1).notNull(), // 1 = on, 0 = off
  lastTriggeredDate: varchar("lastTriggeredDate", { length: 10 }), // prevent duplicate alerts same day
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

/**
 * Alert history — log of triggered alerts for display in the app.
 */
export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ruleId: int("ruleId").notNull(),
  metricKey: varchar("metricKey", { length: 50 }).notNull(),
  message: text("message").notNull(),
  triggeredDate: varchar("triggeredDate", { length: 10 }).notNull(),
  isRead: int("isRead").default(0).notNull(), // 0 = unread, 1 = read
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertHistoryRow = typeof alertHistory.$inferSelect;
export type InsertAlertHistoryRow = typeof alertHistory.$inferInsert;

/**
 * Medication reminders per user — each row is one medication with its own schedule.
 * Different medications can have different dosages and reminder times.
 */
export const medicationReminders = mysqlTable("medication_reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  medicationName: varchar("medicationName", { length: 200 }).notNull(),
  dosage: varchar("dosage", { length: 100 }).notNull(),
  reminderHour: int("reminderHour").notNull(), // 0-23
  reminderMinute: int("reminderMinute").notNull(), // 0-59
  enabled: int("enabled").default(1).notNull(), // 1 = on, 0 = off
  repeatDays: json("repeatDays").$type<number[]>(), // 0=Sun..6=Sat, null means every day
  offsetMinutes: int("offsetMinutes").default(0).notNull(), // negative=before, positive=after
  snoozedUntil: varchar("snoozedUntil", { length: 20 }), // ISO datetime for snooze, e.g. "2026-03-21T08:15"
  stockQuantity: int("stockQuantity"), // remaining quantity (null = not tracking)
  dailyDosageCount: int("dailyDosageCount").default(1), // how many doses per day
  stockAlertDays: int("stockAlertDays").default(7), // alert when stock runs out within N days
  lastStockAlertDate: varchar("lastStockAlertDate", { length: 10 }), // prevent duplicate stock alerts
  instructionUrl: text("instructionUrl"), // URL to medication instructions/leaflet
  expirationDate: varchar("expirationDate", { length: 10 }), // YYYY-MM-DD, medication expiration date
  expirationAlertDays: int("expirationAlertDays").default(30), // alert N days before expiration
  lastExpirationAlertDate: varchar("lastExpirationAlertDate", { length: 10 }), // prevent duplicate expiration alerts
  lastNotifiedDate: varchar("lastNotifiedDate", { length: 10 }), // YYYY-MM-DD, prevent duplicate
  groupId: int("groupId"), // FK to medication_groups.id, null = ungrouped
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MedicationReminder = typeof medicationReminders.$inferSelect;
export type InsertMedicationReminder = typeof medicationReminders.$inferInsert;

/**
 * Medication groups per user — group multiple medications together
 * (e.g., "早晨药组", "晚间药组") for batch management and one-tap confirmation.
 */
export const medicationGroups = mysqlTable("medication_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).default("Pill"), // Lucide icon name
  color: varchar("color", { length: 20 }).default("sage"), // Theme color key
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MedicationGroup = typeof medicationGroups.$inferSelect;
export type InsertMedicationGroup = typeof medicationGroups.$inferInsert;
