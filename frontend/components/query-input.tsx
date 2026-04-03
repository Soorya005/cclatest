"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Paperclip, Command } from "lucide-react"

interface QueryInputProps {
  onSubmit: (query: string) => void
  isLoading: boolean
  disabled: boolean
}

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [query, setQuery] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && !isLoading && !disabled) {
      onSubmit(query.trim())
      setQuery("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [query])

  return (
    <div className="border-t border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Load a repository first to start chatting..." : "Ask a question about the code..."}
            className="min-h-[80px] max-h-[150px] resize-none pr-24 bg-input border-border text-foreground placeholder:text-muted-foreground"
            disabled={isLoading || disabled}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach file</span>
            </Button>
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8"
              disabled={!query.trim() || isLoading || disabled}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>+ Enter to send</span>
          </div>
          <span>{query.length} / 4000</span>
        </div>
      </form>
    </div>
  )
}
