"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Github, Link, Loader2, CheckCircle, XCircle } from "lucide-react"

interface GitHubInputProps {
  onSubmit: (url: string) => void
  isLoading: boolean
  status: "idle" | "loading" | "success" | "error"
  currentRepo: string | null
}

export function GitHubInput({ onSubmit, isLoading, status, currentRepo }: GitHubInputProps) {
  const [url, setUrl] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onSubmit(url.trim())
    }
  }

  const extractRepoName = (repoUrl: string) => {
    try {
      const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/)
      return match ? match[1] : repoUrl
    } catch {
      return repoUrl
    }
  }

  return (
    <div className="p-3 border-b border-border bg-card">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Github className="h-4 w-4" />
          <span className="text-sm font-medium">Repository</span>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="url"
              placeholder="https://github.com/username/repository"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !url.trim()} size="sm">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load Repository"
            )}
          </Button>
        </div>
        {status !== "idle" && (
          <div className="flex items-center gap-2">
            {status === "success" && (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">{extractRepoName(currentRepo || "")}</span>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">Failed to load</span>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
