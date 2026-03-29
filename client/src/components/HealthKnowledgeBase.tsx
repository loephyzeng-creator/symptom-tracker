/**
 * HealthKnowledgeBase — A searchable, categorized health knowledge base
 * with favorites support. Displays preset articles about headache management,
 * dietary advice, sleep improvement, stress management, etc.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Search,
  BookOpen,
  Heart,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Tag,
  Filter,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Streamdown } from "streamdown";

/* ─── Category color mapping ─── */
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "饮食调理": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  "睡眠改善": { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  "心理健康": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  "生活习惯": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  "环境因素": { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200 dark:border-sky-800" },
  "头痛管理": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  "运动康复": { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  "用药知识": { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
};

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] ?? {
    bg: "bg-gray-50 dark:bg-gray-900/30",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-700",
  };
}

/* ─── Article type ─── */
interface Article {
  id: number;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
  source: string | null;
  relatedTriggers: string[];
}

/* ─── Article Card ─── */
function ArticleCard({
  article,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: {
  article: Article;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
}) {
  const style = getCategoryStyle(article.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-xl border border-border/40 overflow-hidden cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span
              className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${style.bg} ${style.text} ${style.border} border mb-1.5`}
            >
              {article.category}
            </span>
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {article.title}
            </h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              isFavorite
                ? "text-red-500 bg-red-50 dark:bg-red-950/30"
                : "text-muted-foreground hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20"
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {article.summary}
        </p>
        {article.relatedTriggers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {article.relatedTriggers.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Article Detail View ─── */
function ArticleDetail({
  article,
  isFavorite,
  onToggleFavorite,
  onBack,
}: {
  article: Article;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
}) {
  const style = getCategoryStyle(article.category);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text} ${style.border} border`}>
          {article.category}
        </span>
        <div className="flex-1" />
        <button
          onClick={onToggleFavorite}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
            isFavorite
              ? "text-red-500 bg-red-50 dark:bg-red-950/30"
              : "text-muted-foreground hover:text-red-400"
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-foreground mb-2 font-serif">{article.title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{article.summary}</p>

      {/* Tags */}
      {article.relatedTriggers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <Tag className="w-3 h-3 text-muted-foreground mt-0.5" />
          {article.relatedTriggers.map((t) => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded-full bg-accent/60 text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-[13px] [&_p]:leading-relaxed [&_li]:text-[13px] [&_li]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1">
        <Streamdown>{article.content}</Streamdown>
      </div>

      {/* Source */}
      {article.source && (
        <div className="mt-6 pt-3 border-t border-border/30">
          <p className="text-[11px] text-muted-foreground">
            参考来源：{article.source}
          </p>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main Component ─── */
export default function HealthKnowledgeBase({
  initialTriggerFilter,
  onBack,
}: {
  initialTriggerFilter?: string[];
  onBack?: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [triggerFilter] = useState<string[]>(initialTriggerFilter ?? []);

  // Queries
  const articlesQuery = trpc.knowledgeBase.list.useQuery(
    selectedCategory ? { category: selectedCategory } : undefined
  );
  const searchQuery_ = trpc.knowledgeBase.search.useQuery(
    { keyword: searchQuery },
    { enabled: searchQuery.length > 0 }
  );
  const triggerArticlesQuery = trpc.knowledgeBase.byTriggers.useQuery(
    { triggers: triggerFilter },
    { enabled: triggerFilter.length > 0 && !searchQuery && !selectedCategory }
  );
  const categoriesQuery = trpc.knowledgeBase.categories.useQuery();
  const favoriteIdsQuery = trpc.knowledgeBase.favoriteIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const favoritesQuery = trpc.knowledgeBase.favorites.useQuery(undefined, {
    enabled: isAuthenticated && showFavoritesOnly,
  });

  const toggleFavMutation = trpc.knowledgeBase.toggleFavorite.useMutation({
    onSuccess: () => {
      favoriteIdsQuery.refetch();
      favoritesQuery.refetch();
    },
  });

  const favoriteIds = useMemo(
    () => new Set(favoriteIdsQuery.data ?? []),
    [favoriteIdsQuery.data]
  );

  // Determine which articles to display
  const displayArticles = useMemo(() => {
    if (showFavoritesOnly) return favoritesQuery.data ?? [];
    if (searchQuery.length > 0) return searchQuery_.data ?? [];
    if (triggerFilter.length > 0 && !selectedCategory) return triggerArticlesQuery.data ?? [];
    return articlesQuery.data ?? [];
  }, [
    showFavoritesOnly,
    favoritesQuery.data,
    searchQuery,
    searchQuery_.data,
    triggerFilter,
    selectedCategory,
    triggerArticlesQuery.data,
    articlesQuery.data,
  ]);

  const categories = categoriesQuery.data ?? [];
  const isLoading =
    articlesQuery.isLoading ||
    (searchQuery.length > 0 && searchQuery_.isLoading);

  // If viewing article detail
  if (selectedArticle) {
    return (
      <div className="space-y-3">
        <ArticleDetail
          article={selectedArticle}
          isFavorite={favoriteIds.has(selectedArticle.id)}
          onToggleFavorite={() =>
            toggleFavMutation.mutate({ articleId: selectedArticle.id })
          }
          onBack={() => setSelectedArticle(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
        <BookOpen className="w-5 h-5 text-terracotta" />
        <h2 className="text-base font-bold text-foreground font-serif">健康知识库</h2>
        <div className="flex-1" />
        {isAuthenticated && (
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
              showFavoritesOnly
                ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                : "bg-accent/50 text-muted-foreground hover:bg-accent"
            }`}
          >
            <Heart className={`w-3 h-3 ${showFavoritesOnly ? "fill-current" : ""}`} />
            收藏
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索健康知识..."
          className="w-full pl-9 pr-8 py-2.5 text-sm bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filters */}
      {!showFavoritesOnly && !searchQuery && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
              !selectedCategory
                ? "bg-terracotta text-white"
                : "bg-accent/50 text-muted-foreground hover:bg-accent"
            }`}
          >
            全部
          </button>
          {categories.map((cat) => {
            const style = getCategoryStyle(cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors border ${
                  cat === selectedCategory
                    ? `${style.bg} ${style.text} ${style.border}`
                    : "bg-accent/30 text-muted-foreground border-transparent hover:bg-accent/50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Trigger filter indicator */}
      {triggerFilter.length > 0 && !selectedCategory && !searchQuery && !showFavoritesOnly && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/30 rounded-lg px-3 py-2">
          <Filter className="w-3 h-3" />
          <span>
            显示与 <strong className="text-foreground">{triggerFilter.join("、")}</strong> 相关的文章
          </span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayArticles.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {showFavoritesOnly
              ? "还没有收藏的文章"
              : searchQuery
              ? "没有找到相关文章"
              : "暂无文章"}
          </p>
        </div>
      )}

      {/* Article list */}
      <div className="space-y-2.5">
        {displayArticles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article as Article}
            isFavorite={favoriteIds.has(article.id)}
            onToggleFavorite={() =>
              toggleFavMutation.mutate({ articleId: article.id })
            }
            onSelect={() => setSelectedArticle(article as Article)}
          />
        ))}
      </div>
    </div>
  );
}
