/**
 * HealthKnowledgeBase — A searchable, categorized health knowledge base
 * with favorites, user custom articles, AI recommendations, and reading history.
 */
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Search,
  BookOpen,
  Heart,
  ChevronLeft,
  Tag,
  Filter,
  X,
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  Clock,
  Save,
  FileText,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  "个人笔记": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
};

const ALL_CATEGORIES = [
  "饮食调理", "睡眠改善", "心理健康", "生活习惯",
  "环境因素", "头痛管理", "运动康复", "用药知识", "个人笔记",
];

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
  isPreset: number;
  userId?: number | null;
}

/* ─── Article Card ─── */
function ArticleCard({
  article,
  isFavorite,
  isOwn,
  onToggleFavorite,
  onSelect,
  onEdit,
  onDelete,
}: {
  article: Article;
  isFavorite: boolean;
  isOwn: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const style = getCategoryStyle(article.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border/40 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${style.bg} ${style.text} ${style.border} border`}
              >
                {article.category}
              </span>
              {isOwn && (
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800">
                  <User className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />
                  我的
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {article.title}
            </h3>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {isOwn && onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {isOwn && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                isFavorite
                  ? "text-red-500 bg-red-50 dark:bg-red-950/30"
                  : "text-muted-foreground hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
            </button>
          </div>
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
        {article.isPreset === 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800">
            我的笔记
          </span>
        )}
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

      <h2 className="text-lg font-bold text-foreground mb-2 font-serif">{article.title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{article.summary}</p>

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

      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-[13px] [&_p]:leading-relaxed [&_li]:text-[13px] [&_li]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1">
        <Streamdown>{article.content}</Streamdown>
      </div>

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

/* ─── Article Editor Form ─── */
function ArticleEditor({
  initialData,
  onSave,
  onCancel,
  isSaving,
}: {
  initialData?: Partial<Article>;
  onSave: (data: {
    title: string;
    category: string;
    tags: string[];
    summary: string;
    content: string;
    relatedTriggers: string[];
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "个人笔记");
  const [tagsStr, setTagsStr] = useState((initialData?.tags ?? []).join("、"));
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [triggersStr, setTriggersStr] = useState(
    (initialData?.relatedTriggers ?? []).join("、")
  );

  const handleSubmit = () => {
    if (!title.trim() || !summary.trim() || !content.trim()) {
      toast.error("标题、摘要和内容不能为空");
      return;
    }
    const tags = tagsStr.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
    const relatedTriggers = triggersStr.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
    onSave({ title: title.trim(), category, tags, summary: summary.trim(), content: content.trim(), relatedTriggers });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <FileText className="w-5 h-5 text-terracotta" />
        <h2 className="text-base font-bold text-foreground font-serif">
          {initialData?.id ? "编辑笔记" : "写调理笔记"}
        </h2>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">标题 *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：我的头痛缓解方法"
          maxLength={200}
          className="w-full px-3 py-2.5 text-sm bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">分类</label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const style = getCategoryStyle(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`text-[11px] px-2.5 py-1 rounded-full transition-colors border ${
                  cat === category
                    ? `${style.bg} ${style.text} ${style.border}`
                    : "bg-accent/30 text-muted-foreground border-transparent hover:bg-accent/50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">摘要 *</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="简要描述这篇笔记的内容..."
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2.5 text-sm bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 text-foreground placeholder:text-muted-foreground resize-none"
        />
      </div>

      {/* Content */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">正文 * (支持 Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里写下你的调理方案、经验心得..."
          rows={8}
          className="w-full px-3 py-2.5 text-sm bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 text-foreground placeholder:text-muted-foreground resize-y font-mono"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">标签 (用顿号分隔)</label>
        <input
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          placeholder="例如：头痛、按摩、穴位"
          className="w-full px-3 py-2.5 text-sm bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Related Triggers */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">关联诱因 (用顿号分隔)</label>
        <input
          value={triggersStr}
          onChange={(e) => setTriggersStr(e.target.value)}
          placeholder="例如：上火、压力大、睡眠不足"
          className="w-full px-3 py-2.5 text-sm bg-card border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="flex-1 text-xs"
        >
          取消
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSaving || !title.trim() || !summary.trim() || !content.trim()}
          className="flex-1 text-xs bg-terracotta hover:bg-terracotta/90 text-white"
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </div>
    </motion.div>
  );
}

/* ─── AI Recommendation Cards ─── */
function RecommendationSection({
  triggers,
  onSelectArticle,
  favoriteIds,
  onToggleFavorite,
}: {
  triggers: string[];
  onSelectArticle: (article: Article) => void;
  favoriteIds: Set<number>;
  onToggleFavorite: (articleId: number) => void;
}) {
  const recQuery = trpc.knowledgeBase.recommendations.useQuery(
    { triggers, limit: 3 },
    { enabled: triggers.length > 0 }
  );

  if (!triggers.length || !recQuery.data?.length) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">为你推荐</span>
        <span className="text-[10px] text-amber-600/70 dark:text-amber-400/60 ml-1">
          基于你的常见诱因
        </span>
      </div>
      <div className="space-y-2">
        {recQuery.data.map((article: any) => (
          <button
            key={article.id}
            onClick={() => onSelectArticle(article as Article)}
            className="w-full text-left bg-white/60 dark:bg-white/5 rounded-lg p-2.5 hover:bg-white/90 dark:hover:bg-white/10 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground line-clamp-1">{article.title}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{article.summary}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {article.relevanceScore > 1 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    高度相关
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(article.id); }}
                  className={`w-6 h-6 flex items-center justify-center rounded ${
                    favoriteIds.has(article.id) ? "text-red-500" : "text-muted-foreground/50"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${favoriteIds.has(article.id) ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter Tab Type ─── */
type FilterTab = "all" | "favorites" | "myArticles" | "recent";

/* ─── Main Component ─── */
export default function HealthKnowledgeBase({
  initialTriggerFilter,
  onBack,
}: {
  initialTriggerFilter?: string[];
  onBack?: () => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [triggerFilter] = useState<string[]>(initialTriggerFilter ?? []);
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Queries
  const articlesQuery = trpc.knowledgeBase.list.useQuery(
    selectedCategory ? { category: selectedCategory } : undefined
  );
  const searchResults = trpc.knowledgeBase.search.useQuery(
    { keyword: searchQuery },
    { enabled: searchQuery.length > 0 }
  );
  const triggerArticlesQuery = trpc.knowledgeBase.byTriggers.useQuery(
    { triggers: triggerFilter },
    { enabled: triggerFilter.length > 0 && !searchQuery && !selectedCategory && activeFilter === "all" }
  );
  const categoriesQuery = trpc.knowledgeBase.categories.useQuery();
  const favoriteIdsQuery = trpc.knowledgeBase.favoriteIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const favoritesQuery = trpc.knowledgeBase.favorites.useQuery(undefined, {
    enabled: isAuthenticated && activeFilter === "favorites",
  });
  const myArticlesQuery = trpc.knowledgeBase.myArticles.useQuery(undefined, {
    enabled: isAuthenticated && activeFilter === "myArticles",
  });
  const recentlyReadQuery = trpc.knowledgeBase.recentlyRead.useQuery(undefined, {
    enabled: isAuthenticated && activeFilter === "recent",
  });

  // Get recent triggers for AI recommendations (from symptom entries)
  const entriesQuery = trpc.entries.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const recentTriggers = useMemo(() => {
    if (!entriesQuery.data) return [];
    // Get triggers from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);
    const recentEntries = entriesQuery.data.filter((e: any) => e.date >= dateStr);
    const triggerCounts: Record<string, number> = {};
    for (const entry of recentEntries) {
      for (const t of (entry.triggers as string[] ?? [])) {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      }
    }
    // Return top triggers sorted by frequency
    return Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
  }, [entriesQuery.data]);

  // Mutations
  const toggleFavMutation = trpc.knowledgeBase.toggleFavorite.useMutation({
    onSuccess: () => {
      utils.knowledgeBase.favoriteIds.invalidate();
      utils.knowledgeBase.favorites.invalidate();
    },
  });

  const createMutation = trpc.knowledgeBase.createArticle.useMutation({
    onSuccess: () => {
      toast.success("笔记已保存");
      setShowEditor(false);
      setEditingArticle(null);
      utils.knowledgeBase.list.invalidate();
      utils.knowledgeBase.myArticles.invalidate();
      utils.knowledgeBase.categories.invalidate();
    },
    onError: () => toast.error("保存失败，请重试"),
  });

  const updateMutation = trpc.knowledgeBase.updateArticle.useMutation({
    onSuccess: () => {
      toast.success("笔记已更新");
      setShowEditor(false);
      setEditingArticle(null);
      utils.knowledgeBase.list.invalidate();
      utils.knowledgeBase.myArticles.invalidate();
    },
    onError: () => toast.error("更新失败，请重试"),
  });

  const deleteMutation = trpc.knowledgeBase.deleteArticle.useMutation({
    onSuccess: () => {
      toast.success("笔记已删除");
      setDeleteConfirm(null);
      utils.knowledgeBase.list.invalidate();
      utils.knowledgeBase.myArticles.invalidate();
      utils.knowledgeBase.favorites.invalidate();
      utils.knowledgeBase.favoriteIds.invalidate();
    },
    onError: () => toast.error("删除失败，请重试"),
  });

  const recordReadMutation = trpc.knowledgeBase.recordRead.useMutation({
    onSuccess: () => {
      utils.knowledgeBase.recentlyRead.invalidate();
      utils.knowledgeBase.readHistory.invalidate();
    },
  });

  const favoriteIds = useMemo(
    () => new Set(favoriteIdsQuery.data ?? []),
    [favoriteIdsQuery.data]
  );

  // Handle article selection (record reading history)
  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    if (isAuthenticated) {
      recordReadMutation.mutate({ articleId: article.id });
    }
  };

  // Determine which articles to display
  const displayArticles = useMemo(() => {
    if (activeFilter === "favorites") return favoritesQuery.data ?? [];
    if (activeFilter === "myArticles") return myArticlesQuery.data ?? [];
    if (activeFilter === "recent") return (recentlyReadQuery.data ?? []).filter((a): a is NonNullable<typeof a> => !!a);
    if (searchQuery.length > 0) return searchResults.data ?? [];
    if (triggerFilter.length > 0 && !selectedCategory) return triggerArticlesQuery.data ?? [];
    return articlesQuery.data ?? [];
  }, [
    activeFilter,
    favoritesQuery.data,
    myArticlesQuery.data,
    recentlyReadQuery.data,
    searchQuery,
    searchResults.data,
    triggerFilter,
    selectedCategory,
    triggerArticlesQuery.data,
    articlesQuery.data,
  ]);

  const categories = categoriesQuery.data ?? [];
  const isLoading =
    articlesQuery.isLoading ||
    (searchQuery.length > 0 && searchResults.isLoading) ||
    (activeFilter === "favorites" && favoritesQuery.isLoading) ||
    (activeFilter === "myArticles" && myArticlesQuery.isLoading) ||
    (activeFilter === "recent" && recentlyReadQuery.isLoading);

  // Editor view
  if (showEditor) {
    return (
      <ArticleEditor
        initialData={editingArticle ?? undefined}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onCancel={() => {
          setShowEditor(false);
          setEditingArticle(null);
        }}
        onSave={(data) => {
          if (editingArticle?.id) {
            updateMutation.mutate({ id: editingArticle.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
      />
    );
  }

  // Article detail view
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
            onClick={() => { setEditingArticle(null); setShowEditor(true); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-terracotta/10 text-terracotta hover:bg-terracotta/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            写笔记
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setActiveFilter("all"); }}
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

      {/* Filter tabs */}
      {isAuthenticated && !searchQuery && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: "all" as FilterTab, label: "全部", icon: BookOpen },
            { key: "favorites" as FilterTab, label: "收藏", icon: Heart },
            { key: "myArticles" as FilterTab, label: "我的笔记", icon: FileText },
            { key: "recent" as FilterTab, label: "最近阅读", icon: Clock },
          ]).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveFilter(tab.key); setSelectedCategory(null); }}
                className={`shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  activeFilter === tab.key
                    ? "bg-terracotta text-white"
                    : "bg-accent/50 text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className={`w-3 h-3 ${activeFilter === tab.key && tab.key === "favorites" ? "fill-current" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Category filters (only in "all" tab) */}
      {activeFilter === "all" && !searchQuery && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
              !selectedCategory
                ? "bg-foreground/10 text-foreground font-medium"
                : "bg-accent/30 text-muted-foreground hover:bg-accent/50"
            }`}
          >
            全部分类
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
      {triggerFilter.length > 0 && activeFilter === "all" && !selectedCategory && !searchQuery && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/30 rounded-lg px-3 py-2">
          <Filter className="w-3 h-3" />
          <span>
            显示与 <strong className="text-foreground">{triggerFilter.join("、")}</strong> 相关的文章
          </span>
        </div>
      )}

      {/* AI Recommendations (only in "all" tab, no search, no trigger filter) */}
      {isAuthenticated && activeFilter === "all" && !searchQuery && triggerFilter.length === 0 && !selectedCategory && (
        <RecommendationSection
          triggers={recentTriggers}
          onSelectArticle={handleSelectArticle}
          favoriteIds={favoriteIds}
          onToggleFavorite={(id) => toggleFavMutation.mutate({ articleId: id })}
        />
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
            {activeFilter === "favorites"
              ? "还没有收藏的文章"
              : activeFilter === "myArticles"
              ? "还没有写过笔记"
              : activeFilter === "recent"
              ? "还没有阅读记录"
              : searchQuery
              ? "没有找到相关文章"
              : "暂无文章"}
          </p>
          {activeFilter === "myArticles" && (
            <button
              onClick={() => { setEditingArticle(null); setShowEditor(true); }}
              className="mt-3 text-xs text-terracotta hover:underline"
            >
              写第一篇调理笔记
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteConfirm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card rounded-xl p-5 shadow-xl max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-medium text-foreground mb-1">确认删除</p>
              <p className="text-xs text-muted-foreground mb-4">删除后无法恢复，确定要删除这篇笔记吗？</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 text-xs"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => deleteMutation.mutate({ id: deleteConfirm })}
                  disabled={deleteMutation.isPending}
                  className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white"
                >
                  {deleteMutation.isPending ? "删除中..." : "确认删除"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Article list */}
      <div className="space-y-2.5">
        {displayArticles.map((article) => {
          if (!article) return null;
          return (
            <ArticleCard
              key={article.id}
              article={article as Article}
              isFavorite={favoriteIds.has(article.id)}
              isOwn={article.isPreset === 0 && (article as any).userId === user?.id}
              onToggleFavorite={() =>
                toggleFavMutation.mutate({ articleId: article.id })
              }
              onSelect={() => handleSelectArticle(article as Article)}
              onEdit={
                article.isPreset === 0 && (article as any).userId === user?.id
                  ? () => { setEditingArticle(article as Article); setShowEditor(true); }
                  : undefined
              }
              onDelete={
                article.isPreset === 0 && (article as any).userId === user?.id
                  ? () => setDeleteConfirm(article.id)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
