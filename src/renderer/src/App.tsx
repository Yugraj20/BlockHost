import React, { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { useAppStore } from './stores/useAppStore'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { ForcedUpdateModal } from './components/ForcedUpdateModal'
import { DashboardPage } from './pages/DashboardPage'
import { ServersPage } from './pages/ServersPage'
import { CreateServerPage } from './pages/CreateServerPage'
import { ModrinthPage } from './pages/ModrinthPage'
import { FilesPage } from './pages/FilesPage'
import { BackupsPage } from './pages/BackupsPage'
import { PlayersPage } from './pages/PlayersPage'
import { NetworkPage } from './pages/NetworkPage'
import { SettingsPage } from './pages/SettingsPage'
import { DocsPage } from './pages/DocsPage'

export const App: React.FC = () => {
  const {
    initialized,
    locked,
    setLocked,
    activeTab,
    settings,
    loadBootstrap,
    appendConsoleLine,
    clearConsoleBuffer,
    refreshSystemMetrics,
    refreshActivities
  } = useAppStore()

  const [pinAttempt, setPinAttempt] = useState('')
  const [pinError, setPinError] = useState(false)

  useEffect(() => {
    if (!window.api || typeof window.api.onEvent !== 'function') {
      console.warn('ChunkHarbor window.api is not yet available.')
      return
    }

    loadBootstrap()

    const unsubState = window.api.onEvent('servers:stateUpdated', (states) => {
      useAppStore.setState({ runtimeStates: states })
      refreshActivities()
    })
    const unsubConsole = window.api.onEvent('servers:consoleLine', ({ serverId, line }) => {
      appendConsoleLine(serverId, line)
    })
    const unsubClear = window.api.onEvent('servers:consoleClear', (serverId) => {
      clearConsoleBuffer(serverId)
    })
    const unsubDl = window.api.onEvent('downloads:updated', (tasks) => {
      useAppStore.setState({ downloads: tasks })
    })
    const unsubNotif = window.api.onEvent('notifications:updated', (items) => {
      useAppStore.setState({ notifications: items })
    })
    const unsubPlayit = window.api.onEvent('playit:updated', (playit) => {
      useAppStore.setState({ playit })
    })
    const unsubUpdater = window.api.onEvent('updater:updated', (updater) => {
      useAppStore.setState({ updater })
    })

    const sysInterval = setInterval(() => {
      refreshSystemMetrics()
    }, 4000)

    return () => {
      unsubState?.()
      unsubConsole?.()
      unsubClear?.()
      unsubDl?.()
      unsubNotif?.()
      unsubPlayit?.()
      unsubUpdater?.()
      clearInterval(sysInterval)
    }
  }, [])

  // Apply theme, accent, font scale, high contrast, and reduced motion classes
  const resolvedTheme =
    settings?.theme === 'light'
      ? 'theme-light'
      : settings?.theme === 'system' &&
          window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'theme-light'
        : 'theme-dark'

  const rootClasses = [
    resolvedTheme,
    `accent-${settings?.accentColor || 'indigo'}`,
    `font-scale-${settings?.fontScale || 'md'}`,
    settings?.highContrast ? 'high-contrast' : '',
    settings?.reducedMotion ? 'reduced-motion' : ''
  ]
    .filter(Boolean)
    .join(' ')

  if (!initialized) {
    return (
      <div className="h-screen w-screen bg-[#070a12] flex flex-col items-center justify-center gap-3 text-white relative overflow-hidden select-none">
        <img
          src="./Code_Generated_Image.gif"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-sm scale-105 pointer-events-none"
        />
        <div className="relative z-10 flex flex-col items-center justify-center gap-3">
          <img src="./logo.png" alt="ChunkHarbor" className="w-16 h-16 rounded-2xl animate-pulse shadow-2xl" />
          <p className="text-sm font-bold tracking-wide">Loading ChunkHarbor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${rootClasses} h-screen w-screen flex flex-col bg-bh-bg text-bh-text overflow-hidden relative`}>
      {/* 4K Animated Ambient Wallpaper Layer (Code_Generated_Image.gif) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
        <img
          src="./Code_Generated_Image.gif"
          alt=""
          className="w-full h-full object-cover object-center scale-105 opacity-35 filter brightness-90 contrast-110"
        />
        {/* Dark Obsidian Glass Gradient Overlay for contrast and readability */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#070a12]/95 via-[#070a12]/80 to-[#070a12]/60 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full w-full">
        {/* Forced Mandatory Update Modal */}
        <ForcedUpdateModal />

        <TitleBar />

        {/* PIN Lock Modal */}
        {locked && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-bh-panel border border-bh-border rounded-2xl p-6 w-80 space-y-4 text-center shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-bh-text">ChunkHarbor PIN Lock</h3>
              <p className="text-xs text-bh-muted">Enter your security PIN to unlock controls.</p>
              <input
                type="password"
                value={pinAttempt}
                onChange={(e) => {
                  setPinAttempt(e.target.value)
                  setPinError(false)
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const ok = await window.api.verifySecurityPin(pinAttempt)
                    if (ok) {
                      setLocked(false)
                      setPinAttempt('')
                    } else {
                      setPinError(true)
                    }
                  }
                }}
                placeholder="PIN..."
                className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-2 text-center text-sm tracking-widest text-bh-text"
              />
              {pinError && <p className="text-xs text-rose-400">Incorrect PIN</p>}
              <button
                onClick={async () => {
                  const ok = await window.api.verifySecurityPin(pinAttempt)
                  if (ok) {
                    setLocked(false)
                    setPinAttempt('')
                  } else {
                    setPinError(true)
                  }
                }}
                className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold"
              >
                Unlock
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-transparent">
            {activeTab === 'home' && <DashboardPage />}
            {activeTab === 'servers' && <ServersPage />}
            {activeTab === 'create' && <CreateServerPage />}
            {activeTab === 'modpacks' && <ModrinthPage defaultMode="modpack" />}
            {activeTab === 'addons' && <ModrinthPage defaultMode="addons" />}
            {activeTab === 'files' && <FilesPage />}
            {activeTab === 'backups' && <BackupsPage />}
            {activeTab === 'players' && <PlayersPage />}
            {activeTab === 'network' && <NetworkPage />}
            {activeTab === 'settings' && <SettingsPage />}
            {activeTab === 'docs' && <DocsPage />}
          </main>
        </div>
      </div>
    </div>
  )
}
