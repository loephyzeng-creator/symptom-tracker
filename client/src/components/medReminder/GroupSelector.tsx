import { trpc } from "@/lib/trpc";
import { Folder } from "lucide-react";

export default function GroupSelector({
  groupId,
  onChange,
}: {
  groupId: number | null;
  onChange: (gId: number | null) => void;
}) {
  const { data: groups = [] } = trpc.medGroups.list.useQuery(undefined);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Folder className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">药品分组</span>
        <span className="text-xs text-muted-foreground">(可选)</span>
      </div>
      <select
        value={groupId ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? Number(val) : null);
        }}
        className="bg-transparent border border-border rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">未分组</option>
        {groups.map((g: any) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </div>
  );
}
