import { getDb } from "./connection";
import { triggerTips } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/** Get all custom trigger tips for a user */
export async function getTriggerTipsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(triggerTips).where(eq(triggerTips.userId, userId));
}

/** Upsert a trigger tip — create or update by userId + trigger name */
export async function upsertTriggerTip(
  userId: number,
  trigger: string,
  data: { title?: string | null; recommended: string[]; avoid: string[]; tip?: string | null }
) {
  const db = await getDb();
  if (!db) return { id: 0, updated: false };

  const existing = await db
    .select()
    .from(triggerTips)
    .where(and(eq(triggerTips.userId, userId), eq(triggerTips.trigger, trigger)));

  if (existing.length > 0) {
    await db
      .update(triggerTips)
      .set({
        title: data.title ?? null,
        recommended: data.recommended,
        avoid: data.avoid,
        tip: data.tip ?? null,
      })
      .where(and(eq(triggerTips.userId, userId), eq(triggerTips.trigger, trigger)));
    return { id: existing[0].id, updated: true };
  } else {
    const result = await db.insert(triggerTips).values({
      userId,
      trigger,
      title: data.title ?? null,
      recommended: data.recommended,
      avoid: data.avoid,
      tip: data.tip ?? null,
    });
    return { id: result[0].insertId, updated: false };
  }
}

/** Delete a custom trigger tip */
export async function deleteTriggerTip(userId: number, trigger: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(triggerTips)
    .where(and(eq(triggerTips.userId, userId), eq(triggerTips.trigger, trigger)));
}
