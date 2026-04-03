"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Code, FileCode, Sparkles } from "lucide-react"
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

export function AIExplanationPanel({ messages, isLoading }: AIExplanationPanelProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">AI Explanations</h2>
        </div>
        <span className="text-xs text-muted-foreground">{messages.length} messages</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No conversations yet</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Load a GitHub repository and ask questions about the code to get AI-powered explanations.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {message.role === "user" ? (
                    <Code className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 max-w-[85%]",
                    message.role === "user" ? "text-right" : ""
                  )}
                >
                  <div
                    className={cn(
                      "inline-block p-3 rounded-lg",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.codeBlocks?.map((block, index) => (
                      <div
                        key={index}
                        className="mt-3 rounded-md overflow-hidden bg-background/50"
                      >
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
                          <FileCode className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{block.language}</span>
                        </div>
                        <pre className="p-3 text-xs overflow-x-auto font-mono">
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
              <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-secondary">
                <Bot className="h-4 w-4 text-secondary-foreground animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-secondary">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
