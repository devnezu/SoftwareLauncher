import { useState, useEffect, useRef } from 'react'
import { Search, Play, Square, Home, RotateCw, CornerDownLeft } from 'lucide-react'
import { Dialog, DialogContent } from './ui/dialog'
import { Project } from '../types'
import { cn } from '../lib/utils'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  currentProject: Project | null
  onSelectProject: (project: Project) => void
  onRunTask: (project: Project, taskName: string) => void
  onStopTask: (project: Project, taskName: string) => void
  onNavigateHome: () => void
  runningProjects: Set<string>
  taskStates: Record<string, boolean>
}

type CommandItem = {
  id: string
  type: 'project' | 'task' | 'global'
  title: string
  subtitle?: string
  icon: any
  action: () => void
  meta?: any
}

// Custom simple Folder Icon to avoid import mess if not available
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
  )
}

export function CommandPalette({ 
  open, 
  onOpenChange, 
  projects, 
  currentProject, 
  onSelectProject, 
  onRunTask, 
  onStopTask,
  onNavigateHome,
  runningProjects,
  taskStates
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  
  // Build items list based on context
  const items: CommandItem[] = []
  
  // 1. Current Context (Tasks)
  if (currentProject) {
      currentProject.tasks.forEach(task => {
          const isRunning = taskStates[task.name]
          items.push({
              id: `task-${task.name}`,
              type: 'task',
              title: isRunning ? `Stop ${task.name}` : `Start ${task.name}`,
              subtitle: currentProject.name,
              icon: isRunning ? Square : Play,
              action: () => {
                  if (isRunning) onStopTask(currentProject, task.name)
                  else onRunTask(currentProject, task.name)
                  onOpenChange(false)
              },
              meta: { isRunning }
          })
      })
  }

  // 2. Navigation (Projects)
  projects.forEach(p => {
      if (currentProject?.id !== p.id) {
        items.push({
            id: `proj-${p.id}`,
            type: 'project',
            title: p.name,
            subtitle: 'Switch Project',
            icon: FolderIcon, 
            action: () => {
                onSelectProject(p)
                onOpenChange(false)
            }
        })
      }
  })

  // 3. Globals
  items.push({
      id: 'global-home',
      type: 'global',
      title: 'Go to Dashboard',
      subtitle: 'Global',
      icon: Home,
      action: () => {
          onNavigateHome()
          onOpenChange(false)
      }
  })

  items.push({
      id: 'global-reload',
      type: 'global',
      title: 'Reload Window',
      subtitle: 'Developer',
      icon: RotateCw,
      action: () => {
          window.location.reload()
      }
  })

  // Filter items
  const filteredItems = items.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) || 
      item.subtitle?.toLowerCase().includes(query.toLowerCase())
  )

  // Reset selection when query changes
  useEffect(() => {
      setSelectedIndex(0)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!open) return

          if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex(prev => (prev + 1) % filteredItems.length)
          } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length)
          } else if (e.key === 'Enter') {
              e.preventDefault()
              filteredItems[selectedIndex]?.action()
          }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredItems, selectedIndex])

  // Auto-scroll to selected
  useEffect(() => {
      if (listRef.current) {
          const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
          if (selectedEl) {
              selectedEl.scrollIntoView({ block: 'nearest' })
          }
      }
  }, [selectedIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 bg-[#121214] border-zinc-800 text-zinc-100 overflow-hidden shadow-2xl top-[20%] translate-y-0">
        <div className="flex items-center px-4 py-3 border-b border-white/5">
            <Search className="w-5 h-5 text-zinc-500 mr-3" />
            <input 
                className="flex-1 bg-transparent border-none outline-none text-lg text-zinc-200 placeholder:text-zinc-600 font-light"
                placeholder="Type a command or search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
            />
            <div className="flex items-center gap-1">
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400 opacity-100">
                    ESC
                </kbd>
            </div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto p-2" ref={listRef}>
            {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-500">No results found.</div>
            ) : (
                filteredItems.map((item, index) => (
                    <div 
                        key={item.id}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group",
                            index === selectedIndex ? "bg-indigo-600/10" : "hover:bg-zinc-800/50"
                        )}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(index)}
                    >
                        <div className={cn(
                            "p-2 rounded-md", 
                            index === selectedIndex ? "bg-indigo-600/20 text-indigo-400" : "bg-zinc-800 text-zinc-400"
                        )}>
                            <item.icon className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center">
                            <span className={cn("text-sm font-medium", index === selectedIndex ? "text-indigo-200" : "text-zinc-300")}>
                                {item.title}
                            </span>
                            {item.subtitle && (
                                <span className="text-[10px] text-zinc-500">
                                    {item.subtitle}
                                </span>
                            )}
                        </div>
                        
                        {index === selectedIndex && (
                            <CornerDownLeft className="w-4 h-4 text-zinc-500 animate-in fade-in slide-in-from-right-1" />
                        )}
                    </div>
                ))
            )}
        </div>
        
        <div className="px-4 py-2 bg-zinc-900/50 border-t border-white/5 flex justify-between items-center text-[10px] text-zinc-500">
             <span>ProTip: Use <kbd className="font-mono text-zinc-400">↑</kbd> <kbd className="font-mono text-zinc-400">↓</kbd> to navigate</span>
             <span>Software Launcher v1.0</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
