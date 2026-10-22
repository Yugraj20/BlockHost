import React, { useState } from 'react'
import {
  LayoutDashboard,
  Server,
  PlusCircle,
  Globe,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Github,
  ExternalLink,
  Coffee
} from 'lucide-react'
import { useAppStore, NavTab } from '../stores/useAppStore'

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'create', label: 'Create Server', icon: PlusCircle },
  { id: 'network', label: 'Network (playit.gg)', icon: Globe },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'docs', label: 'Documentation', icon: BookOpen }
]

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      aria-label="Primary Navigation"
      className={`${
        collapsed ? 'w-20' : 'w-60'
      } h-full bg-bh-panel/90 backdrop-blur-xl border-r border-bh-border flex flex-col justify-between transition-all duration-200 select-none shrink-0 z-30`}
    >
      {/* Brand Header */}
      <div>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="./logo.png"
              alt="ChunkHarbor Cube Logo"
              className="w-10 h-10 rounded-xl shadow-lg shrink-0"
            />
            {!collapsed && (
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-bh-text leading-none">
                  ChunkHarbor
                </h1>
                <p className="text-[10px] font-semibold tracking-widest text-bh-accent uppercase mt-1">
                  SERVER ENGINE
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1 rounded-lg text-bh-muted hover:text-bh-text hover:bg-white/5"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 mt-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'btn-accent font-bold'
                    : 'text-bh-muted hover:text-bh-text hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-bh-muted'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom Artwork Card ("Your World, Your Rules") */}
      {!collapsed ? (
        <div className="p-3">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl h-52 group">
            <img
              src="./Code_Generated_Image.gif"
              alt="Minecraft World"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

            {/* Interactive Content Overlay */}
            <div className="relative h-full flex flex-col justify-between p-3.5 z-10">
              {/* Support & GitHub Buttons positioned over the artwork */}
              <div className="flex flex-col gap-1.5 items-start">
                <button
                  type="button"
                  onClick={() => window.api.openExternal('https://www.buymeacoffee.com/yugraj20')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFDD00] hover:bg-[#FFEA47] text-black border border-amber-300/40 backdrop-blur-md text-[11px] font-bold transition-all hover:scale-105 shadow-md active:scale-95 group/bmac"
                  title="Buy Me a Coffee (buymeacoffee.com/yugraj20)"
                >
                  <Coffee className="w-3.5 h-3.5 text-black" />
                  <span>Buy Me a Coffee</span>
                  <ExternalLink className="w-2.5 h-2.5 text-black/60 group-hover/bmac:text-black" />
                </button>

                <button
                  type="button"
                  onClick={() => window.api.openExternal('https://github.com/Yugraj20')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/90 text-white/90 hover:text-white border border-white/20 hover:border-white/40 backdrop-blur-md text-[11px] font-semibold transition-all hover:scale-105 shadow-md active:scale-95 group/gh"
                  title="Visit https://github.com/Yugraj20"
                >
                  <Github className="w-3.5 h-3.5 text-white" />
                  <span>GitHub</span>
                  <ExternalLink className="w-2.5 h-2.5 text-white/60 group-hover/gh:text-white" />
                </button>
              </div>

              <div>
                <p className="text-base font-extrabold text-white leading-tight">
                  Your World
                  <br />
                  Your Rules
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-300">Host. Play. Customize.</p>
                  <button
                    type="button"
                    onClick={() => window.api.openExternal('https://github.com/Yugraj20')}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 font-mono transition-colors"
                  >
                    @Yugraj20
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => window.api.openExternal('https://www.buymeacoffee.com/yugraj20')}
            className="w-10 h-10 rounded-xl bg-[#FFDD00] hover:bg-[#FFEA47] border border-amber-300/40 flex items-center justify-center text-black transition-all shadow-md group/bmac"
            title="Buy Me a Coffee (buymeacoffee.com/yugraj20)"
          >
            <Coffee className="w-5 h-5 text-black group-hover/bmac:scale-110 transition-transform" />
          </button>
          <button
            type="button"
            onClick={() => window.api.openExternal('https://github.com/Yugraj20')}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-bh-muted hover:text-white transition-all shadow-md group/gh"
            title="Visit https://github.com/Yugraj20 on GitHub"
          >
            <Github className="w-5 h-5 group-hover/gh:scale-110 transition-transform" />
          </button>
        </div>
      )}
    </aside>
  )
}
