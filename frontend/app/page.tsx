"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Header } from "@/components/header"
import { ChatSidebar, type ChatSession } from "@/components/chat-sidebar"
import { GitHubInput } from "@/components/github-input"
import { AIExplanationPanel, type Message } from "@/components/ai-explanation-panel"
import { FilePreview } from "@/components/file-preview"
import { RepositoryTree } from "@/components/repository-tree"
import { QueryInput } from "@/components/query-input"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import {
  apiAddRepository,
  apiGetRepositoryFileContent,
  apiGetRepositoryTree,
  apiIndexRepository,
  apiGetRepositoryStatus,
  apiQueryRepository,
  type QuerySource,
  type RepositoryTreeNode,
} from "@/lib/api"

type StoredChatSession = ChatSession & {
  history?: Message[]
  repoUrl?: string | null
  repoId?: number | null
  repoStatus?: "idle" | "loading" | "success" | "error"
}

export default function Home() {
  const { user, token, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessions, setSessions] = useState<StoredChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [repoStatus, setRepoStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [currentRepo, setCurrentRepo] = useState<string | null>(null)
  const [currentRepoId, setCurrentRepoId] = useState<number | null>(null)
  const [fileTree, setFileTree] = useState<RepositoryTreeNode[]>([])
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedFileContent, setSelectedFileContent] = useState("")
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false)
  const [isFileContentTruncated, setIsFileContentTruncated] = useState(false)
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
        parsed.map((s: StoredChatSession) => ({
          ...s,
          timestamp: new Date(s.timestamp),
          history: (s.history ?? []).map((m: Message) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }))
      )
    }
  }, [])

  const loadRepositoryTree = async (repoId: number): Promise<RepositoryTreeNode[]> => {
    if (!token) return []

    setIsLoadingTree(true)
    try {
      const result = await apiGetRepositoryTree(token, repoId)
      setFileTree(result.tree)

      return result.tree
    } catch (err) {
      console.error("Failed to load repository tree:", err)
      setFileTree([])
      return []
    } finally {
      setIsLoadingTree(false)
    }
  }

  // Persist sessions
  useEffect(() => {
    if (sessions.length > 0) {
      const persistedSessions = sessions.map(({ history, ...session }) => ({
        ...session,
        history,
      }))
      localStorage.setItem("rag_chat_sessions", JSON.stringify(persistedSessions))
      return
    }
    localStorage.removeItem("rag_chat_sessions")
  }, [sessions])

  const handleSelectFile = async (filePath: string) => {
    if (!token || currentRepoId === null) return

    setSelectedFilePath(filePath)
    setIsLoadingFileContent(true)
    setIsFileContentTruncated(false)
    try {
      const result = await apiGetRepositoryFileContent(token, currentRepoId, filePath)
      setSelectedFileContent(result.content)
      setIsFileContentTruncated(result.truncated)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load file"
      setSelectedFileContent(`Unable to preview file: ${message}`)
      setIsFileContentTruncated(false)
    } finally {
      setIsLoadingFileContent(false)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const handleNewSession = () => {
    const newSession: StoredChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      timestamp: new Date(),
      messages: 0,
      history: [],
      repoUrl: null,
      repoId: null,
      repoStatus: "idle",
    }
    setSessions((prev: StoredChatSession[]) => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setMessages([])
    setCurrentRepo(null)
    setCurrentRepoId(null)
    setFileTree([])
    setSelectedFilePath(null)
    setSelectedFileContent("")
    setIsFileContentTruncated(false)
    setRepoStatus("idle")
  }

  const handleSelectSession = (id: string) => {
    const selectedSession = sessions.find((s: StoredChatSession) => s.id === id) as StoredChatSession | undefined
    setActiveSessionId(id)
    setMessages(selectedSession?.history ?? [])
    setCurrentRepo(selectedSession?.repoUrl ?? null)
    setCurrentRepoId(selectedSession?.repoId ?? null)
    setRepoStatus(selectedSession?.repoStatus ?? "idle")
    setFileTree([])
    setSelectedFilePath(null)
    setSelectedFileContent("")
    setIsFileContentTruncated(false)

    if (
      selectedSession?.repoStatus === "success" &&
      selectedSession.repoId !== null &&
      selectedSession.repoId !== undefined
    ) {
      void loadRepositoryTree(selectedSession.repoId)
    }
  }

  const handleDeleteSession = (id: string) => {
    setSessions((prev: StoredChatSession[]) => prev.filter((s: StoredChatSession) => s.id !== id))
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setMessages([])
      setCurrentRepo(null)
      setCurrentRepoId(null)
      setFileTree([])
      setSelectedFilePath(null)
      setSelectedFileContent("")
      setIsFileContentTruncated(false)
      setRepoStatus("idle")
    }
  }

  // ── Real repository loading ─────────────────────────────────────────────────
  const handleLoadRepo = async (url: string) => {
    if (!token) return
    setIsLoadingRepo(true)
    setIsLoadingTree(true)
    setRepoStatus("loading")
    setFileTree([])
    setSelectedFilePath(null)
    setSelectedFileContent("")
    setIsFileContentTruncated(false)

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

            const starterMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `✅ Repository indexed successfully! I've processed the codebase and I'm ready to answer your questions. What would you like to know?`,
              timestamp: new Date(),
            }

            // Create a session if none exists
            let targetSessionId = activeSessionId
            if (!targetSessionId) {
              const repoName = url.match(/github\.com\/([^/]+\/[^/]+)/)?.[1] || "Repository"
              const newSession: StoredChatSession = {
                id: crypto.randomUUID(),
                title: repoName,
                timestamp: new Date(),
                messages: 0,
                history: [],
                repoUrl: url,
                repoId,
                repoStatus: "success",
              }
              targetSessionId = newSession.id
              setSessions((prev: StoredChatSession[]) => [newSession, ...prev])
              setActiveSessionId(newSession.id)
            }

            await loadRepositoryTree(repoId)

            setMessages([starterMessage])
            setSessions((prev: StoredChatSession[]) =>
              prev.map((s: StoredChatSession) =>
                s.id === targetSessionId
                  ? {
                    ...s,
                    repoUrl: url,
                    repoId,
                    repoStatus: "success",
                    history: [starterMessage],
                    messages: 1,
                    timestamp: new Date(),
                  }
                  : s
              )
            )
          } else if (statusResult.status === "FAILED") {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            setRepoStatus("error")
            setIsLoadingRepo(false)
            setIsLoadingTree(false)
          }
          // else "INDEXING" → keep polling
        } catch {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setRepoStatus("error")
          setIsLoadingRepo(false)
          setIsLoadingTree(false)
        }
      }, 3000)
    } catch (err: unknown) {
      console.error("Failed to load repository:", err)
      setRepoStatus("error")
      setIsLoadingRepo(false)
      setIsLoadingTree(false)
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

    setSessions((prev: StoredChatSession[]) =>
      prev.map((s: StoredChatSession) =>
        s.id === activeSessionId
          ? {
            ...s,
            messages: s.messages + 1,
            title: s.messages === 0 ? query.slice(0, 40) + "..." : s.title,
            history: [...(s.history ?? []), userMessage],
            repoUrl: currentRepo,
            repoId: currentRepoId,
            repoStatus,
            timestamp: new Date(),
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
      setSessions((prev: StoredChatSession[]) =>
        prev.map((s: StoredChatSession) =>
          s.id === activeSessionId
            ? {
              ...s,
              messages: s.messages + 1,
              history: [...(s.history ?? []), assistantMessage],
              timestamp: new Date(),
            }
            : s
        )
      )
    } catch (err: unknown) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${err instanceof Error ? err.message : "Failed to get response from backend."}`,
        timestamp: new Date(),
      }
      setMessages((prev: Message[]) => [...prev, errorMessage])
      setSessions((prev: StoredChatSession[]) =>
        prev.map((s: StoredChatSession) =>
          s.id === activeSessionId
            ? {
              ...s,
              messages: s.messages + 1,
              history: [...(s.history ?? []), errorMessage],
              timestamp: new Date(),
            }
            : s
        )
      )
    } finally {
      setIsLoadingMessage(false)
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
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {/* File Explorer Pane */}
          <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-muted/10">
            <div className="p-3 border-b border-border">
              <GitHubInput
                onSubmit={handleLoadRepo}
                isLoading={isLoadingRepo}
                status={repoStatus}
                currentRepo={currentRepo}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <RepositoryTree
                tree={fileTree}
                isLoading={isLoadingTree}
                selectedFilePath={selectedFilePath}
                onSelectFile={handleSelectFile}
              />
            </div>
          </div>

          {/* Code View Pane */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-background">
            <FilePreview
              filePath={selectedFilePath}
              content={selectedFileContent}
              isLoading={isLoadingFileContent}
              truncated={isFileContentTruncated}
            />
          </div>

          {/* Chat Pane */}
          <div className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-muted/5">
            <div className="flex-1 min-h-0 overflow-hidden">
              <AIExplanationPanel messages={messages} isLoading={isLoadingMessage} />
            </div>
            <QueryInput
              onSubmit={handleSendQuery}
              isLoading={isLoadingMessage}
              disabled={repoStatus !== "success"}
            />
          </div>
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
