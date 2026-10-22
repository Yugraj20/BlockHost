import React from 'react'
import { BookOpen, Server, Globe, Shield, Cpu, History, Puzzle } from 'lucide-react'

export const DocsPage: React.FC = () => {
  const sections = [
    {
      icon: Server,
      title: '1. Creating & Importing Servers',
      body: 'Use "Create Server" to deploy Vanilla, Paper, Purpur, Fabric, Quilt, Forge, or NeoForge servers. ChunkHarbor automatically downloads the official server JAR, writes eula.txt, configures server.properties, and picks the optimal Java version. You can also import existing server folders or .zip archives with automatic loader and port detection.'
    },
    {
      icon: Cpu,
      title: '2. Automatic Java Management & Aikar Flags',
      body: 'Minecraft 1.16.5 and older use Java 8, 1.17–1.20.4 use Java 17, 1.20.5–1.21 use Java 21, and year-based 26.x releases use Java 25. Visit Settings → Java Runtimes to install Eclipse Temurin JRE 8, 17, 21, or 25 directly into ChunkHarbor with one click.'
    },
    {
      icon: Globe,
      title: '3. Built-in playit.gg Tunneling (Zero Separate Processes)',
      body: 'ChunkHarbor includes a native TypeScript implementation of the playit.gg control & proxy protocol inside the application. Link your account or activate the built-in agent on the Network tab, then enable a tunnel for any server to share a public join address without router port forwarding.'
    },
    {
      icon: Puzzle,
      title: '4. Modrinth Mods, Plugins & Modpacks (.mrpack)',
      body: 'Browse Modrinth directly inside ChunkHarbor. Installing a mod or plugin automatically resolves and downloads required dependencies into mods/ or plugins/. Installing a Modpack extracts server overrides and downloads all server-compatible files.'
    },
    {
      icon: History,
      title: '5. Live Backups, Safe Restore & Cron Scheduling',
      body: 'When creating a backup on a running server, ChunkHarbor automatically sends save-off and save-all flush before zipping and re-enables saving afterward. Restoring any backup automatically creates a Pre-Restore Safety Snapshot first.'
    },
    {
      icon: Shield,
      title: '6. Security, Permissions & Diagnostics',
      body: 'All file operations are sandboxed to prevent path traversal, downloads enforce HTTPS + SHA verification, and you can enable an optional PIN lock in Settings → Security.'
    }
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 flex items-center gap-3.5 shadow-xl">
        <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-bh-text">
            ChunkHarbor User Guide & Documentation
          </h2>
          <p className="text-xs text-bh-muted">
            Complete reference for all 65 features included in ChunkHarbor Desktop
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec) => {
          const Icon = sec.icon
          return (
            <div
              key={sec.title}
              className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-2 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-bh-text">{sec.title}</h3>
              </div>
              <p className="text-xs text-bh-muted leading-relaxed">{sec.body}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
