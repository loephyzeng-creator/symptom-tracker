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
});
