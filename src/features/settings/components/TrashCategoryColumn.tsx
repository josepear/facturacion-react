import { type Dispatch, type SetStateAction } from "react";

import { formatTrashItemPath } from "@/features/settings/lib/formatTrashItemPath";
import type { TrashItem } from "@/infrastructure/api/trashApi";
import { cn } from "@/lib/utils";

export function TrashCategoryColumn({
  title,
  items,
  selectedPaths,
  setSelectedPaths,
  className,
}: {
  title: string;
  items: TrashItem[];
  selectedPaths: string[];
  setSelectedPaths: Dispatch<SetStateAction<string[]>>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-2 rounded-md border border-border bg-muted/10 p-3",
        className,
      )}
    >
      <p className="shrink-0 text-sm font-semibold capitalize text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-informative">Sin elementos.</p>
      ) : (
        <ul className="grid max-h-[min(52vh,26rem)] gap-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5 sm:max-h-[min(56vh,30rem)]">
          {items.map((item) => {
            const { primary, secondary } = formatTrashItemPath(item.path);
            return (
              <li key={item.path} className="flex min-w-0 items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                  checked={selectedPaths.includes(item.path)}
                  onChange={(event) => {
                    setSelectedPaths((prev) =>
                      event.target.checked
                        ? [...prev, item.path]
                        : prev.filter((path) => path !== item.path),
                    );
                  }}
                />
                <div className="min-w-0 flex-1 space-y-0.5" title={item.path}>
                  <p className="truncate font-medium text-foreground">{primary}</p>
                  {secondary ? (
                    <p className="truncate font-mono text-xs text-informative">{secondary}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded border px-1.5 py-0.5 text-informative">{item.fileType}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
