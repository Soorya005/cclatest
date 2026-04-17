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
    <div className="p-4 pt-0">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
            <Textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Load a repository first to start chatting..." : "Ask Copilot a question..."}
              className="min-h-[60px] max-h-[200px] resize-none pr-[80px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500/50 pt-3"
              disabled={isLoading || disabled}
            />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/[0.05] rounded-lg"
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach file</span>
              </Button>
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg shadow-none"
                disabled={!query.trim() || isLoading || disabled}
              >
                <Send className="h-4 w-4 -ml-0.5" />
                <span className="sr-only">Send message</span>
              </Button>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 text-[10px] text-white/30 font-medium">
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3 opacity-50" />
            <span>+ Enter to send</span>
          </div>
          <span>{query.length} / 4000</span>
        </div>
      </form>
    </div>
  )
}
