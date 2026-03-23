import { eq } from "drizzle-orm";
import {
  symptomEntries,
  customTriggers,
  notificationSettings,
  medicationReminders,
  medicationGroups,
  drugInteractions,
  medicationRestocks,
  alertRules,
  alertHistory,
  customMetrics,
  customMetricValues,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { upsertEntry } from "./symptomEntries";
import {
  getTriggersByUserId,
  addCustomTrigger,
  upsertNotificationSettings,
} from "./notifications";

export async function exportUserData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Symptom entries ──
  const entries = await db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(symptomEntries.date);

  // ── Custom triggers ──
  const triggers = await db
    .select()
    .from(customTriggers)
    .where(eq(customTriggers.userId, userId));

  // ── Notification settings ──
  const notifSettings = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  // ── Medication groups ──
  const medGroups = await db
    .select()
    .from(medicationGroups)
    .where(eq(medicationGroups.userId, userId))
    .orderBy(medicationGroups.sortOrder);

  // ── Medication reminders (including archived / disabled) ──
  const medReminders = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId))
    .orderBy(medicationReminders.sortOrder);

  // ── Medication restocks ──
  const restocks = await db
    .select()
    .from(medicationRestocks)
    .where(eq(medicationRestocks.userId, userId));

  // ── Drug interactions ──
  const interactions = await db
    .select()
    .from(drugInteractions)
    .where(eq(drugInteractions.userId, userId));

  // ── Alert rules ──
  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.userId, userId));

  // ── Alert history ──
  const alerts = await db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.userId, userId));

  // ── Custom metrics ──
  const metrics = await db
    .select()
    .from(customMetrics)
    .where(eq(customMetrics.userId, userId));

  // ── Custom metric values (join via entryId → symptomEntries) ──
  const entryIds = entries.map((e) => e.id);
  let metricValues: Array<{
    entryId: number;
    metricId: number;
    value: number;
  }> = [];
  if (entryIds.length > 0) {
    const allValues = await db.select().from(customMetricValues);
    metricValues = allValues
      .filter((v) => entryIds.includes(v.entryId))
      .map((v) => ({
        entryId: v.entryId,
        metricId: v.metricId,
        value: v.value,
      }));
  }

  // Build a map from old group IDs to group names for portable restore
  const groupIdToName = new Map<number, string>();
  for (const g of medGroups) {
    groupIdToName.set(g.id, g.name);
  }

  // Build a map from old reminder IDs to medication names for portable restore
  const reminderIdToName = new Map<number, string>();
  for (const r of medReminders) {
    reminderIdToName.set(r.id, r.medicationName);
  }

  // Build a map from old metric IDs to metric names for portable restore
  const metricIdToName = new Map<number, string>();
  for (const m of metrics) {
    metricIdToName.set(m.id, m.name);
  }

  // Build a map from entryId to date for metric values
  const entryIdToDate = new Map<number, string>();
  for (const e of entries) {
    entryIdToDate.set(e.id, e.date);
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),

    entries: entries.map((e) => ({
      date: e.date,
      dizziness: e.dizziness,
      headache: e.headache,
      sleepQuality: e.sleepQuality,
      anxiety: e.anxiety,
      fatigue: e.fatigue,
      photosensitivity: e.photosensitivity,
      motionSickness: e.motionSickness,
      palpitations: e.palpitations,
      mood: e.mood,
      medications: e.medications,
      triggers: e.triggers,
      severeHeadache: e.severeHeadache,
      painkillerTaken: e.painkillerTaken,
      painkillerBrand: e.painkillerBrand,
      painkillerDosage: e.painkillerDosage,
      notes: e.notes,
    })),

    customTriggers: triggers.map((t) => ({ name: t.name })),

    notificationSettings:
      notifSettings.length > 0
        ? {
            enabled: notifSettings[0].enabled,
            reminderHour: notifSettings[0].reminderHour,
            reminderMinute: notifSettings[0].reminderMinute,
            painkillerDayLimit: notifSettings[0].painkillerDayLimit,
            painkillerAlertEnabled: notifSettings[0].painkillerAlertEnabled,
            weeklyReportFrequency: notifSettings[0].weeklyReportFrequency,
            weeklyReportHour: notifSettings[0].weeklyReportHour,
            notificationSound: notifSettings[0].notificationSound,
            timezone: notifSettings[0].timezone,
          }
        : null,

    medicationGroups: medGroups.map((g) => ({
      name: g.name,
      icon: g.icon,
      color: g.color,
      sortOrder: g.sortOrder,
    })),

    medicationReminders: medReminders.map((r) => ({
      medicationName: r.medicationName,
      dosage: r.dosage,
      reminderHour: r.reminderHour,
      reminderMinute: r.reminderMinute,
      reminderTimes: r.reminderTimes,
      enabled: r.enabled,
      repeatDays: r.repeatDays,
      offsetMinutes: r.offsetMinutes,
      stockQuantity: r.stockQuantity,
      dailyDosageCount: r.dailyDosageCount,
      stockAlertDays: r.stockAlertDays,
      instructionUrl: r.instructionUrl,
      expirationDate: r.expirationDate,
      expirationAlertDays: r.expirationAlertDays,
      groupName: r.groupId ? groupIdToName.get(r.groupId) ?? null : null,
      intervalHours: r.intervalHours,
      sortOrder: r.sortOrder,
      startDate: r.startDate,
      endDate: r.endDate,
      defaultRestockQuantity: r.defaultRestockQuantity,
    })),

    medicationRestocks: restocks.map((r) => ({
      medicationName: reminderIdToName.get(r.reminderId) ?? `reminder_${r.reminderId}`,
      restockQuantity: r.restockQuantity,
      restockDate: r.restockDate,
    })),

    drugInteractions: interactions.map((i) => ({
      drugA: i.drugA,
      drugB: i.drugB,
      severity: i.severity,
      description: i.description,
      recommendation: i.recommendation,
      source: i.source,
    })),

    alertRules: rules.map((r) => ({
      metricKey: r.metricKey,
      threshold: r.threshold,
      consecutiveDays: r.consecutiveDays,
      direction: r.direction,
      enabled: r.enabled,
    })),

    alertHistory: alerts.map((a) => ({
      metricKey: a.metricKey,
      message: a.message,
      triggeredDate: a.triggeredDate,
      isRead: a.isRead,
    })),

    customMetrics: metrics.map((m) => ({
      name: m.name,
      description: m.description,
      icon: m.icon,
      isHighGood: m.isHighGood,
      sortOrder: m.sortOrder,
    })),

    customMetricValues: metricValues.map((v) => ({
      entryDate: entryIdToDate.get(v.entryId) ?? "",
      metricName: metricIdToName.get(v.metricId) ?? `metric_${v.metricId}`,
      value: v.value,
    })),
  };
}

