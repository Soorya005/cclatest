"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { FileCode2 } from "lucide-react"

interface FilePreviewProps {
  filePath: string | null
  content: string
  isLoading: boolean
  truncated?: boolean
}

export function FilePreview({ filePath, content, isLoading, truncated = false }: FilePreviewProps) {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-3 py-2 text-sm font-medium text-foreground flex items-center gap-2 border-b border-border flex-shrink-0">
        <FileCode2 className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{filePath ?? "File Preview (read-only)"}</span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading file content...</div>
          ) : !filePath ? (
            <div className="text-sm text-muted-foreground">Click any file in Explorer to view read-only content.</div>
          ) : (
            <>
              {truncated && (
                <div className="text-xs text-muted-foreground mb-2">Preview truncated for large file.</div>
              )}
              <pre className="text-xs leading-5 whitespace-pre-wrap break-words font-mono text-foreground">
                {content}
              </pre>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
