"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Plus, Trash2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChatSession {
  id: string
  title: string
  timestamp: Date
  messages: number
}

interface ChatSidebarProps {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col space-y-4 w-full">
        <Button
          onClick={onNewSession}
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 px-2 text-xs text-white/50 hover:text-white hover:bg-white/[0.05] rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>


      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No chat history</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Start a new conversation</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  activeSessionId === session.id
                    ? "bg-white/[0.08] text-white"
                    : "hover:bg-white/[0.03] text-white/50"
                )}
                onClick={() => onSelectSession(session.id)}
                onMouseEnter={() => setHoveredId(session.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 flex-shrink-0 transition-transform opacity-50 group-hover:opacity-100",
                    activeSessionId === session.id && "rotate-90"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate font-medium">{session.title}</p>
                  <p className="text-[10px] text-white/30 hidden group-hover:block transition-all">
                    {formatDate(session.timestamp)} · {session.messages} messages
                  </p>
                </div>
                {hoveredId === session.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