export async function restoreUserData(
  userId: number,
  backup: {
    version?: number;
    entries?: Array<{
      date: string;
      dizziness?: number;
      headache?: number;
      sleepQuality?: number;
      anxiety?: number;
      fatigue?: number;
      photosensitivity?: number;
      motionSickness?: number;
      palpitations?: number;
      mood?: number;
      medications?: { name: string; dosage: string }[];
      triggers?: string[];
      severeHeadache?: number;
      painkillerTaken?: number;
      painkillerBrand?: string | null;
      painkillerDosage?: string | null;
      notes?: string | null;
    }>;
    customTriggers?: Array<{ name: string }>;
    notificationSettings?: {
      enabled: number;
      reminderHour: number;
      reminderMinute: number;
      painkillerDayLimit?: number;
      painkillerAlertEnabled?: number;
      weeklyReportFrequency?: string;
      weeklyReportHour?: number;
      notificationSound?: string;
      timezone?: string;
    } | null;
    medicationGroups?: Array<{
      name: string;
      icon?: string | null;
      color?: string | null;
      sortOrder?: number;
    }>;
    medicationReminders?: Array<{
      medicationName: string;
      dosage: string;
      reminderHour: number;
      reminderMinute: number;
      reminderTimes?: { hour: number; minute: number }[] | null;
      enabled?: number;
      repeatDays?: number[] | null;
      offsetMinutes?: number;
      stockQuantity?: number | null;
      dailyDosageCount?: number | null;
      stockAlertDays?: number | null;
      instructionUrl?: string | null;
      expirationDate?: string | null;
      expirationAlertDays?: number | null;
      groupName?: string | null;
      intervalHours?: number | null;
      sortOrder?: number;
      startDate?: string | null;
      endDate?: string | null;
      defaultRestockQuantity?: number | null;
    }>;
    medicationRestocks?: Array<{
      medicationName: string;
      restockQuantity: number;
      restockDate: string;
    }>;
    drugInteractions?: Array<{
      drugA: string;
      drugB: string;
      severity?: string;
      description: string;
      recommendation?: string | null;
      source?: string;
    }>;
    alertRules?: Array<{
      metricKey: string;
      threshold?: number;
      consecutiveDays?: number;
      direction?: string;
      enabled?: number;
    }>;
    alertHistory?: Array<{
      metricKey: string;
      message: string;
      triggeredDate: string;
      isRead?: number;
    }>;
    customMetrics?: Array<{
      name: string;
      description?: string | null;
      icon?: string | null;
      isHighGood?: number;
      sortOrder?: number;
    }>;
    customMetricValues?: Array<{
      entryDate: string;
      metricName: string;
      value: number;
    }>;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let entriesRestored = 0;
  let triggersRestored = 0;
  let remindersRestored = 0;
  let groupsRestored = 0;
  let interactionsRestored = 0;
  let restocksRestored = 0;
  let alertRulesRestored = 0;
  let alertHistoryRestored = 0;
  let customMetricsRestored = 0;
  let customMetricValuesRestored = 0;

  // ── 1. Restore entries ──
  if (backup.entries && Array.isArray(backup.entries)) {
    for (const entry of backup.entries) {
      if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
      await upsertEntry(userId, {
        date: entry.date,
        dizziness: entry.dizziness ?? 0,
        headache: entry.headache ?? 0,
        sleepQuality: entry.sleepQuality ?? 5,
        anxiety: entry.anxiety ?? 0,
        fatigue: entry.fatigue ?? 0,
        photosensitivity: entry.photosensitivity ?? 0,
        motionSickness: entry.motionSickness ?? 0,
        palpitations: entry.palpitations ?? 0,
        mood: entry.mood ?? 5,
        medications: entry.medications ?? [],
        triggers: entry.triggers ?? [],
        severeHeadache: entry.severeHeadache ?? 0,
        painkillerTaken: entry.painkillerTaken ?? 0,
        painkillerBrand: entry.painkillerBrand ?? null,
        painkillerDosage: entry.painkillerDosage ?? null,
        notes: entry.notes ?? null,
      });
      entriesRestored++;
    }
  }

  // ── 2. Restore custom triggers ──
  if (backup.customTriggers && Array.isArray(backup.customTriggers)) {
    const existingTriggers = await getTriggersByUserId(userId);
    const existingNames = new Set(existingTriggers.map((t) => t.name));
    for (const trigger of backup.customTriggers) {
      if (trigger.name && !existingNames.has(trigger.name)) {
        await addCustomTrigger(userId, trigger.name);
        triggersRestored++;
      }
    }
  }

  // ── 3. Restore notification settings ──
  if (backup.notificationSettings) {
    // First upsert the core settings
    await upsertNotificationSettings(userId, {
      enabled: backup.notificationSettings.enabled ?? 1,
      reminderHour: backup.notificationSettings.reminderHour ?? 21,
      reminderMinute: backup.notificationSettings.reminderMinute ?? 0,
      timezone: backup.notificationSettings.timezone,
    });
    // Then update extended fields directly if present
    const extendedFields: Record<string, unknown> = {};
    if (backup.notificationSettings.painkillerDayLimit != null)
      extendedFields.painkillerDayLimit = backup.notificationSettings.painkillerDayLimit;
    if (backup.notificationSettings.painkillerAlertEnabled != null)
      extendedFields.painkillerAlertEnabled = backup.notificationSettings.painkillerAlertEnabled;
    if (backup.notificationSettings.weeklyReportFrequency)
      extendedFields.weeklyReportFrequency = backup.notificationSettings.weeklyReportFrequency;
    if (backup.notificationSettings.weeklyReportHour != null)
      extendedFields.weeklyReportHour = backup.notificationSettings.weeklyReportHour;
    if (backup.notificationSettings.notificationSound)
      extendedFields.notificationSound = backup.notificationSettings.notificationSound;
    if (Object.keys(extendedFields).length > 0) {
      await db
        .update(notificationSettings)
        .set(extendedFields)
        .where(eq(notificationSettings.userId, userId));
    }
  }

  // ── 4. Restore medication groups ──
  const groupNameToId = new Map<string, number>();
  if (backup.medicationGroups && Array.isArray(backup.medicationGroups)) {
    // Check existing groups to avoid duplicates
    const existingGroups = await db
      .select()
      .from(medicationGroups)
      .where(eq(medicationGroups.userId, userId));
    const existingGroupNames = new Set(existingGroups.map((g) => g.name));

    for (const eg of existingGroups) {
      groupNameToId.set(eg.name, eg.id);
    }

    for (const group of backup.medicationGroups) {
      if (!group.name) continue;
      if (existingGroupNames.has(group.name)) continue;
      const result = await db.insert(medicationGroups).values({
        userId,
        name: group.name,
        icon: group.icon ?? "Pill",
        color: group.color ?? "sage",
        sortOrder: group.sortOrder ?? 0,
      });
      groupNameToId.set(group.name, Number(result[0].insertId));
      groupsRestored++;
    }
  }

  // ── 5. Restore medication reminders ──
  const reminderNameToId = new Map<string, number>();
  if (backup.medicationReminders && Array.isArray(backup.medicationReminders)) {
    // Check existing reminders to avoid duplicates
    const existingReminders = await db
      .select()
      .from(medicationReminders)
      .where(eq(medicationReminders.userId, userId));
    const existingReminderNames = new Set(
      existingReminders.map((r) => r.medicationName)
    );

    for (const er of existingReminders) {
      reminderNameToId.set(er.medicationName, er.id);
    }

    for (const reminder of backup.medicationReminders) {
      if (!reminder.medicationName) continue;
      if (existingReminderNames.has(reminder.medicationName)) continue;

      const groupId = reminder.groupName
        ? groupNameToId.get(reminder.groupName) ?? null
        : null;

      const result = await db.insert(medicationReminders).values({
        userId,
        medicationName: reminder.medicationName,
        dosage: reminder.dosage,
        reminderHour: reminder.reminderHour,
        reminderMinute: reminder.reminderMinute,
        reminderTimes: reminder.reminderTimes ?? null,
        enabled: reminder.enabled ?? 1,
        repeatDays: reminder.repeatDays ?? null,
        offsetMinutes: reminder.offsetMinutes ?? 0,
        stockQuantity: reminder.stockQuantity ?? null,
        dailyDosageCount: reminder.dailyDosageCount ?? 1,
        stockAlertDays: reminder.stockAlertDays ?? 7,
        instructionUrl: reminder.instructionUrl ?? null,
        expirationDate: reminder.expirationDate ?? null,
        expirationAlertDays: reminder.expirationAlertDays ?? 30,
        groupId,
        intervalHours: reminder.intervalHours ?? null,
        sortOrder: reminder.sortOrder ?? 0,
        startDate: reminder.startDate ?? null,
        endDate: reminder.endDate ?? null,
        defaultRestockQuantity: reminder.defaultRestockQuantity ?? null,
      });
      reminderNameToId.set(
        reminder.medicationName,
        Number(result[0].insertId)
      );
      remindersRestored++;
    }
  }

  // ── 6. Restore medication restocks ──
  if (backup.medicationRestocks && Array.isArray(backup.medicationRestocks)) {
    for (const restock of backup.medicationRestocks) {
      const reminderId = reminderNameToId.get(restock.medicationName);
      if (!reminderId) continue;
      await db.insert(medicationRestocks).values({
        userId,
        reminderId,
        restockQuantity: restock.restockQuantity,
        restockDate: restock.restockDate,
      });
      restocksRestored++;
    }
  }

  // ── 7. Restore drug interactions ──
  if (backup.drugInteractions && Array.isArray(backup.drugInteractions)) {
    for (const interaction of backup.drugInteractions) {
      if (!interaction.drugA || !interaction.drugB) continue;
      await db.insert(drugInteractions).values({
        userId,
        drugA: interaction.drugA,
        drugB: interaction.drugB,
        severity: (interaction.severity as "mild" | "moderate" | "severe") ?? "moderate",
        description: interaction.description,
        recommendation: interaction.recommendation ?? null,
        source: interaction.source ?? "ai",
      });
      interactionsRestored++;
    }
  }

  // ── 8. Restore alert rules ──
  if (backup.alertRules && Array.isArray(backup.alertRules)) {
    const existingRules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.userId, userId));
    const existingKeys = new Set(existingRules.map((r) => r.metricKey));

    for (const rule of backup.alertRules) {
      if (!rule.metricKey || existingKeys.has(rule.metricKey)) continue;
      await db.insert(alertRules).values({
        userId,
        metricKey: rule.metricKey,
        threshold: rule.threshold ?? 7,
        consecutiveDays: rule.consecutiveDays ?? 3,
        direction: (rule.direction as "above" | "below") ?? "above",
        enabled: rule.enabled ?? 1,
      });
      alertRulesRestored++;
    }
  }

  // ── 9. Restore alert history ──
  if (backup.alertHistory && Array.isArray(backup.alertHistory)) {
    // Restore alert history by finding matching rule IDs
    const currentRules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.userId, userId));
    const metricToRuleId = new Map<string, number>();
    for (const r of currentRules) {
      metricToRuleId.set(r.metricKey, r.id);
    }

    for (const alert of backup.alertHistory) {
      const ruleId = metricToRuleId.get(alert.metricKey);
      if (!ruleId) continue;
      await db.insert(alertHistory).values({
        userId,
        ruleId,
        metricKey: alert.metricKey,
        message: alert.message,
        triggeredDate: alert.triggeredDate,
        isRead: alert.isRead ?? 0,
      });
      alertHistoryRestored++;
    }
  }

  // ── 10. Restore custom metrics ──
  const metricNameToId = new Map<string, number>();
  if (backup.customMetrics && Array.isArray(backup.customMetrics)) {
    const existingMetrics = await db
      .select()
      .from(customMetrics)
      .where(eq(customMetrics.userId, userId));
    const existingNames = new Set(existingMetrics.map((m) => m.name));

    for (const em of existingMetrics) {
      metricNameToId.set(em.name, em.id);
    }

    for (const metric of backup.customMetrics) {
      if (!metric.name || existingNames.has(metric.name)) continue;
      const result = await db.insert(customMetrics).values({
        userId,
        name: metric.name,
        description: metric.description ?? null,
        icon: metric.icon ?? "Activity",
        isHighGood: metric.isHighGood ?? 0,
        sortOrder: metric.sortOrder ?? 0,
      });
      metricNameToId.set(metric.name, Number(result[0].insertId));
      customMetricsRestored++;
    }
  }

  // ── 11. Restore custom metric values ──
  if (backup.customMetricValues && Array.isArray(backup.customMetricValues)) {
    // Build entryDate → entryId map from current entries
    const currentEntries = await db
      .select({ id: symptomEntries.id, date: symptomEntries.date })
      .from(symptomEntries)
      .where(eq(symptomEntries.userId, userId));
    const dateToEntryId = new Map<string, number>();
    for (const e of currentEntries) {
      dateToEntryId.set(e.date, e.id);
    }

    for (const mv of backup.customMetricValues) {
      const entryId = dateToEntryId.get(mv.entryDate);
      const metricId = metricNameToId.get(mv.metricName);
      if (!entryId || !metricId) continue;
      await db.insert(customMetricValues).values({
        entryId,
        metricId,
        value: mv.value,
      });
      customMetricValuesRestored++;
    }
  }

  return {
    entriesRestored,
    triggersRestored,
    remindersRestored,
    groupsRestored,
    interactionsRestored,
    restocksRestored,
    alertRulesRestored,
    alertHistoryRestored,
    customMetricsRestored,
    customMetricValuesRestored,
  };
}
