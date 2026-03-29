import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getArticles,
  getArticleById,
  searchArticles,
  getArticlesByTriggers,
  getCategories,
  getUserFavoriteIds,
  getUserFavoriteArticles,
  toggleFavorite,
  seedPresetArticles,
  createUserArticle,
  updateUserArticle,
  deleteUserArticle,
  getUserArticles,
  recordArticleRead,
  getReadHistory,
  getRecentlyReadArticles,
  getRecommendedArticles,
} from "../db";
import { PRESET_ARTICLES } from "../knowledgeBaseSeed";

/** Seed preset articles on first access */
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  await seedPresetArticles(PRESET_ARTICLES);
  seeded = true;
}

export const knowledgeBaseRouter = router({
  /** List articles, optionally filtered by category */
  list: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      await ensureSeeded();
      return getArticles(input?.category);
    }),

  /** Get a single article by ID */
  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      await ensureSeeded();
      return getArticleById(input.id);
    }),

  /** Search articles by keyword */
  search: publicProcedure
    .input(z.object({ keyword: z.string().min(1) }))
    .query(async ({ input }) => {
      await ensureSeeded();
      return searchArticles(input.keyword);
    }),

  /** Get articles related to specific triggers */
  byTriggers: publicProcedure
    .input(z.object({ triggers: z.array(z.string()) }))
    .query(async ({ input }) => {
      await ensureSeeded();
      return getArticlesByTriggers(input.triggers);
    }),

  /** Get all distinct categories */
  categories: publicProcedure.query(async () => {
    await ensureSeeded();
    return getCategories();
  }),

  /** Get current user's favorite article IDs */
  favoriteIds: protectedProcedure.query(async ({ ctx }) => {
    return getUserFavoriteIds(ctx.user.id);
  }),

  /** Get current user's favorite articles (full data) */
  favorites: protectedProcedure.query(async ({ ctx }) => {
    await ensureSeeded();
    return getUserFavoriteArticles(ctx.user.id);
  }),

  /** Toggle favorite status for an article */
  toggleFavorite: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return toggleFavorite(ctx.user.id, input.articleId);
    }),

  /* ─── User Custom Articles ─── */

  /** Create a user-contributed article */
  createArticle: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        category: z.string().min(1).max(50),
        tags: z.array(z.string()).default([]),
        summary: z.string().min(1).max(500),
        content: z.string().min(1),
        relatedTriggers: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createUserArticle(ctx.user.id, input);
    }),

  /** Update a user-contributed article */
  updateArticle: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        category: z.string().min(1).max(50).optional(),
        tags: z.array(z.string()).optional(),
        summary: z.string().min(1).max(500).optional(),
        content: z.string().min(1).optional(),
        relatedTriggers: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateUserArticle(ctx.user.id, id, data);
    }),

  /** Delete a user-contributed article */
  deleteArticle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteUserArticle(ctx.user.id, input.id);
    }),

  /** Get current user's custom articles */
  myArticles: protectedProcedure.query(async ({ ctx }) => {
    return getUserArticles(ctx.user.id);
  }),

  /* ─── Reading History ─── */

  /** Record that the user read an article */
  recordRead: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await recordArticleRead(ctx.user.id, input.articleId);
      return { success: true };
    }),

  /** Get user's reading history (article IDs + timestamps) */
  readHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return getReadHistory(ctx.user.id, input?.limit ?? 20);
    }),

  /** Get user's recently read articles (full data) */
  recentlyRead: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      await ensureSeeded();
      return getRecentlyReadArticles(ctx.user.id, input?.limit ?? 20);
    }),

  /* ─── AI Recommendations ─── */

  /** Get AI-recommended articles based on user's recent triggers */
  recommendations: protectedProcedure
    .input(z.object({ triggers: z.array(z.string()), limit: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      await ensureSeeded();
      const triggers = input?.triggers ?? [];
      const limit = input?.limit ?? 5;
      return getRecommendedArticles(triggers, limit);
    }),
});
