"use client"

import { useEffect, useRef } from "react"
import { Bot, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  codeBlocks?: { language: string; code: string }[]
}

interface AIExplanationPanelProps {
  messages: Message[]
  isLoading: boolean
}

// Automatically detect and render ```code``` blocks inside the LLM's raw markdown text
function MessageContentFormatter({ content }: { content: string }) {
  if (!content) return null

  // Split by markdown code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <div className="flex min-w-0 flex-col gap-1 w-full max-w-full">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const contentWithoutBackticks = part.slice(3, -3)
          const firstNewline = contentWithoutBackticks.indexOf('\n')
          
          let lang = "text"
          let code = contentWithoutBackticks

          if (firstNewline !== -1) {
            lang = contentWithoutBackticks.slice(0, firstNewline).trim() || "text"
            code = contentWithoutBackticks.slice(firstNewline + 1)
          }

          return (
            <div
              key={index}
              className="mt-2 mb-2 rounded-lg border border-white/10 bg-black/50 overflow-hidden w-full max-w-full"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
                <FileCode className="h-3 w-3 text-white/40" />
                <span className="text-[10px] font-mono text-white/50">{lang}</span>
              </div>
              <div className="p-3 w-full overflow-x-auto">
                <pre className="text-[11px] font-mono text-white/60 leading-relaxed whitespace-pre min-w-max">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          )
        }

        // Render standard text, handling any remaining normal paragraphs
        if (part.trim()) {
          return (
            <div key={index} className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {part}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

export function AIExplanationPanel({ messages, isLoading }: AIExplanationPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  useEffect(() => {
    const node = scrollContainerRef.current
    if (!node) return

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, isLoading])

  return (
    <div className="h-full flex flex-col w-full min-h-0">
      <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-white/50" />
          <h2 className="text-xs font-semibold text-white/70 uppercase tracking-widest">Copilot</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div ref={scrollContainerRef} className="absolute inset-0 w-full overflow-y-auto">
          <div className="p-4 space-y-6 pb-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center select-none">
              <div className="p-4 rounded-full bg-white/[0.02] border border-white/5 mb-4">
                <Bot className="h-6 w-6 text-white/40" />
              </div>
              <p className="text-xs text-white/40 max-w-[200px] leading-relaxed">
                Hi! Load a repository to start analyzing your code.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex min-w-0 gap-3",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border",
                    message.role === "user"
                      ? "bg-blue-600/20 border-blue-500/30 text-blue-400"
                      : "bg-white/[0.03] border-white/10 text-white/60"
                  )}
                >
                  {message.role === "user" ? (
                    <span className="text-[10px] font-bold">You</span>
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0 max-w-[85%]",
                    message.role === "user" ? "text-right" : ""
                  )}
                >
                  <div
                    className={cn(
                      "flex min-w-0 flex-col px-4 py-3 rounded-2xl border max-w-full overflow-hidden",
                      message.role === "user"
                        ? "w-fit ml-auto bg-blue-600/10 border-blue-500/20 text-white/90 rounded-tr-sm"
                        : "w-full bg-white/[0.03] border-white/5 text-white/80 rounded-tl-sm"
                    )}
                  >
                    <MessageContentFormatter content={message.content} />
                    {message.codeBlocks?.map((block, index) => (
                      <div
                        key={index}
                        className="mt-3 rounded-lg overflow-hidden border border-white/10 bg-black/50"
                      >
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
                          <FileCode className="h-3 w-3 text-white/40" />
                          <span className="text-[10px] font-mono text-white/50">{block.language}</span>
                        </div>
                        <pre className="p-3 text-[11px] overflow-x-auto font-mono text-white/60 leading-relaxed whitespace-pre min-w-max">
                          <code>{block.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border bg-white/[0.03] border-white/10 text-white/60">
                <Bot className="h-4 w-4 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3.5 rounded-2xl border bg-white/[0.03] border-white/5 rounded-tl-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
