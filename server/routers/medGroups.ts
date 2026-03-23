import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getMedicationGroups,
  getMedicationRemindersGrouped,
  createMedicationGroup,
  updateMedicationGroup,
  deleteMedicationGroup,
  assignMedicationToGroup,
  batchAssignMedicationsToGroup,
  confirmGroupMedicationsTaken,
} from "../db";

export const medGroupsRouter = router({
  /** List all medication groups */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMedicationGroups(ctx.user.id);
  }),

  /** Get reminders grouped by group */
  grouped: protectedProcedure.query(async ({ ctx }) => {
    return getMedicationRemindersGrouped(ctx.user.id);
  }),

  /** Create a new group */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        icon: z.string().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createMedicationGroup(ctx.user.id, input);
    }),

  /** Update a group */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateMedicationGroup(ctx.user.id, id, data);
      return { success: true };
    }),

  /** Delete a group (medications become ungrouped) */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteMedicationGroup(ctx.user.id, input.id);
      return { success: true };
    }),

  /** Assign a medication to a group */
  assign: protectedProcedure
    .input(
      z.object({
        reminderId: z.number(),
        groupId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assignMedicationToGroup(ctx.user.id, input.reminderId, input.groupId);
      return { success: true };
    }),

  /** Batch assign medications to a group */
  batchAssign: protectedProcedure
    .input(
      z.object({
        reminderIds: z.array(z.number()),
        groupId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await batchAssignMedicationsToGroup(ctx.user.id, input.reminderIds, input.groupId);
      return { success: true };
    }),

  /** One-tap confirm all group medications as taken */
  confirmAll: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return confirmGroupMedicationsTaken(ctx.user.id, input.groupId);
    }),
});
