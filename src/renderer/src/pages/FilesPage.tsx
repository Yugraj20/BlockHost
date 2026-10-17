import React, { useEffect, useState } from 'react'
import {
  Folder,
  FileText,
  Upload,
  FolderPlus,
  Trash2,
  Edit3,
  Archive,
  Save,
  ArrowLeft,
  Check
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { FileNode } from '../../../shared/types'

interface FilesPageProps {
  serverId?: string
  hideServerSelector?: boolean
}

export const FilesPage: React.FC<FilesPageProps> = ({ serverId, hideServerSelector = false }) => {
  const { servers, selectedServerId, setSelectedServerId } = useAppStore()
  const activeServerId = serverId || selectedServerId || servers[0]?.id
  const server = servers.find((s) => s.id === activeServerId) || servers[0]

  const [currentDir, setCurrentDir] = useState('')
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [editorText, setEditorText] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  const refreshDir = async (dir = currentDir) => {
    if (!server) return
    const list = await window.api.listFiles(server.id, dir)
    setNodes(list)
  }

  useEffect(() => {
    setCurrentDir('')
    setEditingPath(null)
    refreshDir('')
  }, [server?.id])

  const openEntry = async (node: FileNode) => {
    if (!server) return
    if (node.isDirectory) {
      setCurrentDir(node.path)
      setEditingPath(null)
      refreshDir(node.path)
    } else {
      const editableExts = [
        '.properties',
        '.yml',
        '.yaml',
        '.json',
        '.toml',
        '.txt',
        '.log',
        '.cfg',
        '.conf',
        '.sh',
        '.bat',
        '.mcmeta'
      ]
      if (editableExts.includes(node.extension) || node.size < 2 * 1024 * 1024) {
        const text = await window.api.readFile(server.id, node.path)
        setEditingPath(node.path)
        setEditorText(text)
      }
    }
  }

  const goUp = () => {
    if (!currentDir) return
    const parts = currentDir.split('/')
    parts.pop()
    const parent = parts.join('/')
    setCurrentDir(parent)
    setEditingPath(null)
    refreshDir(parent)
  }

  const handleSaveFile = async () => {
    if (!server || !editingPath) return
    await window.api.writeFile(server.id, editingPath, editorText)
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 1500)
    refreshDir()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="bg-bh-card border border-bh-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          {!hideServerSelector && (
            <select
              value={server?.id || ''}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs font-bold text-bh-text"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={goUp}
            disabled={!currentDir}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs text-bh-text border border-bh-border flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Up
          </button>

          <span className="text-xs font-mono text-emerald-400">
            /{currentDir || ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!server) return
              const folderName = prompt('New folder name:')
              if (!folderName) return
              const rel = currentDir ? `${currentDir}/${folderName}` : folderName
              await window.api.createDirectory(server.id, rel)
              refreshDir()
            }}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> New Folder
          </button>

          <button
            onClick={async () => {
              if (!server) return
              await window.api.uploadFilesDialog(server.id, currentDir)
              refreshDir()
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Files
          </button>
        </div>
      </div>

      {/* Main Split View: File List + Built-in Code Editor */}
      <div className="grid grid-cols-12 gap-4">
        <div
          className={`${
            editingPath ? 'col-span-12 lg:col-span-5' : 'col-span-12'
          } bg-bh-card/90 border border-bh-border rounded-2xl p-3 max-h-[600px] overflow-y-auto shadow-xl`}
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bh-border text-bh-muted">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-2">Size</th>
                <th className="py-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bh-border">
              {nodes.map((n) => (
                <tr
                  key={n.path}
                  onClick={() => openEntry(n)}
                  className="hover:bg-white/5 cursor-pointer transition"
                >
                  <td className="py-2.5 px-3 flex items-center gap-2.5 font-medium text-bh-text">
                    {n.isDirectory ? (
                      <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                    <span className="truncate">{n.name}</span>
                  </td>
                  <td className="py-2.5 px-2 text-bh-muted font-mono">
                    {n.isDirectory ? 'DIR' : `${(n.size / 1024).toFixed(1)} KB`}
                  </td>
                  <td
                    className="py-2.5 px-2 text-right space-x-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.extension === '.zip' && (
                      <button
                        onClick={async () => {
                          if (!server) return
                          await window.api.extractZip(server.id, n.path, currentDir)
                          refreshDir()
                        }}
                        title="Extract ZIP Here"
                        className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!server) return
                        const nextName = prompt('Rename to:', n.name)
                        if (!nextName || nextName === n.name) return
                        await window.api.renameEntry(server.id, n.path, nextName)
                        refreshDir()
                      }}
                      title="Rename"
                      className="p-1 rounded hover:bg-white/10 text-bh-muted hover:text-bh-text"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!server) return
                        if (confirm(`Delete "${n.name}"?`)) {
                          await window.api.deleteEntry(server.id, n.path)
                          if (editingPath === n.path) setEditingPath(null)
                          refreshDir()
                        }
                      }}
                      title="Delete"
                      className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* File Editor Pane */}
        {editingPath && (
          <div className="col-span-12 lg:col-span-7 bg-bh-card/90 border border-bh-border rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-bh-border pb-2.5">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400">{editingPath}</span>
                <p className="text-[10px] text-bh-muted">
                  Automatic `.bak` backup copy created on save
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveFile}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {savedNotice ? 'Saved!' : 'Save File'}
                </button>
                <button
                  onClick={() => setEditingPath(null)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-bh-muted"
                >
                  Close
                </button>
              </div>
            </div>

            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              spellCheck={false}
              className="w-full h-[500px] bg-[#070b13] border border-bh-border rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  )
}
