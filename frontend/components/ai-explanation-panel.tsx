"use client"

import { useEffect, useRef } from "react"
import { Bot, FileCode, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  codeBlocks?: { language: string; code: string }[]
  sources?: { file: string; symbol: string; line: number }[]
}

interface AIExplanationPanelProps {
  messages: Message[]
  isLoading: boolean
  streamingMessageId?: string
  onSourceClick?: (filePath: string) => void
}

function MessageContentFormatter({ content }: { content: string }) {
  if (!content) return null

  return (
    <div className="flex min-w-0 flex-col gap-1 w-full max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const lang = match ? match[1] : 'text'
            
            if (!inline && match) {
              return (
                <div className="mt-2 mb-2 rounded-lg border border-white/10 bg-black/50 overflow-hidden w-full max-w-full">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
                    <FileCode className="h-3 w-3 text-white/40" />
                    <span className="text-[10px] font-mono text-white/50">{lang}</span>
                  </div>
                  <div className="p-3 w-full overflow-x-auto">
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={lang}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        padding: 0,
                        background: "transparent",
                        fontSize: "11px",
                        lineHeight: "1.6",
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )
            }
            return (
              <code className="bg-white/10 rounded px-1.5 py-0.5 text-xs font-mono break-words" {...props}>
                {children}
              </code>
            )
          },
          p: ({ children }) => <p className="text-sm leading-relaxed text-white/80 mb-3 last:mb-0 [overflow-wrap:anywhere]">{children}</p>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{children}</a>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-3 text-sm text-white/80 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-3 text-sm text-white/80 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white/90">{children}</strong>,
          em: ({ children }) => <em className="italic text-white/70">{children}</em>,
          table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full text-sm text-left border-collapse">{children}</table></div>,
          th: ({ children }) => <th className="border border-white/10 px-3 py-2 bg-white/[0.02] font-semibold text-white/80">{children}</th>,
          td: ({ children }) => <td className="border border-white/10 px-3 py-2 text-white/70">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function AIExplanationPanel({ messages, isLoading, streamingMessageId, onSourceClick }: AIExplanationPanelProps) {
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
                    <MessageContentFormatter 
                      content={message.id === streamingMessageId ? message.content + " ▍" : message.content} 
                    />
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <div className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2 px-1">Sources</div>
                        <div className="flex flex-col gap-1.5">
                          {message.sources.map((source, index) => (
                            <button
                              key={index}
                              onClick={() => onSourceClick?.(source.file)}
                              className="group flex items-center justify-between px-3 py-2 rounded-md bg-white/[0.02] border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all w-full text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileCode className="h-3.5 w-3.5 text-white/40 group-hover:text-blue-400 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs text-white/80 font-mono truncate group-hover:text-blue-300">
                                    {source.file.split('/').pop()}
                                  </span>
                                  <span className="text-[10px] text-white/40 truncate">
                                    Line {source.line} {source.symbol && `• ${source.symbol}`}
                                  </span>
                                </div>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
