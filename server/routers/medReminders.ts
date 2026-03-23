import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getMedicationReminders,
  addMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder,
  snoozeMedicationReminder,
  getMedicationAdherence,
  getMissedMedicationAlerts,
  getMedicationStockStatus,
  deductMedicationStock,
  getMedicationTimeline,
  getMedicationCheckInCalendar,
  confirmMedicationTaken,
  unconfirmMedicationTaken,
  getTodayMedications,
  getExpiringMedications,
  getMedicationCheckInDayDetail,
  getMedCompletionByDates,
  batchUpdateMedicationReminders,
  reorderMedicationReminders,
  addMedicationRestock,
  getRestockHistory,
  getStockChangeLog,
  deleteMedicationRestock,
  batchRestockMedications,
  getMonthlyMedicationConsumption,
} from "../db";
import { getDateStrInTimezone, getDateTimeStrInTimezone, DEFAULT_TIMEZONE } from "../../shared/timezone";

export const medRemindersRouter = router({
  /** List all medication reminders for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMedicationReminders(ctx.user.id);
  }),

  /** Get monthly medication consumption trend (last N months) */
  monthlyConsumption: protectedProcedure
    .input(z.object({ months: z.number().min(1).max(12).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return getMonthlyMedicationConsumption(ctx.user.id, input?.months ?? 6);
    }),

  /** Add a new medication reminder */
  add: protectedProcedure
    .input(
      z.object({
        medicationName: z.string().min(1).max(200),
        dosage: z.string().min(1).max(100),
        reminderHour: z.number().min(0).max(23),
        reminderMinute: z.number().min(0).max(59),
        reminderTimes: z.array(z.object({ hour: z.number().min(0).max(23), minute: z.number().min(0).max(59) })).nullable().optional(),
        repeatDays: z.array(z.number().min(0).max(6)).optional(),
        offsetMinutes: z.number().min(-120).max(120).optional(),
        stockQuantity: z.number().min(0).nullable().optional(),
        dailyDosageCount: z.number().min(1).max(20).optional(),
        stockAlertDays: z.number().min(1).max(90).optional(),
        instructionUrl: z.string().url().max(2000).nullable().optional(),
        expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        expirationAlertDays: z.number().min(1).max(365).optional(),
        groupId: z.number().nullable().optional(),
        intervalHours: z.number().min(1).max(72).nullable().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        defaultRestockQuantity: z.number().min(1).max(9999).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return addMedicationReminder(ctx.user.id, input);
    }),

  /** Update a medication reminder */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        medicationName: z.string().min(1).max(200).optional(),
        dosage: z.string().min(1).max(100).optional(),
        reminderHour: z.number().min(0).max(23).optional(),
        reminderMinute: z.number().min(0).max(59).optional(),
        reminderTimes: z.array(z.object({ hour: z.number().min(0).max(23), minute: z.number().min(0).max(59) })).nullable().optional(),
        enabled: z.number().min(0).max(1).optional(),
        repeatDays: z.array(z.number().min(0).max(6)).optional(),
        offsetMinutes: z.number().min(-120).max(120).optional(),
        stockQuantity: z.number().min(0).nullable().optional(),
        dailyDosageCount: z.number().min(1).max(20).optional(),
        stockAlertDays: z.number().min(1).max(90).optional(),
        instructionUrl: z.string().url().max(2000).nullable().optional(),
        expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        expirationAlertDays: z.number().min(1).max(365).optional(),
        groupId: z.number().nullable().optional(),
        intervalHours: z.number().min(1).max(72).nullable().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        defaultRestockQuantity: z.number().min(1).max(9999).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateMedicationReminder(id, ctx.user.id, data);
      return { success: true };
    }),

  /** Snooze a medication reminder for 15 minutes */
  snooze: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const snoozeTime = new Date(Date.now() + 15 * 60 * 1000);
      const snoozeUntil = getDateTimeStrInTimezone(DEFAULT_TIMEZONE, snoozeTime).replace(" ", "T");
      await snoozeMedicationReminder(input.id, ctx.user.id, snoozeUntil);
      return { success: true, snoozeUntil };
    }),

  /** Delete a medication reminder */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteMedicationReminder(input.id, ctx.user.id);
      return { success: true };
    }),

  /** Get missed medication alerts (consecutive days missed) */
  missedAlerts: protectedProcedure
    .input(
      z.object({
        threshold: z.number().min(1).max(14).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return getMissedMedicationAlerts(ctx.user.id, input?.threshold ?? 3);
    }),

  /** Get medication adherence statistics */
  adherence: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      return getMedicationAdherence(ctx.user.id, input.startDate, input.endDate);
    }),

  /** Get historical stats for a specific archived medication */
  archivedStats: protectedProcedure
    .input(z.object({ reminderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const reminders = await getMedicationReminders(ctx.user.id);
      const reminder = reminders.find((r: any) => r.id === input.reminderId);
      if (!reminder) return { totalDays: 0, takenDays: 0, adherenceRate: 0, dateRange: '' };
      
      const startDate = reminder.startDate || reminder.createdAt?.toISOString().slice(0, 10) || '2024-01-01';
      const endDate = reminder.endDate || getDateStrInTimezone(DEFAULT_TIMEZONE);
      
      const adherence = await getMedicationAdherence(ctx.user.id, startDate, endDate);
      const medStats = adherence.perMedication.find(
        (m: any) => m.name.toLowerCase() === reminder.medicationName.toLowerCase()
      );
      
      return {
        totalDays: medStats?.expected ?? 0,
        takenDays: medStats?.taken ?? 0,
        adherenceRate: medStats?.rate ?? 0,
        dateRange: `${startDate} ~ ${endDate}`,
      };
    }),

  /** Get medication stock status */
  stockStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return getMedicationStockStatus(ctx.user.id);
    }),

  /** Deduct stock for a medication (when user records taking it) */
  deductStock: protectedProcedure
    .input(z.object({ medicationName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await deductMedicationStock(ctx.user.id, input.medicationName);
      return { success: true };
    }),

  /** Get medication timeline for history view */
  timeline: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      return getMedicationTimeline(ctx.user.id, input.startDate, input.endDate);
    }),

  /** Get check-in calendar data for a given month */
  checkInCalendar: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      return getMedicationCheckInCalendar(ctx.user.id, input.year, input.month);
    }),

  /** Confirm medication taken (from push notification action) */
  confirmTaken: protectedProcedure
    .input(z.object({ reminderId: z.number(), timeIndex: z.number().optional(), note: z.string().max(200).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      return confirmMedicationTaken(ctx.user.id, input.reminderId, input.timeIndex, input.note, input.date);
    }),

  /** Unconfirm medication taken (remove from today's entry and restore stock) */
  unconfirmTaken: protectedProcedure
    .input(z.object({ reminderId: z.number(), timeIndex: z.number().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      return unconfirmMedicationTaken(ctx.user.id, input.reminderId, input.timeIndex, input.date);
    }),

  /** Get today's medications from reminders (for auto-filling symptom form) */
  todayMeds: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      return getTodayMedications(ctx.user.id, input.date);
    }),

  /** Get medications that are expiring soon or already expired */
  expiring: protectedProcedure.query(async ({ ctx }) => {
    return getExpiringMedications(ctx.user.id);
  }),

  /** Get detailed medication check-in info for a specific day */
  dayDetail: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      return getMedicationCheckInDayDetail(ctx.user.id, input.date);
    }),

  /** Get medication completion status for multiple dates (for history filtering) */
  completionByDates: protectedProcedure
    .input(z.object({ dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366) }))
    .query(async ({ ctx, input }) => {
      return getMedCompletionByDates(ctx.user.id, input.dates);
    }),

  /** Batch delete multiple medication reminders */
  batchDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await deleteMedicationReminder(id, ctx.user.id);
      }
      return { success: true };
    }),

  /** Reorder medication reminders */
  reorder: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await reorderMedicationReminders(ctx.user.id, input.orderedIds);
      return { success: true };
    }),

  /** Batch update multiple medication reminders */
  batchUpdate: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1),
        enabled: z.number().min(0).max(1).optional(),
        reminderHour: z.number().min(0).max(23).optional(),
        reminderMinute: z.number().min(0).max(59).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ids, ...data } = input;
      await batchUpdateMedicationReminders(ctx.user.id, ids, data);
      return { success: true };
    }),

  /** Add a restock record for a single medication */
  restock: protectedProcedure
    .input(
      z.object({
        reminderId: z.number(),
        restockQuantity: z.number().min(1).max(99999),
        restockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return addMedicationRestock(ctx.user.id, input.reminderId, input.restockQuantity, input.restockDate);
    }),

  /** Get restock history for a medication */
  restockHistory: protectedProcedure
    .input(z.object({ reminderId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getRestockHistory(ctx.user.id, input.reminderId);
    }),

  /** Get stock change log (restocks + usage) for a medication */
  stockChangeLog: protectedProcedure
    .input(z.object({ reminderId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getStockChangeLog(ctx.user.id, input.reminderId);
    }),

  /** Delete a specific restock record */
  deleteRestock: protectedProcedure
    .input(z.object({ restockId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteMedicationRestock(ctx.user.id, input.restockId);
    }),

  /** Batch restock all low-stock medications */
  batchRestock: protectedProcedure
    .input(
      z.object({
        restockQuantity: z.number().min(1).max(9999),
        restockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return batchRestockMedications(ctx.user.id, input.restockQuantity, input.restockDate);
    }),
});
