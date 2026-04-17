"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronRight, FileCode, Folder, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RepositoryTreeNode } from "@/lib/api"

interface RepositoryTreeProps {
  tree: RepositoryTreeNode[]
  isLoading: boolean
  selectedFilePath: string | null
  onSelectFile: (filePath: string) => void
}

export function RepositoryTree({ tree, isLoading, selectedFilePath, onSelectFile }: RepositoryTreeProps) {
  const initialExpanded = useMemo(() => {
    return new Set(tree.filter((node) => node.type === "directory").map((node) => node.path))
  }, [tree])

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded)

  useEffect(() => {
    setExpanded(initialExpanded)
  }, [initialExpanded])

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const renderNode = (node: RepositoryTreeNode, depth: number) => {
    const isDirectory = node.type === "directory"
    const isOpen = isDirectory && expanded.has(node.path)

    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-mono hover:bg-white/[0.05]",
            isDirectory ? "text-white/70" : "text-white/50",
            !isDirectory && selectedFilePath === node.path && "bg-white/[0.08] text-white",
            isDirectory ? "cursor-pointer" : "cursor-default"
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => {
            if (isDirectory) {
              toggle(node.path)
              return
            }
            onSelectFile(node.path)
          }}
        >
          {isDirectory ? (
            <>
              <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
              {isOpen ? (
                <FolderOpen className="h-4 w-4 text-foreground" />
              ) : (
                <Folder className="h-4 w-4 text-foreground" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5" />
              <FileCode className={cn("h-3.5 w-3.5", selectedFilePath === node.path ? "text-blue-400" : "text-white/40")} />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>

        {isDirectory && isOpen && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="w-full select-none">
      <div className="py-1">
        {isLoading ? (
          <div className="px-2 py-3 text-xs text-white/30">Loading file tree...</div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-3 text-xs text-white/30">Load a repository to view files.</div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  )
}
