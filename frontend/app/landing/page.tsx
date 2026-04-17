"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Github, Zap, Shield, Code2, Brain, GitBranch, Search, ChevronRight, Star, Check, Terminal, Layers, Bot } from "lucide-react"

const TYPED_STRINGS = [
  "Understand any codebase instantly.",
  "Ask questions, get code answers.",
  "Index repos. Chat with your code.",
  "Ship smarter with AI context.",
]

function useTypingEffect(strings: string[], speed = 60, pause = 2000) {
  const [displayed, setDisplayed] = useState("")
  const [stringIndex, setStringIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = strings[stringIndex]
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting && charIndex <= current.length) {
      timeout = setTimeout(() => {
        setDisplayed(current.slice(0, charIndex))
        setCharIndex((c) => c + 1)
      }, speed)
    } else if (!deleting && charIndex > current.length) {
      timeout = setTimeout(() => setDeleting(true), pause)
    } else if (deleting && charIndex > 0) {
      timeout = setTimeout(() => {
        setDisplayed(current.slice(0, charIndex - 1))
        setCharIndex((c) => c - 1)
      }, speed / 2)
    } else {
      setDeleting(false)
      setStringIndex((i) => (i + 1) % strings.length)
    }

    return () => clearTimeout(timeout)
  }, [charIndex, deleting, stringIndex, strings, speed, pause])

  return displayed
}

const FEATURES = [
  {
    icon: <Brain className="h-5 w-5" />,
    title: "RAG-Powered Intelligence",
    desc: "Retrieval-Augmented Generation pulls the exact code context before answering, eliminating hallucinations.",
  },
  {
    icon: <GitBranch className="h-5 w-5" />,
    title: "GitHub Integration",
    desc: "Paste any public or private GitHub URL. CodeChat indexes the full codebase in seconds.",
  },
  {
    icon: <Search className="h-5 w-5" />,
    title: "Semantic Code Search",
    desc: "Find functions, classes and patterns with natural language instead of regex.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Auto Re-Indexing",
    desc: "CI/CD webhook triggers re-indexing on every push to main. Always in sync.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Secure & Private",
    desc: "Your tokens and code stay local. No data sent to third-party LLM providers.",
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "File Tree Explorer",
    desc: "Browse the full repository structure and preview any file directly in the chat interface.",
  },
]

const STEPS = [
  { n: "01", title: "Add your repository", desc: "Paste a GitHub URL and hit index. Works with public and private repos." },
  { n: "02", title: "Let AI index it", desc: "CodeChat processes every file, creates embeddings, and builds a semantic search index." },
  { n: "03", title: "Chat with your code", desc: "Ask anything — architecture questions, bug hunting, onboarding walkthroughs." },
]

const TESTIMONIALS = [
  { name: "Aryan K.", role: "Backend Engineer", stars: 5, text: "CodeChat cut my onboarding time in half. I understood a 40k-line codebase in under an hour." },
  { name: "Priya M.", role: "ML Engineer", stars: 5, text: "The RAG pipeline is incredible. Every answer comes with exact file and line references." },
  { name: "James T.", role: "Open Source Maintainer", stars: 5, text: "My contributors now answer their own questions. Support requests dropped by 70%." },
]

