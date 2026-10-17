import React, { useEffect, useRef, useState } from 'react'
import { Send, Trash2, Copy, FolderOpen, Terminal, Zap } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { MINECRAFT_COMMANDS } from '../../../shared/constants'

interface ConsolePanelProps {
  serverId: string
  serverName: string
  compact?: boolean
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  serverId,
  serverName,
  compact = false
}) => {
  const { consoleBuffers, clearConsoleBuffer, settings, setActiveTab, setActiveServerSubTab } =
    useAppStore()
  const lines = consoleBuffers[serverId] || []
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  const suggestions =
    input.trim().length > 0
      ? MINECRAFT_COMMANDS.filter((c) =>
          c.command.toLowerCase().startsWith(input.replace(/^\//, '').toLowerCase())
        ).slice(0, 5)
      : []

  const handleSend = async (cmdText?: string) => {
    const toSend = (cmdText ?? input).trim()
    if (!toSend || !serverId) return
    await window.api.sendCommand(serverId, toSend)
    setHistory((prev) => [toSend, ...prev.slice(0, 49)])
    setHistoryIdx(-1)
    if (!cmdText) setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIdx = Math.min(history.length - 1, historyIdx + 1)
      if (history[nextIdx]) {
        setHistoryIdx(nextIdx)
        setInput(history[nextIdx])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = historyIdx - 1
      if (nextIdx >= 0 && history[nextIdx]) {
        setHistoryIdx(nextIdx)
        setInput(history[nextIdx])
      } else {
        setHistoryIdx(-1)
        setInput('')
      }
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      setInput(suggestions[0].command + ' ')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const renderFormattedLine = (line: string, index: number) => {
    // Parse standard Minecraft log line: [14:32:01] [Server thread/INFO]: Starting minecraft server...
    const match = line.match(/^(\[\d{2}:\d{2}:\d{2}\])\s+(\[[^\]]+\]:?)\s*(.*)$/)
    if (match) {
      const [, time, thread, msg] = match
      const isWarn = thread.includes('WARN')
      const isErr = thread.includes('ERROR') || thread.includes('FATAL')
      const isJoin = /joined the game/i.test(msg)
      return (
        <div key={index} className="leading-relaxed font-mono text-xs whitespace-pre-wrap break-all">
          <span className="text-slate-500">{time} </span>
          <span
            className={
              isErr
                ? 'text-rose-400 font-semibold'
                : isWarn
                  ? 'text-amber-400 font-semibold'
                  : 'text-emerald-400/90'
            }
          >
            {thread}{' '}
          </span>
          <span
            className={
              isErr
                ? 'text-rose-300'
                : isWarn
                  ? 'text-amber-200'
                  : isJoin
                    ? 'text-amber-300 font-medium'
                    : 'text-slate-200'
            }
          >
            {msg}
          </span>
        </div>
      )
    }

    const isCrash = line.includes('CRASH') || line.includes('ERROR')
    const isCmd = line.startsWith('>')
    return (
      <div
        key={index}
        className={`leading-relaxed font-mono text-xs whitespace-pre-wrap break-all ${
          isCrash ? 'text-rose-400 font-semibold' : isCmd ? 'text-cyan-300' : 'text-slate-300'
        }`}
      >
        {line}
      </div>
    )
  }

  return (
    <div className="bg-bh-card/90 border border-bh-border rounded-2xl flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-bh-border flex items-center justify-between bg-bh-panel/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-bh-accent" />
          <span className="text-sm font-bold text-bh-text">{serverName} Console</span>
        </div>

        <div className="flex items-center gap-2">
          {!compact && settings?.commandMacros && (
            <div className="hidden md:flex items-center gap-1.5 mr-2">
              {settings.commandMacros.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSend(m.command)}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-bh-accentSubtle text-bh-muted hover:text-bh-accent text-xs flex items-center gap-1 border border-bh-border transition"
                >
                  <Zap className="w-3 h-3 text-bh-accent" />
                  {m.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              window.api.clearConsole(serverId)
              clearConsoleBuffer(serverId)
            }}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-muted hover:text-bh-text border border-bh-border flex items-center gap-1 transition"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-muted hover:text-bh-text border border-bh-border flex items-center gap-1 transition"
          >
            <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => {
              setActiveTab('servers')
              setActiveServerSubTab('logs')
            }}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-muted hover:text-bh-text border border-bh-border flex items-center gap-1 transition"
          >
            <FolderOpen className="w-3 h-3" /> Open Logs
          </button>
        </div>
      </div>

      {/* Console Log Stream */}
      <div
        ref={scrollRef}
        className={`${
          compact ? 'h-48' : 'h-[380px]'
        } overflow-y-auto p-4 bg-[#05070d] space-y-0.5 select-text border-b border-bh-border`}
      >
        {lines.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono">
            Console output is empty. Start the server to view real-time logs.
          </p>
        ) : (
          lines.map((l, idx) => renderFormattedLine(l, idx))
        )}
      </div>

      {/* Command Input Bar + Autocomplete Popover */}
      <div className="p-2.5 bg-bh-panel border-t border-bh-border relative">
        {suggestions.length > 0 && (
          <div className="absolute bottom-14 left-3 right-3 bg-bh-panel border border-bh-border rounded-xl shadow-2xl p-1.5 z-20">
            {suggestions.map((s) => (
              <button
                key={s.command}
                onClick={() => setInput(s.command + ' ')}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/5 flex items-center justify-between text-xs"
              >
                <span className="font-mono font-semibold text-bh-accent">{s.syntax}</span>
                <span className="text-bh-muted">{s.description}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command... (Tab to autocomplete, Up/Down for history)"
            aria-label="Server Console Command Input"
            className="flex-1 bg-[#090e1a] border border-bh-border rounded-xl px-3.5 py-2 text-xs text-bh-text placeholder:text-bh-muted focus:outline-none focus:border-bh-accent font-mono"
          />
          <button
            onClick={() => handleSend()}
            aria-label="Send Command"
            className="px-3.5 py-2 rounded-xl btn-accent text-xs font-semibold flex items-center gap-1.5 transition shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
