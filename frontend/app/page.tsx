"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Header } from "@/components/header"
import { ChatSidebar, type ChatSession } from "@/components/chat-sidebar"
import { GitHubInput } from "@/components/github-input"
import { AIExplanationPanel, type Message } from "@/components/ai-explanation-panel"
import { QueryInput } from "@/components/query-input"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import {
  apiAddRepository,
  apiIndexRepository,
  apiGetRepositoryStatus,
  apiQueryRepository,
  type QuerySource,
} from "@/lib/api"

export default function Home() {
  const { user, token, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [repoStatus, setRepoStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [currentRepo, setCurrentRepo] = useState<string | null>(null)
  const [currentRepoId, setCurrentRepoId] = useState<number | null>(null)
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem("rag_chat_sessions")
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions)
      setSessions(
        parsed.map((s: ChatSession) => ({
          ...s,
          timestamp: new Date(s.timestamp),
        }))
      )
    }
  }, [])

  // Persist sessions
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("rag_chat_sessions", JSON.stringify(sessions))
    }
  }, [sessions])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      timestamp: new Date(),
      messages: 0,
    }
    setSessions((prev: ChatSession[]) => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setMessages([])
    setCurrentRepo(null)
    setCurrentRepoId(null)
    setRepoStatus("idle")
  }

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
    setMessages([])
  }

  const handleDeleteSession = (id: string) => {
    setSessions((prev: ChatSession[]) => prev.filter((s: ChatSession) => s.id !== id))
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setMessages([])
    }
  }

  // ── Real repository loading ─────────────────────────────────────────────────
  const handleLoadRepo = async (url: string) => {
    if (!token) return
    setIsLoadingRepo(true)
    setRepoStatus("loading")

    try {
      // Step 1: Register the repo in the database
      const addResult = await apiAddRepository(token, url)
      const repoId = addResult.repository_id

      // Step 2: Start async indexing
      await apiIndexRepository(token, repoId)

      // Step 3: Poll for completion (INDEXING → INDEXED or FAILED)
      if (pollingRef.current) clearInterval(pollingRef.current)

      pollingRef.current = setInterval(async () => {
        try {
          const statusResult = await apiGetRepositoryStatus(token, repoId)

          if (statusResult.status === "INDEXED") {
            clearInterval(pollingRef.current!)
            pollingRef.current = null

            setCurrentRepo(url)
            setCurrentRepoId(repoId)
            setRepoStatus("success")
            setIsLoadingRepo(false)

            // Create a session if none exists
            if (!activeSessionId) {
              const repoName = url.match(/github\.com\/([^/]+\/[^/]+)/)?.[1] || "Repository"
              const newSession: ChatSession = {
                id: crypto.randomUUID(),
                title: repoName,
                timestamp: new Date(),
                messages: 0,
              }
              setSessions((prev: ChatSession[]) => [newSession, ...prev])
              setActiveSessionId(newSession.id)
            }

            setMessages([
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `✅ Repository indexed successfully! I've processed the codebase and I'm ready to answer your questions. What would you like to know?`,
                timestamp: new Date(),
              },
            ])
          } else if (statusResult.status === "FAILED") {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            setRepoStatus("error")
            setIsLoadingRepo(false)
          }
          // else "INDEXING" → keep polling
        } catch {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setRepoStatus("error")
          setIsLoadingRepo(false)
        }
      }, 3000)
    } catch (err: unknown) {
      console.error("Failed to load repository:", err)
      setRepoStatus("error")
      setIsLoadingRepo(false)
    }
  }

  // ── Real query ──────────────────────────────────────────────────────────────
  const handleSendQuery = async (query: string) => {
    if (!activeSessionId || !token || currentRepoId === null) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date(),
    }
    setMessages((prev: Message[]) => [...prev, userMessage])
    setIsLoadingMessage(true)

    setSessions((prev: ChatSession[]) =>
      prev.map((s: ChatSession) =>
        s.id === activeSessionId
          ? {
            ...s,
            messages: s.messages + 1,
            title: s.messages === 0 ? query.slice(0, 40) + "..." : s.title,
          }
          : s
      )
    )

    try {
      const result = await apiQueryRepository(token, currentRepoId, query)

      // Format sources as a readable codeBlock
      const sourceSummary =
        result.sources && result.sources.length > 0
          ? result.sources
            .map((s: QuerySource) => `${s.file}:${s.line}  [${s.symbol}]`)
            .join("\n")
          : null

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date(),
        codeBlocks: sourceSummary
          ? [{ language: "text", code: `📚 Sources retrieved:\n${sourceSummary}` }]
          : undefined,
      }
      setMessages((prev: Message[]) => [...prev, assistantMessage])
    } catch (err: unknown) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${err instanceof Error ? err.message : "Failed to get response from backend."}`,
        timestamp: new Date(),
      }
      setMessages((prev: Message[]) => [...prev, errorMessage])
    } finally {
      setIsLoadingMessage(false)
      setSessions((prev: ChatSession[]) =>
        prev.map((s: ChatSession) =>
          s.id === activeSessionId ? { ...s, messages: s.messages + 1 } : s
        )
      )
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Toggle (mobile) */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-14 z-10 h-8 w-8 md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Chat History Sidebar */}
        <div
          className={`${sidebarOpen ? "w-64" : "w-0"
            } transition-all duration-300 overflow-hidden flex-shrink-0`}
        >
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* GitHub Input */}
          <GitHubInput
            onSubmit={handleLoadRepo}
            isLoading={isLoadingRepo}
            status={repoStatus}
            currentRepo={currentRepo}
          />

          {/* AI Explanations Panel */}
          <div className="flex-1 overflow-hidden">
            <AIExplanationPanel messages={messages} isLoading={isLoadingMessage} />
          </div>

          {/* Query Input */}
          <QueryInput
            onSubmit={handleSendQuery}
            isLoading={isLoadingMessage}
            disabled={repoStatus !== "success"}
          />
        </div>

        {/* Desktop Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex absolute left-2 top-14 z-10 h-8 w-8"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