export default function LandingPage() {
  const typed = useTypingEffect(TYPED_STRINGS)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ── Ambient background glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/8 rounded-full blur-[130px]" />
      </div>

      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-black/90 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Code2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight">CodeChat</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {["Features", "How it works", "Testimonials"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-white/90 transition-all duration-200 hover:shadow-lg hover:shadow-white/10"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative pt-40 pb-32 px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs text-white/70 mb-10 hover:border-white/20 transition-colors cursor-default">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Powered by local Ollama LLaMA 3.2 · No data leaves your machine
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[1] mb-6 max-w-5xl mx-auto">
          <span className="text-white">Chat with your</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            codebase.
          </span>
        </h1>

        {/* Typewriter */}
        <p className="text-xl md:text-2xl text-white/40 mb-4 h-8 font-light">
          {typed}
          <span className="inline-block w-0.5 h-5 bg-blue-400 ml-0.5 animate-pulse" />
        </p>

        <p className="text-base text-white/50 max-w-xl mx-auto mb-12 leading-relaxed">
          The AI-powered code assistant that indexes any GitHub repository and lets you
          explore, understand and debug it through natural language conversation.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            id="hero-cta-register"
            className="group flex items-center gap-2 px-7 py-3.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 transition-all duration-200 shadow-xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5"
          >
            Start for free
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="https://github.com/Soorya005/cclatest"
            target="_blank"
            rel="noopener noreferrer"
            id="hero-cta-github"
            className="group flex items-center gap-2 px-7 py-3.5 border border-white/15 rounded-full text-sm text-white/80 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all duration-200"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-2 mt-12 text-sm text-white/40">
          <div className="flex -space-x-2">
            {["AB", "PS", "KR", "MJ", "TW"].map((initials, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-[9px] font-bold text-white"
                style={{
                  background: `hsl(${200 + i * 30}, 80%, 50%)`,
                }}
              >
                {initials}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-yellow-400 text-xs">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400" />)}
          </div>
          <span>Trusted by <strong className="text-white/70">500+</strong> developers</span>
        </div>
      </section>

      {/* ── Terminal preview ── */}
      <section className="px-6 pb-28 max-w-5xl mx-auto">
        <div className="relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50">
          {/* Terminal bar */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8 bg-white/3">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <div className="ml-4 text-xs text-white/30 font-mono">codechat — chat session</div>
          </div>
          {/* Terminal body */}
          <div className="p-6 font-mono text-sm space-y-4">
            <div className="flex gap-3">
              <span className="text-white/30 select-none">›</span>
              <span className="text-white/50">Repository indexed: <span className="text-blue-400">github.com/vercel/next.js</span></span>
            </div>
            <div className="flex gap-3">
              <Bot className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span className="text-white/40">Ready. Ask me anything about this codebase.</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-400 select-none">You</span>
              <span className="text-white/80">How does the App Router handle nested layouts?</span>
            </div>
            <div className="flex gap-3 items-start">
              <Bot className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1.5">
                <p className="text-white/70">Nested layouts in App Router work by placing <span className="text-cyan-400">layout.tsx</span> files at each route segment.</p>
                <p className="text-white/40 text-xs">📚 Sources: <span className="text-blue-400">packages/next/src/server/app-render/app-render.tsx:247</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
              <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-white/30 text-xs">
                Ask a question about the codebase...
              </div>
              <div className="w-7 h-7 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <ArrowRight className="h-3 w-3 text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 pb-28 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs text-blue-400 font-semibold tracking-widest uppercase mb-3">Capabilities</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Everything you need<br />to understand code faster</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="group relative p-6 rounded-2xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="px-6 pb-28 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs text-blue-400 font-semibold tracking-widest uppercase mb-3">Workflow</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">From zero to answers<br />in three steps</h2>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="group flex items-start gap-6 p-8 rounded-2xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.035] hover:border-white/10 transition-all duration-300"
            >
              <span className="text-5xl font-black text-white/6 group-hover:text-white/10 transition-colors leading-none select-none">
                {step.n}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="px-6 pb-28 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs text-emerald-400 font-semibold tracking-widest uppercase mb-3">Testimonials</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Loved by developers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-white/6 bg-white/[0.02]"
            >
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <Star key={s} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-5">"{t.text}"</p>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-white/40">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-6 pb-28 max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border border-white/8 bg-white/[0.02] p-12 md:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent" />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
              Ready to understand<br />your codebase?
            </h2>
            <p className="text-white/50 mb-8 text-base">
              Start for free. No cloud. No subscription. Runs 100% on your machine.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                id="cta-banner-register"
                className="group flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 transition-all duration-200 shadow-xl"
              >
                Get started — it&apos;s free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/login"
                id="cta-banner-login"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Already have an account? Sign in →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/6 px-6 py-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
              <Code2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold">CodeChat</span>
          </div>
          <p className="text-xs text-white/30">
            Built with Next.js · FastAPI · Ollama · FAISS
          </p>
          <div className="flex items-center gap-6">
            {["Features", "GitHub"].map((item) => (
              <a
                key={item}
                href={item === "GitHub" ? "https://github.com/Soorya005/cclatest" : "#features"}
                target={item === "GitHub" ? "_blank" : undefined}
                rel={item === "GitHub" ? "noopener noreferrer" : undefined}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
