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
    <div className="flex flex-col h-full bg-black">
      {/* VS Code Style Tab Bar */}
      <div className="flex items-center h-10 border-b border-white/5 bg-[#0a0a0a] overflow-x-auto no-scrollbar">
        {filePath ? (
          <div className="flex items-center gap-2 px-4 h-full bg-black border-t-2 border-t-blue-500 min-w-max border-r border-white/5">
            <FileCode2 className="h-3.5 w-3.5 text-blue-400 font-bold" />
            <span className="text-xs font-mono text-white/90">{filePath.split("/").pop()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 h-full bg-black border-t-2 border-t-transparent min-w-max">
            <span className="text-xs text-white/30 italic">No file selected</span>
          </div>
        )}
      </div>

      {/* Editor Content Area */}
      <ScrollArea className="flex-1 bg-black overflow-auto">
        <div className="p-6">
          {isLoading ? (
            <div className="text-xs text-white/30 font-mono">Loading file content...</div>
          ) : !filePath ? (
            <div className="text-xs text-white/30 flex items-center justify-center h-[200px] border border-dashed border-white/5 rounded-xl font-mono">
              Select a file from the Explorer to preview its contents here
            </div>
          ) : (
            <>
              {truncated && (
                <div className="text-[10px] uppercase font-bold tracking-widest text-orange-400/80 mb-4 px-3 py-2 bg-orange-500/10 rounded-md border border-orange-500/20 inline-block">
                  Warning: Content truncated for large file
                </div>
              )}
              <pre className="text-sm leading-loose whitespace-pre-wrap break-all font-mono text-white/70">
                {content}
              </pre>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
