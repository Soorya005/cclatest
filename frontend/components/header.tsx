"use client"

import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { Code2, User, LogOut, Settings, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-12 border-b border-white/[0.06] bg-black/95 backdrop-blur-xl flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/landing" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/20">
          <Code2 className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-semibold text-white text-sm tracking-tight">CodeChat</span>
        <span className="text-[10px] font-medium text-blue-400/80 px-1.5 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10">
          Beta
        </span>
      </Link>

      {/* Right */}
      <div className="flex items-center gap-3">
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-white/5 text-xs h-8"
          >
            Docs
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-white/5 text-xs h-8"
          >
            API
          </Button>
        </nav>

        <div className="w-px h-4 bg-white/10" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-8 px-2.5 text-white/70 hover:text-white hover:bg-white/5"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center">
                <User className="h-3 w-3 text-blue-300" />
              </div>
              <span className="text-xs font-medium">{user?.username}</span>
              <ChevronDown className="h-3 w-3 text-white/30" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-[#0d0d1a] border border-white/10 text-white/80 shadow-xl shadow-black/40"
          >
            <DropdownMenuItem className="gap-2 text-sm text-white/60 hover:text-white hover:bg-white/5 focus:bg-white/5 focus:text-white cursor-default">
              <User className="h-4 w-4" />
              {user?.username}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-sm text-white/60 hover:text-white hover:bg-white/5 focus:bg-white/5 focus:text-white cursor-pointer">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/8" />
            <DropdownMenuItem
              className="gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
