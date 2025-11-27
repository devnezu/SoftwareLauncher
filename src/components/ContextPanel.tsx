import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import { FileCode, Folder, Copy, Save, CheckSquare, Square, ChevronRight, ChevronDown, Trash2, FileText, ExternalLink, Eraser, Eye, EyeOff, Check, XCircle, FolderOpen, FolderClosed } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { useToast } from './ui/use-toast'
import { ToastAction } from './ui/toast'
import { Project } from '../types'
import { cn, formatContextForClipboard } from '../lib/utils'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface ContextPanelProps {
  project: Project
  onUpdateProject: (project: Project) => void
}

interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  isDirectory: boolean
}

function buildTree(paths: string[], rootPath: string): TreeNode {
  const cleanRoot = rootPath.replace(/[\\/]$/, '');
  const root: TreeNode = { name: 'root', path: cleanRoot, children: [], isDirectory: true }
  
  paths.forEach(pathStr => {
    const sep = pathStr.includes('\\') ? '\\' : '/';
    const relative = pathStr.replace(cleanRoot, '').replace(/^[\\/]/, '')
    const parts = relative.split(/[\\/]/)
    
    let current = root
    let currentPath = cleanRoot;

    parts.forEach((part, index) => {
      if (!part) return
      currentPath = currentPath + sep + part;
      let child = current.children.find(c => c.name === part)
      if (!child) {
        const isDir = index < parts.length - 1
        child = { name: part, path: currentPath, children: [], isDirectory: isDir }
        current.children.push(child)
      }
      current = child
    })
    current.path = pathStr
    current.isDirectory = false
  })
  
  const sortNodes = (node: TreeNode) => {
      node.children.sort((a, b) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
          return a.isDirectory ? -1 : 1
      })
      node.children.forEach(sortNodes)
  }
  sortNodes(root)
  return root
}

