# BlockHost — Minecraft Server Hosting & Management for Windows

BlockHost is a complete Windows desktop application for creating, importing, running, monitoring, and tunneling local Minecraft servers.

## Features (All 65 Included)
- **Dashboard & Multi-Server Management**: Live CPU, RAM, Disk, Players, and Uptime sparklines, embedded server console, Quick Actions, and Recent Activity feed.
- **7 Server Engines**: Official metadata & automatic installation for **Vanilla, Paper, Purpur, Fabric, Quilt, Forge, and NeoForge**.
- **Automatic Java Management**: Detects installed JDKs and downloads **Eclipse Temurin 8, 17, 21, or 25** directly via the Adoptium API.
- **Built-in playit.gg Tunneling**: Runs 100% in-process inside BlockHost (`PlayitService` & `PlayitProtoCodec`) with zero separate agent processes.
- **Modrinth Integration**: Search and install **Mods, Plugins, and `.mrpack` Modpacks** with automatic dependency resolution and update checks.
- **Player Management**: Live online roster, Mojang UUID lookup, Whitelist, Operators (OP levels 1–4), and Player/IP Bans.
- **File Manager, Code Editor & Worlds**: Sandboxed file browser, ZIP extract/compress, syntax-friendly editor with `.bak` safety copies, and World dimension management.
- **Backups, Safe Restore & Cron Scheduler**: Live `save-off` / `save-all flush` hooks, retention limits, pre-restore safety snapshots, and automated cron jobs.
- **Windows NSIS Installer & Uninstaller**: Custom installation directory, Desktop/Start Menu shortcuts, and data retention prompt on uninstall.

## Development & Build Commands
```bash
npm install
npm run test        # Run Vitest unit tests
npm run dev         # Launch in development mode
npm run build:win   # Build Windows NSIS Installer EXE in dist/
```
