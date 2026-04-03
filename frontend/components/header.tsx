"use client"

import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Code2, User, LogOut, Settings, ChevronDown } from "lucide-react"

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/10 border border-primary/20">
            <Code2 className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">Code Chat</span>
        </div>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
          Beta
        </span>
      </div>

      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Documentation
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            API
          </Button>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm text-foreground">{user?.username}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