// Optimization: Memoized Tree Node
const FileTreeNode = memo(({ 
    node, 
    selected, 
    hiddenPaths, 
    expandedPaths,
    showHidden, 
    onToggle, 
    onToggleHide, 
    onToggleExpand,
    onContextMenu 
}: { 
    node: TreeNode, 
    selected: Set<string>, 
    hiddenPaths: Set<string>, 
    expandedPaths: Set<string>,
    showHidden: boolean, 
    onToggle: (path: string, checked: boolean) => void, 
    onToggleHide: (path: string) => void,
    onToggleExpand: (path: string) => void,
    onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
}) => {
  // Pre-calculate leafs only when node structure changes
  const leafs = useMemo(() => {
    const getAllLeafs = (n: TreeNode): string[] => {
        if (!n.isDirectory) return [n.path]
        return n.children.flatMap(getAllLeafs)
    }
    return getAllLeafs(node)
  }, [node])

  const isAllSelected = leafs.every(p => selected.has(p))
  const isPartiallySelected = !isAllSelected && leafs.some(p => selected.has(p))
  const isDirectlyHidden = hiddenPaths.has(node.path)
  const isExpanded = expandedPaths.has(node.path)

  if (!showHidden && isDirectlyHidden) return null

  const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.isDirectory) {
          // Batch selection for better performance
          // We pass the root node of this action and the desired state
          // The parent component handles the logic to avoid N re-renders
          onToggle(node.path, !isAllSelected) // We pass path, parent will find node and leafs
      } else {
          onToggle(node.path, !selected.has(node.path))
      }
  }

  // Root node render
  if (node.name === 'root') {
      return (
          <div className="flex flex-col">
              {node.children.map(child => (
                <FileTreeNode 
                    key={child.name} 
                    node={child} 
                    selected={selected} 
                    hiddenPaths={hiddenPaths}
                    expandedPaths={expandedPaths}
                    showHidden={showHidden}
                    onToggle={onToggle} 
                    onToggleHide={onToggleHide}
                    onToggleExpand={onToggleExpand}
                    onContextMenu={onContextMenu}
                />
              ))}
          </div>
      )
  }

  return (
    <div className="select-none relative">
      <div 
        className={cn(
            "group flex items-center gap-2 py-0.5 px-2 hover:bg-zinc-800/50 rounded-md cursor-pointer transition-colors text-sm pr-2 min-w-0",
            isDirectlyHidden && "opacity-50"
        )}
        onClick={(e) => { e.stopPropagation(); if(node.isDirectory) onToggleExpand(node.path); else handleToggle(e); }}
        onContextMenu={(e) => { 
            if(node.isDirectory) { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onContextMenu(e, node); 
            } 
        }}
      >
        {/* Checkbox */}
        <div 
            className="p-0.5 shrink-0 rounded hover:bg-white/10 text-zinc-400"
            onClick={handleToggle}
        >
            {isAllSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : 
             isPartiallySelected ? <Square className="w-4 h-4 text-indigo-400 fill-indigo-400/20" /> : 
             <Square className="w-4 h-4" />}
        </div>
        
        {/* Icon & Name */}
        <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
            {node.isDirectory ? (
                <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                    <span className="text-zinc-600 shrink-0">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <Folder className={cn("w-4 h-4 shrink-0 fill-current", isExpanded ? "text-indigo-300/80" : "text-zinc-500")} />
                    <span className="truncate font-medium">{node.name}</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-zinc-400 min-w-0 pl-5">
                    <FileCode className="w-4 h-4 text-zinc-600 shrink-0" />
                    <span className={cn("transition-colors truncate", selected.has(node.path) ? "text-zinc-200" : "")}>{node.name}</span>
                </div>
            )}
        </div>

        {/* Hide/Unhide Action */}
        <div 
            className={cn("opacity-0 group-hover:opacity-100 transition-opacity shrink-0", isDirectlyHidden && "opacity-100")}
            onClick={(e) => { e.stopPropagation(); onToggleHide(node.path); }}
        >
            {isDirectlyHidden ? (
                <EyeOff className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
            ) : (
                <Eye className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400" />
            )}
        </div>
      </div>
      
      {node.isDirectory && isExpanded && (
        <div className="flex flex-col ml-4 pl-1 border-l border-zinc-800/60 relative">
          {node.children.map(child => (
            <FileTreeNode 
                key={child.name} 
                node={child} 
                selected={selected} 
                hiddenPaths={hiddenPaths}
                expandedPaths={expandedPaths}
                showHidden={showHidden}
                onToggle={onToggle} 
                onToggleHide={onToggleHide}
                onToggleExpand={onToggleExpand}
                onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
})

export function ContextPanel({ project, onUpdateProject }: ContextPanelProps) {
  const { toast } = useToast()
  const [files, setFiles] = useState<string[]>([])
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [stats, setStats] = useState({ count: 0, chars: 0 })
  const [showHidden, setShowHidden] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: TreeNode } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const hiddenPaths = useMemo(() => new Set(project.hiddenContextPaths || []), [project.hiddenContextPaths])
  const rootDir = project.tasks[0]?.workingDirectory || ''

  useEffect(() => {
    loadFiles()
    
    const handleClickOutside = (e: MouseEvent) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
            setContextMenu(null)
        }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [project.id])

  const loadFiles = async () => {
    if (!rootDir || !ipcRenderer) return
    setLoading(true)
    const res = await ipcRenderer.invoke('scan-directory', rootDir)
    if (res.success) {
      setFiles(res.files)
      const newTree = buildTree(res.files, rootDir)
      setTree(newTree)
      // Expand root level by default
      const initialExpanded = new Set<string>()
      newTree.children.forEach(c => initialExpanded.add(c.path))
      setExpandedPaths(initialExpanded)
    } else {
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: `Could not scan directory: ${rootDir}`,
        action: (
          <ToastAction altText="Details" onClick={() => setErrorDetails(res.error)}>
            Details
          </ToastAction>
        ),
      })
    }
    setLoading(false)
  }

  // Optimized Helper to find node
  const findNode = (root: TreeNode, path: string): TreeNode | null => {
      if (root.path === path) return root
      for (const child of root.children) {
          if (child.isDirectory) {
              const found = findNode(child, path)
              if (found) return found
          } else if (child.path === path) {
              return child
          }
      }
      return null
  }

  const getAllLeafs = (n: TreeNode): string[] => {
      if (!n.isDirectory) return [n.path]
      return n.children.flatMap(getAllLeafs)
  }

  // Optimized toggle handler
  const handleToggle = useCallback((path: string, checked: boolean) => {
    setSelected(prev => {
        const newSet = new Set(prev)
        
        // Check if it's a directory by checking the tree (passed via path logic or we find the node)
        // Since we are in the parent, we can search the tree if needed, 
        // OR rely on the fact that if it's a folder, we want all its children.
        // To be safe and performant, we find the node.
        if (tree) {
             const node = findNode(tree, path)
             if (node) {
                 const leafs = getAllLeafs(node)
                 leafs.forEach(leafPath => {
                     if (checked) newSet.add(leafPath)
                     else newSet.delete(leafPath)
                 })
             }
        }
        
        calculateStats(newSet)
        return newSet
    })
  }, [tree])

  const handleToggleHide = useCallback((path: string) => {
      const newHidden = new Set(hiddenPaths)
      if (newHidden.has(path)) newHidden.delete(path)
      else {
          newHidden.add(path)
          setSelected(prev => {
              if (prev.has(path)) {
                  const n = new Set(prev); n.delete(path); calculateStats(n); return n;
              }
              return prev
          })
      }
      onUpdateProject({ ...project, hiddenContextPaths: Array.from(newHidden) })
  }, [hiddenPaths, project, selected])

  const handleToggleExpand = useCallback((path: string) => {
      setExpandedPaths(prev => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
      })
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
      setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const handleContextSelectAll = () => {
      if (!contextMenu) return
      const leafs = getAllLeafs(contextMenu.node)
      setSelected(prev => {
          const next = new Set(prev)
          leafs.forEach(l => next.add(l))
          calculateStats(next)
          return next
      })
      setContextMenu(null)
  }

  const handleContextDeselectAll = () => {
      if (!contextMenu) return
      const leafs = getAllLeafs(contextMenu.node)
      setSelected(prev => {
          const next = new Set(prev)
          leafs.forEach(l => next.delete(l))
          calculateStats(next)
          return next
      })
      setContextMenu(null)
  }
  
  const handleContextExpand = () => {
      if (!contextMenu) return
      setExpandedPaths(prev => new Set(prev).add(contextMenu.node.path))
      setContextMenu(null)
  }

  const handleContextCollapse = () => {
      if (!contextMenu) return
      setExpandedPaths(prev => { const n = new Set(prev); n.delete(contextMenu.node.path); return n; })
      setContextMenu(null)
  }

  const handleClear = () => {
    setSelected(new Set())
    setStats({ count: 0, chars: 0 })
  }

  const calculateStats = (currentSelected: Set<string>) => {
      setStats({ count: currentSelected.size, chars: 0 }) 
  }

  // ... (Keep handleCopy, savePreset, loadPreset, deletePreset as is) ...
  const handleCopy = async () => {
    if (!ipcRenderer || selected.size === 0) return
    const paths = Array.from(selected)
    const res = await ipcRenderer.invoke('read-files-content', paths)
    if (res.success) {
      const clipboardText = formatContextForClipboard(project.name, res.files, rootDir)
      await navigator.clipboard.writeText(clipboardText)
      
      let totalChars = 0
      res.files.forEach((f: any) => totalChars += f.size)
      setStats(prev => ({ ...prev, chars: totalChars }))
    }
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const newPreset = { name: presetName, files: Array.from(selected) }
    const updatedPresets = [...(project.contextPresets || []), newPreset]
    onUpdateProject({ ...project, contextPresets: updatedPresets })
    setPresetName('')
  }

  const loadPreset = (preset: { name: string, files: string[] }) => {
    const validFiles = new Set(preset.files.filter(f => files.includes(f)))
    setSelected(validFiles)
    calculateStats(validFiles)
  }

  const deletePreset = (index: number) => {
     const updatedPresets = [...(project.contextPresets || [])]
     updatedPresets.splice(index, 1)
     onUpdateProject({ ...project, contextPresets: updatedPresets })
  }

  return (
    <div className="flex flex-1 min-h-0 gap-6 p-8 max-w-[1800px] w-full mx-auto relative">
      {/* File Tree */}
      <div className="flex-1 flex flex-col min-w-0 bg-white/50 dark:bg-zinc-900/30 border border-border rounded-xl overflow-hidden relative shadow-sm">
        <div className="p-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
             <div className="flex items-center gap-4">
                 <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">File Explorer</span>
                 <button 
                    onClick={() => setShowHidden(!showHidden)}
                    className={cn(
                        "text-[10px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1",
                        showHidden 
                            ? "bg-indigo-500/10 text-indigo-500 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30" 
                            : "bg-transparent text-muted-foreground border-transparent hover:text-foreground"
                    )}
                 >
                    {showHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {showHidden ? 'Hide Ignored' : 'Show Ignored'}
                 </button>
             </div>
             <Button variant="ghost" size="sm" onClick={loadFiles} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"><ExternalLink className="w-3 h-3" /></Button>
        </div>
        <ScrollArea className="flex-1 p-2 bg-white/30 dark:bg-transparent">
            {loading ? (
                <div className="text-muted-foreground text-xs p-4 text-center">Scanning files...</div>
            ) : tree ? (
                <FileTreeNode 
                    node={tree} 
                    selected={selected} 
                    hiddenPaths={hiddenPaths}
                    expandedPaths={expandedPaths}
                    showHidden={showHidden}
                    onToggle={handleToggle} 
                    onToggleHide={handleToggleHide}
                    onToggleExpand={handleToggleExpand}
                    onContextMenu={handleContextMenu}
                />
            ) : (
                <div className="text-muted-foreground text-xs p-4 text-center">No files found.</div>
            )}
        </ScrollArea>

        {/* Custom Context Menu */}
        {contextMenu && (
            <div 
                ref={contextMenuRef}
                style={{ top: contextMenu.y, left: contextMenu.x }}
                className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            >
                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border mb-1 truncate max-w-[200px]">
                    {contextMenu.node.name}
                </div>
                <button onClick={handleContextSelectAll} className="w-full text-left px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5" /> Select All
                </button>
                <button onClick={handleContextDeselectAll} className="w-full text-left px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent flex items-center gap-2">
                    <Square className="w-3.5 h-3.5" /> Deselect All
                </button>
                <div className="h-[1px] bg-border my-1" />
                <button onClick={handleContextExpand} className="w-full text-left px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5" /> Open
                </button>
                <button onClick={handleContextCollapse} className="w-full text-left px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent flex items-center gap-2">
                    <FolderClosed className="w-3.5 h-3.5" /> Close
                </button>
            </div>
        )}
      </div>

      {/* Sidebar: Actions & Presets */}
      <div className="w-[300px] flex flex-col gap-6">
          <div className="premium-card p-5 space-y-4 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-500/10 border-indigo-100 dark:border-indigo-500/20">
              <div>
                  <h3 className="text-indigo-500 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Selected Context</h3>
                  <div className="text-2xl font-mono text-foreground">{stats.count} <span className="text-sm text-muted-foreground font-sans">files</span></div>
                  {stats.chars > 0 && <div className="text-xs text-muted-foreground mt-1">~{Math.round(stats.chars/1024)} KB copied</div>}
              </div>
              <div className="flex gap-2">
                  <Button onClick={handleCopy} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                      <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleClear} title="Clear Selection" className="border-indigo-200 dark:border-indigo-500/20 text-indigo-400 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-white">
                      <Eraser className="w-4 h-4" />
                  </Button>
              </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white/50 dark:bg-zinc-900/30 border border-border rounded-xl overflow-hidden shadow-sm">
             <div className="p-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Presets</span>
             </div>
             
             <div className="p-4 border-b border-border space-y-2">
                 <div className="flex gap-2">
                    <Input 
                        placeholder="Preset Name" 
                        value={presetName} 
                        onChange={e => setPresetName(e.target.value)} 
                        className="h-8 text-xs bg-white dark:bg-black/20 border-input"
                    />
                    <Button size="sm" onClick={savePreset} disabled={!presetName || selected.size === 0} className="h-8 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-foreground">
                        <Save className="w-3.5 h-3.5" />
                    </Button>
                 </div>
             </div>

             <ScrollArea className="flex-1 p-2 bg-white/30 dark:bg-transparent">
                <div className="space-y-1">
                    {project.contextPresets?.map((preset, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent group transition-colors">
                            <button 
                                onClick={() => loadPreset(preset)}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground truncate flex-1 text-left"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                {preset.name}
                                <span className="text-[10px] text-muted-foreground bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded ml-auto border border-border">
                                    {preset.files.length}
                                </span>
                            </button>
                            <button 
                                onClick={() => deletePreset(i)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    {(!project.contextPresets || project.contextPresets.length === 0) && (
                        <div className="text-[10px] text-muted-foreground text-center py-4">No presets saved</div>
                    )}
                </div>
             </ScrollArea>
          </div>
      </div>

      <Dialog open={!!errorDetails} onOpenChange={(o) => !o && setErrorDetails(null)}>
        <DialogContent className="max-w-3xl bg-background border border-destructive/20 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-destructive">Scan Error Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            <pre className="text-xs font-mono text-muted-foreground p-4 bg-muted rounded-lg whitespace-pre-wrap break-all border border-border">
              {errorDetails}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setErrorDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
