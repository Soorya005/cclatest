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
import { PanelLeftClose, PanelLeft, Webhook, Copy, Check, X } from "lucide-react"
import {
  apiAddRepository,
  apiGetRepositoryFileContent,
  apiGetRepositoryTree,
  apiIndexRepository,
  apiGetRepositoryStatus,
  apiQueryRepository,
  apiStreamQuery,
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
  const [syncApiKey, setSyncApiKey] = useState<string | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
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
      setSyncApiKey(addResult.sync_api_key ?? null)

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
    
    const assistantMessageId = crypto.randomUUID()
    const placeholderMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    setMessages((prev: Message[]) => [...prev, userMessage, placeholderMessage])
    setIsLoadingMessage(true)
    setStreamingMessageId(assistantMessageId)

    setSessions((prev: StoredChatSession[]) =>
      prev.map((s: StoredChatSession) =>
        s.id === activeSessionId
          ? {
            ...s,
            messages: s.messages + 1,
            title: s.messages === 0 ? query.slice(0, 40) + "..." : s.title,
            history: [...(s.history ?? []), userMessage, placeholderMessage],
            repoUrl: currentRepo,
            repoId: currentRepoId,
            repoStatus,
            timestamp: new Date(),
          }
          : s
      )
    )

    try {
      const result = await apiStreamQuery(token, currentRepoId, query, (delta) => {
        setIsLoadingMessage(false)
        setMessages((prev) => 
          prev.map((m) => m.id === assistantMessageId ? { ...m, content: m.content + delta } : m)
        )
        setSessions((prev) => 
          prev.map((s) => s.id === activeSessionId ? {
            ...s,
            history: s.history?.map((m) => m.id === assistantMessageId ? { ...m, content: m.content + delta } : m)
          } : s)
        )
      })

      setMessages((prev: Message[]) => 
        prev.map((m) => m.id === assistantMessageId ? {
          ...m,
          content: result.answer,
          sources: result.sources.length > 0 ? result.sources : undefined
        } : m)
      )
      
      setSessions((prev: StoredChatSession[]) =>
        prev.map((s: StoredChatSession) =>
          s.id === activeSessionId
            ? {
              ...s,
              history: s.history?.map((m) => m.id === assistantMessageId ? {
                ...m,
                content: result.answer,
                sources: result.sources.length > 0 ? result.sources : undefined
              } : m),
              timestamp: new Date(),
            }
            : s
        )
      )
    } catch (err: unknown) {
      const errorContent = `❌ Error: ${err instanceof Error ? err.message : "Failed to get response from backend."}`
      
      setMessages((prev: Message[]) => 
        prev.map((m) => m.id === assistantMessageId ? { ...m, content: errorContent } : m)
      )
      
      setSessions((prev: StoredChatSession[]) =>
        prev.map((s: StoredChatSession) =>
          s.id === activeSessionId
            ? {
              ...s,
              history: s.history?.map((m) => m.id === assistantMessageId ? { ...m, content: errorContent } : m),
              timestamp: new Date(),
            }
            : s
        )
      )
    } finally {
      setIsLoadingMessage(false)
      setStreamingMessageId(null)
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
    <div className="min-h-screen bg-background grid grid-rows-[48px_1fr]">
      <Header />

      <div className="flex min-h-0 overflow-hidden relative">
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
              {repoStatus === "success" && currentRepoId !== null && syncApiKey && (
                <button
                  onClick={() => setShowSyncModal(true)}
                  className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-600/30 transition-colors"
                >
                  <Webhook className="h-3.5 w-3.5" />
                  CI/CD Webhook Setup
                </button>
              )}
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
              <AIExplanationPanel 
                messages={messages} 
                isLoading={isLoadingMessage} 
                streamingMessageId={streamingMessageId ?? undefined}
                onSourceClick={handleSelectFile}
              />
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
          className="hidden md:flex absolute left-2 bottom-4 z-10 h-8 w-8 bg-black/40 hover:bg-white/10 backdrop-blur-md rounded-full border border-white/10 shadow-lg"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* CI/CD Webhook Setup Modal */}
      {showSyncModal && currentRepoId !== null && syncApiKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => setShowSyncModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-600/20 rounded-lg">
                <Webhook className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">CI/CD Auto-Sync Setup</h2>
                <p className="text-zinc-400 text-xs">Add these 3 secrets to your GitHub repository</p>
              </div>
            </div>

            <p className="text-zinc-400 text-xs mb-4">
              Go to your target repository on GitHub → <span className="text-zinc-200">Settings → Secrets and variables → Actions</span> → New repository secret
            </p>

            {[
              { name: "CODECHAT_BACKEND_URL", value: "Your ngrok HTTPS URL (e.g. https://xxxx.ngrok-free.app)", copyable: false },
              { name: "CODECHAT_REPO_ID", value: String(currentRepoId), copyable: true },
              { name: "CODECHAT_API_KEY", value: syncApiKey, copyable: true },
            ].map(({ name, value, copyable }) => (
              <div key={name} className="mb-3">
                <p className="text-xs text-zinc-400 mb-1 font-mono">{name}</p>
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2">
                  <span className="flex-1 text-xs font-mono text-zinc-200 truncate">{value}</span>
                  {copyable && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(value)
                        setCopiedField(name)
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="text-zinc-400 hover:text-violet-400 transition-colors flex-shrink-0"
                    >
                      {copiedField === name ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <p className="text-amber-400 text-xs">
                ⚠️ <strong>Important:</strong> The ngrok URL changes every time you restart ngrok (unless on a paid plan). Update <code className="bg-zinc-800 px-1 rounded">CODECHAT_BACKEND_URL</code> in GitHub Secrets after every ngrok restart.
              </p>
            </div>

            <button
              onClick={() => setShowSyncModal(false)}
              className="mt-4 w-full py-2 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
