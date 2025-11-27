import { useState, useEffect, useRef } from 'react'
import {
  Play, Square, Cog, Folder, Terminal, Plus, X,
  Cpu, HardDrive, Search, Trash2, RotateCw, FileCode, ExternalLink, LayoutDashboard
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { ScrollArea } from './components/ui/scroll-area'
import { TitleBar } from './components/TitleBar'
import { Home } from './components/Home'
import { Sidebar } from './components/Sidebar'
import { AnsiText } from './components/AnsiText'
import { ContextPanel } from './components/ContextPanel'
import { CommandPalette } from './components/CommandPalette'
import { DynamicIcon, IconPicker } from './components/IconManager'
import { cn } from './lib/utils'
import { Project, Task } from './types'
import { ContextMenu } from './components/ContextMenu'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

function normalizeTask(task: any): Task {
  return {
    name: task.name || 'Unnamed Task',
    command: task.command || '',
    workingDirectory: task.workingDirectory || '',
    envFilePath: task.envFilePath,
    envVariables: task.envVariables,
    executionMode: task.executionMode || 'internal',
    icon: task.icon || 'Terminal',
    port: task.port ? parseInt(task.port) : undefined,
    healthCheck: task.healthCheck ? {
      enabled: task.healthCheck.enabled ?? false,
      url: task.healthCheck.url || '',
      interval: task.healthCheck.interval ?? 30000,
      timeout: task.healthCheck.timeout ?? 5000,
      retries: task.healthCheck.retries ?? 3,
      autoRestart: task.healthCheck.autoRestart ?? true
    } : undefined
  }
}

function App() {
  const [view, setView] = useState<'home' | 'project'>('home')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'context'>('dashboard')
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [runningProjects, setRunningProjects] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const [taskStates, setTaskStates] = useState<Record<string, boolean>>({})
  const restartingTasks = useRef<Set<string>>(new Set())

  const [metrics, setMetrics] = useState<any>(null)
  
  const [healthStatus, setHealthStatus] = useState<any[]>([])
  const [activeConsoleTab, setActiveConsoleTab] = useState<string>('all')
  const [projectConsoles, setProjectConsoles] = useState<{ [key: string]: any[] }>({})
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [portConflict, setPortConflict] = useState<{taskName: string, port: number, pid: number} | null>(null)
  
  // Form State
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIcon, setFormIcon] = useState('Box')
  const [formTasks, setFormTasks] = useState<Task[]>([])
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault()
            setPaletteOpen(prev => !prev)
        }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const init = async () => {
      if (ipcRenderer) {
        const loaded = await ipcRenderer.invoke('load-projects')
        const normalizedProjects = loaded.map((proj: any) => ({
          ...proj,
          icon: proj.icon || 'Box',
          tasks: proj.tasks.map(normalizeTask)
        }))
        setProjects(normalizedProjects)

        const session = await ipcRenderer.invoke('check-running-session');
        const runningSet = new Set<string>(session.runningProjectIds || []);
        setRunningProjects(runningSet);

        const lastProjectId = localStorage.getItem('lastActiveProjectId');
        if (lastProjectId) {
            const lastProj = normalizedProjects.find((p: Project) => p.id === lastProjectId);
            if (lastProj) {
                setCurrentProject(lastProj);
                setView('project');
            }
        }
      }
      setIsLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (currentProject) {
        localStorage.setItem('lastActiveProjectId', currentProject.id);
    } else {
        localStorage.removeItem('lastActiveProjectId');
    }
  }, [currentProject]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [projectConsoles, activeConsoleTab, currentProject])

  useEffect(() => {
    setTaskStates({})
    setMetrics(null)
    if(currentProject && runningProjects.has(currentProject.id)) {
        const initialStates: Record<string, boolean> = {}
        currentProject.tasks.forEach(t => {
            if(t.executionMode !== 'external') initialStates[t.name] = true
        })
        setTaskStates(initialStates)
    }
  }, [currentProject])

  useEffect(() => {
    if (!ipcRenderer) return

    const handleOutput = (_: any, data: any) => {
      setProjectConsoles(prev => {
        const logs = prev[data.projectId] || []
        let newLogs = logs.length > 1000 ? logs.slice(1) : [...logs]

        const cleanData = data.data.replace(/\x1B\[[\d;]*[A-HJKSTfhilmnsu]/g, '').trim()
        if (!cleanData) return prev

        const hasClearLine = /\x1B\[2K/.test(data.data) || /\x1B\[1G/.test(data.data)

        if (hasClearLine && newLogs.length > 0) {
          const lastLog = newLogs[newLogs.length - 1]
          if (lastLog.taskName === data.taskName && lastLog.type === data.type) {
            newLogs.pop()
          }
        }

        if (newLogs.length > 0) {
          const lastLog = newLogs[newLogs.length - 1]
          const lastCleanData = lastLog.data.replace(/\x1B\[[\d;]*[A-HJKSTfhilmnsu]/g, '').trim()
          if (lastLog.taskName === data.taskName && lastCleanData === cleanData) {
            return prev
          }
        }

        newLogs.push({ ...data, timestamp: new Date().toLocaleTimeString() })
        return { ...prev, [data.projectId]: newLogs }
      })
    }

    const handleMetrics = (_: any, data: any) => {
        if (currentProject && data.projectId === currentProject.id) {
            setMetrics(data)
        }
    }

    const handleHealth = (_: any, data: any) => {
       setHealthStatus(prev => {
         const idx = prev.findIndex(h => h.taskName === data.taskName)
         if(idx >= 0) { const n = [...prev]; n[idx] = data; return n }
         return [...prev, data]
       })
    }

    const handleProcessClosed = (_: any, data: any) => {
        if (currentProject && data.projectId === currentProject.id) {
            if (restartingTasks.current.has(data.taskName)) {
                return;
            }

            setTaskStates(prev => ({ ...prev, [data.taskName]: false }));
            setProjectConsoles(prev => {
                const logs = prev[currentProject.id] || []
                return { ...prev, [currentProject.id]: [...logs, { 
                    type: 'system', 
                    data: `Process ${data.taskName} exited with code ${data.code}`,
                    taskName: data.taskName,
                    timestamp: new Date().toLocaleTimeString()
                }]}
            })
        }
    }

    ipcRenderer.on('process-output', handleOutput)
    ipcRenderer.on('performance-metrics', handleMetrics)
    ipcRenderer.on('health-check-status', handleHealth)
    ipcRenderer.on('process-closed', handleProcessClosed)

    return () => {
      ipcRenderer.removeAllListeners('process-output')
      ipcRenderer.removeAllListeners('performance-metrics')
      ipcRenderer.removeAllListeners('health-check-status')
      ipcRenderer.removeAllListeners('process-closed')
    }
  }, [currentProject])

  const handleLaunchProject = async () => {
    if (!currentProject || !ipcRenderer) return
    setProjectConsoles(prev => ({ ...prev, [currentProject.id]: [] }))
    setMetrics(null)
    setHealthStatus([])
    
    const result = await ipcRenderer.invoke('launch-project', currentProject, 'development')
    if (result.success) {
        setRunningProjects(prev => new Set(prev).add(currentProject.id))
        const newStates: Record<string, boolean> = {}
        currentProject.tasks.forEach(t => newStates[t.name] = true)
        setTaskStates(newStates)
    }
  }

  const handleStopProject = async () => {
    if (!currentProject || !ipcRenderer) return
    
    setProjectConsoles(prev => {
        const logs = prev[currentProject.id] || []
        return {
            ...prev,
            [currentProject.id]: [
                ...logs,
                {
                    type: 'system',
                    data: '🛑 Project stopped by user.',
                    taskName: 'SYSTEM',
                    timestamp: new Date().toLocaleTimeString()
                }
            ]
        }
    })

    await ipcRenderer.invoke('stop-project', currentProject.id)
    setRunningProjects(prev => { const n = new Set(prev); n.delete(currentProject.id); return n })
    setTaskStates({})
  }

  const handleToggleTask = async (taskName: string) => {
    if(!currentProject || !ipcRenderer) return;
    const isRunning = taskStates[taskName];

    if (isRunning) {
        await ipcRenderer.invoke('stop-task', currentProject.id, taskName);
        setTaskStates(prev => ({ ...prev, [taskName]: false }));
    } else {
        const result = await ipcRenderer.invoke('start-task', currentProject, taskName);
        if (result && !result.success && result.error === 'PORT_IN_USE') {
           setPortConflict({ taskName, port: result.port, pid: result.pid });
           return;
        }
        
        if (result && result.success) {
           setTaskStates(prev => ({ ...prev, [taskName]: true }));
           if (!runningProjects.has(currentProject.id)) {
               setRunningProjects(prev => new Set(prev).add(currentProject.id))
           }
        }
    }
  }

  const handleResolveConflict = async () => {
    if (!portConflict || !ipcRenderer) return;
    await ipcRenderer.invoke('kill-process-by-pid', portConflict.pid);
    const taskToRestart = portConflict.taskName;
    setPortConflict(null);
    // Short delay to ensure port is free
    setTimeout(() => handleToggleTask(taskToRestart), 500);
  }

  const handleRestartTask = async (taskName: string) => {
    if(!currentProject || !ipcRenderer) return;
    
    restartingTasks.current.add(taskName);
    
    setProjectConsoles(prev => ({
        ...prev,
        [currentProject.id]: [...(prev[currentProject.id]||[]), { type: 'system', data: `Restarting ${taskName}...`, taskName, timestamp: new Date().toLocaleTimeString() }]
    }))

    const result = await ipcRenderer.invoke('restart-task', currentProject, taskName);
    
    restartingTasks.current.delete(taskName);

    if (result.success) {
        setTaskStates(prev => ({ ...prev, [taskName]: true }));
    } else {
        setTaskStates(prev => ({ ...prev, [taskName]: false }));
    }
  }

  const handleClearConsole = () => {
    if (currentProject) {
      setProjectConsoles(prev => ({ ...prev, [currentProject.id]: [] }))
    }
  }

  const handleAutoAnalysis = async () => {
    if (!ipcRenderer) return
    const path = await ipcRenderer.invoke('select-directory')
    if (!path) return
    
    setFormDescription("🔍 Analisando arquivos do projeto...")
    
    const result = await ipcRenderer.invoke('analyze-project-with-ai', path)
    if (result.success) {
      setFormName(result.projectName || '')
      setFormDescription(result.description || '')
      setFormTasks(result.tasks.map((t: any) => ({
        ...normalizeTask(t),
        name: t.name,
        command: t.command,
        workingDirectory: t.workingDirectory,
        icon: t.name.toLowerCase().includes('server') ? 'Server' : 
              t.name.toLowerCase().includes('web') ? 'Globe' : 'Terminal'
      })))
    } else {
      setFormDescription(`Erro na análise: ${result.error}`)
    }
  }

  const handleSave = async () => {
    const proj: Project = {
      id: editingProject?.id || Date.now().toString(),
      name: formName,
      description: formDescription,
      icon: formIcon,
      tasks: formTasks
    }
    const newProjs = editingProject ? projects.map(p => p.id === proj.id ? proj : p) : [...projects, proj]
    setProjects(newProjs)
    if(ipcRenderer) await ipcRenderer.invoke('save-projects', newProjs)
    setModalOpen(false)
    if(currentProject?.id === proj.id) setCurrentProject(proj)
  }

  const handleUpdateProject = async (updatedProject: Project) => {
    const newProjs = projects.map(p => p.id === updatedProject.id ? updatedProject : p)
    setProjects(newProjs)
    setCurrentProject(updatedProject)
    if (ipcRenderer) await ipcRenderer.invoke('save-projects', newProjs)
  }

  const handleOpenIDE = async () => {
    if(!currentProject || !ipcRenderer) return
    const dir = currentProject.tasks[0]?.workingDirectory
    if(dir) await ipcRenderer.invoke('open-in-ide', dir)
  }

  if (isLoading) return null

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-indigo-500/30">
      <ContextMenu />
      <TitleBar />
      
      <div className="flex flex-1 min-h-0">
        <Sidebar 
          projects={projects}
          currentProject={currentProject}
          runningProjects={runningProjects}
          onSelectProject={(p) => { setCurrentProject(p); setView(p ? 'project' : 'home'); setActiveTab('dashboard'); }}
          onNewProject={() => { 
             setEditingProject(null); setFormName(''); setFormDescription(''); setFormIcon('Box'); setFormTasks([]); 
             setModalOpen(true) 
          }}
        />

        <main className="flex-1 flex flex-col relative z-0 bg-[#050505]">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/10 to-black pointer-events-none" />

          {view === 'home' || !currentProject ? (
            <Home 
              projects={projects}
              runningProjects={runningProjects}
              onSelectProject={(p: Project) => { setCurrentProject(p); setView('project'); setActiveTab('dashboard'); }}
              onNewProject={() => { setEditingProject(null); setModalOpen(true) }}
            />
          ) : (
            <div className="flex flex-col h-full animate-enter relative z-10">
              {/* Project Header */}
              <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-20">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                        <DynamicIcon name={currentProject.icon || 'Box'} className="w-6 h-6 text-zinc-200" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-3">
                            {currentProject.name}
                            {runningProjects.has(currentProject.id) && (
                                <span className="flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            )}
                        </h1>
                    </div>
                  </div>

                  <div className="h-8 w-[1px] bg-white/10" />

                  {/* Tabs */}
                  <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                      <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2", 
                            activeTab === 'dashboard' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                      </button>
                      <button 
                        onClick={() => setActiveTab('context')}
                        className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2", 
                            activeTab === 'context' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        <FileCode className="w-3.5 h-3.5" /> Context
                      </button>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                   {metrics && activeTab === 'dashboard' && (
                     <div className="flex items-center gap-4 bg-zinc-900/50 border border-white/5 rounded-full px-5 py-2 shadow-sm animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-2.5">
                            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] text-zinc-500 font-semibold">CPU</span>
                                <span className="text-xs font-mono text-indigo-100">{metrics.cpu}%</span>
                            </div>
                        </div>
                        <div className="w-[1px] h-5 bg-white/10" />
                        <div className="flex items-center gap-2.5">
                            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] text-zinc-500 font-semibold">RAM</span>
                                <span className="text-xs font-mono text-emerald-100">{metrics.memory}MB</span>
                            </div>
                        </div>
                     </div>
                   )}

                   <div className="h-6 w-[1px] bg-white/10" />

                   <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={handleOpenIDE} title="Open in VS Code" className="hover:bg-white/5 text-zinc-400 hover:text-blue-400"><ExternalLink className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                            setEditingProject(currentProject); setFormName(currentProject.name); 
                            setFormDescription(currentProject.description||''); 
                            setFormIcon(currentProject.icon || 'Box');
                            setFormTasks(currentProject.tasks);
                            setModalOpen(true);
                        }} className="hover:bg-white/5 text-zinc-400 hover:text-white"><Cog className="w-4 h-4" /></Button>

                        {runningProjects.has(currentProject.id) ? (
                            <Button onClick={handleStopProject} className="h-9 px-5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition-all rounded-lg">
                            <Square className="w-3 h-3 mr-2 fill-current" /> Stop All
                            </Button>
                        ) : (
                            <Button onClick={handleLaunchProject} className="h-9 px-6 text-xs font-medium bg-white text-black hover:bg-zinc-200 border-0 shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all rounded-lg">
                            <Play className="w-3 h-3 mr-2 fill-current" /> Launch Project
                            </Button>
                        )}
                   </div>
                </div>
              </div>

              {activeTab === 'dashboard' ? (
              <ScrollArea className="flex-1">
                <div className="p-8 max-w-[1800px] mx-auto space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {currentProject.tasks.map((task, i) => {
                      const isRunning = taskStates[task.name];
                      const hasError = healthStatus.find(h => h.taskName === task.name)?.status === 'unhealthy';
                      
                      return (
                        <div key={i} className={cn(
                            "relative flex flex-col h-[150px] rounded-xl border transition-all duration-300 overflow-hidden",
                            isRunning 
                                ? "bg-zinc-900/40 border-zinc-700/50 shadow-lg" 
                                : "bg-zinc-900/20 border-white/5 hover:border-white/10 hover:bg-zinc-900/30"
                        )}>
                           {isRunning && (
                               <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
                           )}

                           <div className="p-5 flex flex-col h-full relative z-10">
                               <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-3">
                                     <div className={cn("p-2 rounded-lg transition-colors", isRunning ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-800/50 text-zinc-500")}>
                                        <DynamicIcon name={task.icon || 'Terminal'} className="w-4 h-4" />
                                     </div>
                                     
                                     <div>
                                        <h3 className={cn("text-sm font-semibold", isRunning ? "text-white" : "text-zinc-400")}>
                                            {task.name}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className={cn("w-1.5 h-1.5 rounded-full", 
                                                isRunning 
                                                    ? (hasError ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]") 
                                                    : "bg-zinc-700"
                                            )} />
                                            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                                                {isRunning ? "Running" : "Stopped"}
                                            </span>
                                        </div>
                                     </div>
                                  </div>
                               </div>
                               
                               <div className="mt-auto">
                                  <div className="bg-black/20 rounded-md px-2 py-1.5 mb-3 border border-white/5">
                                    <code className="text-[10px] text-zinc-500 font-mono block truncate" title={task.command}>
                                        $ {task.command}
                                    </code>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => handleToggleTask(task.name)}
                                        className={cn(
                                            "h-7 text-xs flex-1 font-medium rounded-md border transition-all", 
                                            isRunning 
                                                ? "bg-red-500/5 text-red-400 border-red-500/10 hover:bg-red-500/10 hover:border-red-500/20" 
                                                : "bg-white/5 text-zinc-300 border-white/5 hover:bg-white/10 hover:text-white"
                                        )}
                                      >
                                        {isRunning ? "Stop" : "Start"}
                                      </Button>
                                      
                                      {isRunning && (
                                          <Button 
                                            size="icon" 
                                            variant="ghost"
                                            onClick={() => handleRestartTask(task.name)}
                                            className="h-7 w-7 bg-zinc-800/50 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md"
                                            title="Restart"
                                          >
                                            <RotateCw className="w-3 h-3" />
                                          </Button>
                                      )}
                                  </div>
                               </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="premium-card flex flex-col h-[500px] overflow-hidden border-zinc-800/50">
                    <div className="h-10 border-b border-white/5 bg-zinc-900/20 flex items-center px-4 justify-between shrink-0">
                      <div className="flex items-center gap-3">
                         <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                         <span className="text-xs font-medium text-zinc-400 tracking-tight">TERMINAL OUTPUT</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex bg-zinc-900/50 rounded-lg p-0.5 border border-white/5">
                            <button 
                                onClick={() => setActiveConsoleTab('all')} 
                                className={cn("px-3 py-1 text-[10px] font-medium rounded-md transition-all", 
                                    activeConsoleTab === 'all' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                ALL
                            </button>
                            {currentProject.tasks.filter(t => t.executionMode !== 'external').map(t => (
                              <button 
                                key={t.name} 
                                onClick={() => setActiveConsoleTab(t.name)} 
                                className={cn("px-3 py-1 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5", 
                                    activeConsoleTab === t.name ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                              >
                                {t.name}
                                {taskStates[t.name] && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                              </button>
                            ))}
                        </div>
                        
                        <div className="w-[1px] h-4 bg-white/10 mx-1" />
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={handleClearConsole} 
                          className="h-7 w-7 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg"
                          title="Clear Output"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 bg-[#080808] font-mono border-t border-black">
                      <div className="p-4 text-[11px] leading-relaxed">
                        {(projectConsoles[currentProject.id] || [])
                          .filter(l => activeConsoleTab === 'all' || l.taskName === activeConsoleTab)
                          .map((log, idx) => (
                          <div key={idx} className="flex gap-4 mb-0.5 hover:bg-white/[0.02] py-0.5 px-2 -mx-2 rounded transition-colors group">
                            <span className="text-zinc-700 shrink-0 select-none w-[60px] group-hover:text-zinc-600 transition-colors">{log.timestamp}</span>
                            {activeConsoleTab === 'all' && (
                              <span className="text-zinc-600 shrink-0 w-[100px] truncate font-semibold text-right pr-2 border-r border-white/5 mr-2 group-hover:text-zinc-500 transition-colors">{log.taskName}</span>
                            )}
                            <span className={cn("break-all whitespace-pre-wrap flex-1", 
                              log.type === 'stderr' ? 'text-red-400' : 
                              log.type === 'system' ? 'text-indigo-400 font-medium italic' : 
                              'text-zinc-300'
                            )}>
                              <AnsiText currentProjectRoot={currentProject.tasks[0]?.workingDirectory}>{log.data}</AnsiText>
                            </span>
                          </div>
                        ))}
                        <div ref={consoleEndRef} />
                        {(!projectConsoles[currentProject.id] || projectConsoles[currentProject.id].length === 0) && (
                           <div className="flex flex-col items-center justify-center h-full text-zinc-800 mt-20 select-none">
                              <Terminal className="w-8 h-8 mb-3 opacity-20" />
                              <span className="text-xs font-medium opacity-40">Waiting for process output...</span>
                           </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                </div>
              </ScrollArea>
              ) : (
                  <ContextPanel project={currentProject} onUpdateProject={handleUpdateProject} />
              )}
            </div>
          )}
        </main>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] bg-[#09090b] border border-white/10 text-white p-0 gap-0 flex flex-col overflow-hidden shadow-2xl">
          <DialogHeader className="p-6 border-b border-white/5 bg-zinc-900/30 shrink-0 flex flex-row justify-between items-center">
            <DialogTitle className="text-lg font-medium">Project Configuration</DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => setFormTasks([])} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs">
                <Trash2 className="w-3 h-3 mr-2" /> Clear All Tasks
            </Button>
          </DialogHeader>
          
          <div className="grid grid-cols-[300px_1fr] flex-1 min-h-0">
              <div className="p-6 border-r border-white/5 bg-zinc-900/10 flex flex-col gap-5 overflow-y-auto">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Project Details</label>
                        <div className="flex gap-2 mb-2">
                            <IconPicker selectedIcon={formIcon} onSelect={setFormIcon} />
                            <Input 
                                value={formName} 
                                onChange={e => setFormName(e.target.value)} 
                                placeholder="Project Name" 
                                className="premium-input bg-zinc-950/50 flex-1" 
                            />
                        </div>
                        <Textarea 
                            value={formDescription} 
                            onChange={e => setFormDescription(e.target.value)} 
                            placeholder="Description" 
                            className="premium-input bg-zinc-950/50 h-24 resize-none" 
                        />
                    </div>
                </div>
                
                <div className="mt-auto">
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 mb-4">
                    <h4 className="text-indigo-400 text-xs font-semibold mb-1 flex items-center gap-2">
                        <Search className="w-3 h-3" /> Auto Discovery
                    </h4>
                    <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">
                        Automatically scan your project directory to find package.json scripts and configurations.
                    </p>
                    <Button onClick={handleAutoAnalysis} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs">
                        Scan Directory
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col h-full bg-[#0c0c0e] min-h-0 relative">
                  <div className="flex justify-between items-center p-6 pb-2 shrink-0 bg-[#0c0c0e] z-10">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tasks</label>
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono">{formTasks.length}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setFormTasks([...formTasks, {
                        name: 'New Task', command: '', workingDirectory: '', executionMode: 'internal', icon: 'Terminal',
                        healthCheck: { enabled: false, url: '', interval: 30000, timeout: 5000, retries: 3, autoRestart: true }
                    }])} className="h-7 text-xs border-white/10 hover:bg-white/5 hover:text-white transition-colors">
                        <Plus className="w-3 h-3 mr-1" /> Add Task
                    </Button>
                  </div>
                  
                  <ScrollArea className="flex-1 w-full">
                    <div className="p-6 pt-2 space-y-3">
                        {formTasks.map((task, idx) => (
                            <div key={idx} className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 space-y-3 relative group hover:border-white/10 hover:bg-zinc-900/60 transition-all">
                                <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all" onClick={() => setFormTasks(formTasks.filter((_, i) => i !== idx))}>
                                <X className="w-3.5 h-3.5" />
                                </Button>
                                
                                <div className="flex gap-3 items-start">
                                    <div className="mt-6">
                                        <IconPicker selectedIcon={task.icon || 'Terminal'} onSelect={(icon) => {
                                            const n = [...formTasks]; n[idx].icon = icon; setFormTasks(n);
                                        }} />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-[1fr_140px] gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-zinc-500 ml-1">Task Name</label>
                                                <Input value={task.name} onChange={e => { const n = [...formTasks]; n[idx].name = e.target.value; setFormTasks(n) }} className="premium-input h-9 bg-black/20" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-zinc-500 ml-1">Mode</label>
                                                <div className="relative">
                                                    <select value={task.executionMode} onChange={e => { const n = [...formTasks]; n[idx].executionMode = e.target.value as any; setFormTasks(n) }} className="w-full h-9 bg-black/20 border border-white/10 rounded-lg text-xs text-zinc-300 px-2 focus:outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors">
                                                        <option value="internal">Internal</option>
                                                        <option value="external">External</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-zinc-500 ml-1">Command</label>
                                                <Input value={task.command} onChange={e => { const n = [...formTasks]; n[idx].command = e.target.value; setFormTasks(n) }} className="premium-input h-9 font-mono text-xs text-emerald-400 bg-black/20" />
                                            </div>
                                            <div className="grid grid-cols-[100px_1fr] gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-zinc-500 ml-1">Port</label>
                                                    <Input type="number" placeholder="3000" value={task.port || ''} onChange={e => { const n = [...formTasks]; n[idx].port = parseInt(e.target.value) || undefined; setFormTasks(n) }} className="premium-input h-9 text-xs bg-black/20" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-zinc-500 ml-1">Directory</label>
                                                    <div className="flex gap-2">
                                                        <Input value={task.workingDirectory} onChange={e => { const n = [...formTasks]; n[idx].workingDirectory = e.target.value; setFormTasks(n) }} className="premium-input h-9 text-xs flex-1 bg-black/20 text-zinc-400" />
                                                        <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 border-white/10 bg-transparent hover:bg-white/5 hover:text-white hover:border-white/20" onClick={async () => { if(ipcRenderer) { const path = await ipcRenderer.invoke('select-directory'); if(path) { const n = [...formTasks]; n[idx].workingDirectory = path; setFormTasks(n) } } }}><Folder className="w-4 h-4" /></Button>
                                                    </div>
                                                </div>
                                            </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                         <div className="h-4"></div>
                    </div>
                  </ScrollArea>
              </div>
          </div>

          <DialogFooter className="p-4 border-t border-white/5 bg-zinc-900/50 shrink-0 backdrop-blur-sm z-20">
              <Button variant="ghost" onClick={() => setModalOpen(false)} className="hover:bg-white/5">Cancel</Button>
              <Button onClick={handleSave} className="bg-white text-black hover:bg-zinc-200 px-8 font-medium shadow-lg shadow-white/5">
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!portConflict} onOpenChange={(o) => !o && setPortConflict(null)}>
         <DialogContent className="bg-zinc-950 border border-white/10 text-white">
            <DialogHeader>
                <DialogTitle>Port Occupied</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-sm text-zinc-400">
                The port <span className="text-white font-mono font-bold">{portConflict?.port}</span> is currently being used by process PID <span className="text-white font-mono font-bold">{portConflict?.pid}</span>.
                <br/><br/>
                Would you like to kill this process and start <strong>{portConflict?.taskName}</strong>?
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setPortConflict(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleResolveConflict}>Free & Start</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
      
      <CommandPalette 
        open={paletteOpen} 
        onOpenChange={setPaletteOpen}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={(p) => { setCurrentProject(p); setView('project'); setActiveTab('dashboard'); }}
        onNavigateHome={() => { setView('home'); setCurrentProject(null); }}
        onRunTask={(p, t) => handleToggleTask(t)}
        onStopTask={(p, t) => handleToggleTask(t)}
        runningProjects={runningProjects}
        taskStates={taskStates}
      />
    </div>
  )
}

export default App