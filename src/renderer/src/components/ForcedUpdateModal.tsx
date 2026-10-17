import React, { useState } from 'react'
import { Download, ExternalLink, Sparkles, LogOut } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'

export const ForcedUpdateModal: React.FC = () => {
  const { updater } = useAppStore()
  const [downloadStarted, setDownloadStarted] = useState(false)

  // Show only if an update is available and marked forced or available with a remote version
  const showModal =
    updater.status === 'available' &&
    (updater.isForced || Boolean(updater.version))

  if (!showModal) return null

  const targetUrl =
    updater.downloadUrl ||
    'https://github.com/Yugraj20/BlockHost/releases/latest'

  const currentVersion = 'v0.2.0-beta'
  const targetVersion = updater.version?.startsWith('v')
    ? updater.version
    : `v${updater.version || 'Latest'}`

  const handleDownload = () => {
    window.api.openExternal(targetUrl)
    setDownloadStarted(true)
  }

  const handleQuit = () => {
    window.api.quitApp()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 select-none animate-fadeIn"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-lg bg-[#0b101b] border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/10 overflow-hidden text-center space-y-6">
        {/* Glow ambient background accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Icon Badge */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-cyan-400 text-black flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 animate-bounce">
            <Sparkles className="w-8 h-8 fill-black text-black" />
          </div>
          <div className="mt-3">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Mandatory Update Required
            </span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            New Version Available!
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            A critical update for BlockHost is available. To keep your Minecraft servers, automated Java runtimes, and playit.gg tunnels running reliably, you must update before continuing.
          </p>
        </div>

        {/* Version Difference Pills */}
        <div className="flex items-center justify-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400">
            <span className="text-[10px] uppercase block text-slate-500">Current</span>
            <span className="font-bold text-slate-300">{currentVersion}</span>
          </div>
          <div className="text-emerald-400 font-extrabold text-base">→</div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <span className="text-[10px] uppercase block text-emerald-400/80">New Version</span>
            <span className="font-extrabold text-emerald-300">{targetVersion}</span>
          </div>
        </div>

        {/* Release Notes Preview (if available) */}
        {updater.releaseNotes && (
          <div className="text-left bg-black/50 border border-white/10 rounded-2xl p-3.5 max-h-32 overflow-y-auto space-y-1 font-mono text-xs text-slate-300">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Release Notes
            </div>
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-slate-300">
              {updater.releaseNotes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleDownload}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-95 group"
          >
            <Download className="w-5 h-5 stroke-[2.5] group-hover:translate-y-0.5 transition-transform" />
            <span>Download Now (Installer .exe)</span>
            <ExternalLink className="w-4 h-4 opacity-75" />
          </button>

          {downloadStarted && (
            <p className="text-xs text-emerald-400 font-semibold animate-pulse">
              ✓ Download initiated in your browser! Run the downloaded installer to complete the update.
            </p>
          )}

          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleQuit}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors font-medium"
              title="Close BlockHost"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Quit BlockHost</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
