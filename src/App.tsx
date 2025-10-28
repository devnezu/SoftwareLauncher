import { useState, useEffect, useRef } from 'react'
import { Play, Square, Settings, Trash2, Folder, FileText, Code2, Copy, Check, Plus, Terminal, ChevronDown, ChevronUp, AlertTriangle, Link, Search, CheckCircle, Timer, ListOrdered, Eye, Monitor, HeartPulse, RotateCw } from 'lucide-react'
import { Button } from './components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { ScrollArea } from './components/ui/scroll-area'
import { TitleBar } from './components/TitleBar'
import { Breadcrumb } from './components/Breadcrumb'
import { Loading } from './components/Loading'
import { Home } from './components/Home'
import { Sidebar } from './components/Sidebar'
import { ConfirmDialog } from './components/ConfirmDialog'
import { AlertDialog } from './components/AlertDialog'
import { PerformancePanel } from './components/PerformancePanel'
import { HealthCheckPanel } from './components/HealthCheckPanel'
import { AnsiText } from './components/AnsiText'
import { useTranslation } from './i18n/LanguageContext'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

function App() {
  const { t } = useTranslation()
  const [view, setView] = useState('home') // 'home' or 'project'
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [runningProjects, setRunningProjects] = useState(new Set())
  const [projectConsoles, setProjectConsoles] = useState({}) // Logs separadas por projeto
  const [modalOpen, setModalOpen] = useState(false)
  const [envModalOpen, setEnvModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [editingTaskIndex, setEditingTaskIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentEnvironment, setCurrentEnvironment] = useState('development')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [alertDialog, setAlertDialog] = useState({ open: false, title: '', description: '' })
  const [activeConsoleTab, setActiveConsoleTab] = useState('all') // 'all' ou taskName

  // Estados para detecção de porta
  const [portConflictDialogOpen, setPortConflictDialogOpen] = useState(false)
  const [portConflicts, setPortConflicts] = useState([])
  const [pendingLaunchProject, setPendingLaunchProject] = useState(null)

  // Estados de collapsed (recolher/expandir seções)
  const [tasksCollapsed, setTasksCollapsed] = useState(() => {
    const saved = localStorage.getItem('tasksCollapsed')
    return saved ? JSON.parse(saved) : false
  })

  const processedOutputsRef = useRef(new Set())

  // Persistir estados collapsed
  useEffect(() => {
    localStorage.setItem('tasksCollapsed', JSON.stringify(tasksCollapsed))
  }, [tasksCollapsed])

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formTasks, setFormTasks] = useState([])

  const [envVariables, setEnvVariables] = useState({})
  const [capturedUrls, setCapturedUrls] = useState({})

  useEffect(() => {
    loadProjects()

    if (ipcRenderer) {
      const handleProcessOutput = (event, data) => {
        const outputId = `${data.projectId}-${data.taskName}-${data.type}-${data.data}-${Date.now()}`
        if (!processedOutputsRef.current.has(outputId)) {
          processedOutputsRef.current.add(outputId)
          addConsoleOutput(data.projectId, data.type, data.data, data.taskName)

          // Limpar outputs antigos do Set para não crescer indefinidamente
          if (processedOutputsRef.current.size > 1000) {
            const items = Array.from(processedOutputsRef.current)
            processedOutputsRef.current = new Set(items.slice(-500))
          }
        }
      }

      const handleProcessClosed = (event, data) => {
        addConsoleOutput(data.projectId, 'system', `${t('project.processExited')} "${data.taskName}" ${data.code}`, '')
      }

      const handleUrlCaptured = (event, data) => {
        setCapturedUrls(prev => ({
          ...prev,
          [data.service]: data.url
        }))
        addConsoleOutput(data.monitorId, 'system', `[${data.service.toUpperCase()}] URL capturada: ${data.url}`, data.monitorId)
      }

      const handleHealthCheckRestart = async (event, data) => {
        // Health check detectou falha e solicitou restart
        addConsoleOutput(data.projectId, 'system', `[Health Check] Auto-restart solicitado para ${data.taskName}`, '')

        // Chamar função de restart
        const result = await ipcRenderer.invoke('restart-task', data.projectId, data.taskName)
        if (result.success) {
          addConsoleOutput(data.projectId, 'system', `[Health Check] ${data.taskName} reiniciado com sucesso`, '')
        } else {
          addConsoleOutput(data.projectId, 'error', `[Health Check] Falha ao reiniciar ${data.taskName}: ${result.error}`, '')
        }
      }

      ipcRenderer.on('process-output', handleProcessOutput)
      ipcRenderer.on('process-closed', handleProcessClosed)
      ipcRenderer.on('url-captured', handleUrlCaptured)
      ipcRenderer.on('health-check-restart-required', handleHealthCheckRestart)

      return () => {
        ipcRenderer.removeListener('process-output', handleProcessOutput)
        ipcRenderer.removeListener('process-closed', handleProcessClosed)
        ipcRenderer.removeListener('url-captured', handleUrlCaptured)
        ipcRenderer.removeListener('health-check-restart-required', handleHealthCheckRestart)
      }
    }
  }, [t])

  function showAlert(title, description = '') {
    setAlertDialog({ open: true, title, description })
  }

  async function loadProjects() {
    if (!ipcRenderer) {
      setLoading(false)
      return
    }

    setLoading(true)
    const loadedProjects = await ipcRenderer.invoke('load-projects')
    setProjects(loadedProjects)
    setLoading(false)
  }

  async function saveProjects(newProjects) {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('save-projects', newProjects)
  }

  function openNewProjectModal() {
    setEditingProject(null)
    setFormName('')
    setFormDescription('')
    setFormTasks([])
    setModalOpen(true)
  }

  function openEditProjectModal(project) {
    setEditingProject(project)
    setFormName(project.name)
    setFormDescription(project.description || '')
    setFormTasks(project.tasks || [])
    setModalOpen(true)
  }

  async function openEnvConfigModal(taskIndex) {
    const task = formTasks[taskIndex]

    if (!task.envFilePath) {
      showAlert(t('form.selectEnvFirst'))
      return
    }

    const result = await ipcRenderer.invoke('parse-env-file', task.envFilePath)

    if (result.success) {
      const savedConfig = task.envVariables || {}

      const config = {}
      for (const key of Object.keys(result.variables)) {
        config[key] = savedConfig[key] || {
          development: result.variables[key],
          production: result.variables[key]
        }
      }

      setEnvVariables(config)
      setEditingTaskIndex(taskIndex)
      setEnvModalOpen(true)
    } else {
      showAlert(t('form.errorParsingEnv'), result.error)
    }
  }

  function saveEnvConfig() {
    const newTasks = [...formTasks]
    newTasks[editingTaskIndex].envVariables = envVariables
    setFormTasks(newTasks)
    setEnvModalOpen(false)
  }

  function updateEnvVariable(key, environment, value) {
    setEnvVariables(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [environment]: value
      }
    }))
  }

  function addTask() {
    setFormTasks([...formTasks, {
      name: '',
      command: '',
      workingDirectory: '',
      envFilePath: '',
      envVariables: {},
      environments: ['development', 'production'], // Executar em ambos por padrão
      executionMode: 'internal' // 'internal' ou 'external'
    }])
  }

  function removeTask(index) {
    setFormTasks(formTasks.filter((_, i) => i !== index))
  }

  function updateTask(index, field, value) {
    const newTasks = [...formTasks]
    newTasks[index][field] = value
    setFormTasks(newTasks)
  }

  async function selectDirectory(index) {
    if (!ipcRenderer) return
    const directory = await ipcRenderer.invoke('select-directory')
    if (directory) {
      updateTask(index, 'workingDirectory', directory)
    }
  }

  async function selectEnvFile(index) {
    if (!ipcRenderer) return
    const filePath = await ipcRenderer.invoke('select-env-file')
    if (filePath) {
      updateTask(index, 'envFilePath', filePath)
    }
  }

  async function autoDetectService(index) {
    if (!ipcRenderer) return

    const task = formTasks[index]
    if (!task.command) {
      showAlert(t('form.enterCommandFirst'))
      return
    }

    const result = await ipcRenderer.invoke('detect-service', task.command)

    if (result.available && result.config) {
      updateTask(index, 'monitoring', result.config)
      showAlert(`${result.service} detectado!`, 'Monitoramento configurado automaticamente.')
    } else if (result.warning) {
      showAlert(`${result.service || 'Serviço'} detectado`, result.warning)
    } else {
      showAlert(t('form.serviceNotDetected'))
    }
  }

  function updateTaskMonitoring(index, field, value) {
    const newTasks = [...formTasks]
    if (!newTasks[index].monitoring) {
      newTasks[index].monitoring = {}
    }
    newTasks[index].monitoring[field] = value
    setFormTasks(newTasks)
  }

  function saveProject() {
    if (!formName.trim()) {
      showAlert(t('form.enterProjectName'))
      return
    }

    const project = {
      id: editingProject?.id || `proj-${Date.now()}`,
      name: formName.trim(),
      description: formDescription.trim(),
      tasks: formTasks.filter(t => t.name && t.command && t.workingDirectory)
    }

    let newProjects
    if (editingProject) {
      newProjects = projects.map(p => p.id === editingProject.id ? project : p)
    } else {
      newProjects = [...projects, project]
    }

    setProjects(newProjects)
    saveProjects(newProjects)
    setModalOpen(false)

    if (currentProject?.id === project.id) {
      setCurrentProject(project)
    }
  }

  function deleteProject() {
    if (!currentProject) return
    setConfirmDelete(true)
  }

  function confirmDeleteProject() {
    if (!currentProject) return

    if (runningProjects.has(currentProject.id)) {
      stopProject()
    }

    const newProjects = projects.filter(p => p.id !== currentProject.id)
    setProjects(newProjects)
    saveProjects(newProjects)
    setCurrentProject(null)
    goHome()
  }

  async function launchProject() {
    if (!currentProject || !ipcRenderer) return

    setCapturedUrls({}) // Limpar URLs anteriores

    // Inicializar console do projeto se não existir
    if (!projectConsoles[currentProject.id]) {
      setProjectConsoles(prev => ({
        ...prev,
        [currentProject.id]: []
      }))
    }

    addConsoleOutput(currentProject.id, 'system', `${t('project.startingIn')} ${currentEnvironment.toUpperCase()}...`, '')

    // Filtrar tarefas baseado no ambiente
    const tasksToRun = currentProject.tasks.filter(task => {
      // Se a tarefa não tem o campo environments, executar em todos (retrocompatibilidade)
      if (!task.environments || task.environments.length === 0) {
        return true
      }
      // Verificar se o ambiente atual está na lista de ambientes da tarefa
      return task.environments.includes(currentEnvironment)
    })

    if (tasksToRun.length === 0) {
      addConsoleOutput(currentProject.id, 'system', t('project.noTasksForEnv') || 'Nenhuma tarefa configurada para este ambiente', '')
      return
    }

    const filteredProject = { ...currentProject, tasks: tasksToRun }

    // 🔍 DETECÇÃO DE PORTAS: Verificar se alguma porta está em uso
    const portCheckResult = await ipcRenderer.invoke('check-ports-in-use', filteredProject)

    if (portCheckResult.success && portCheckResult.portsInUse.length > 0) {
      // Mostrar dialog perguntando se usuário quer matar os processos
      setPortConflicts(portCheckResult.portsInUse)
      setPortConflictDialogOpen(true)
      // Armazenar o projeto para lançar depois se o usuário confirmar
      setPendingLaunchProject(filteredProject)
      return
    }

    // Se não há conflitos, lançar normalmente
    await executeLaunch(filteredProject)
  }

  // Função auxiliar para executar o launch (separada para reutilizar após matar processos)
  async function executeLaunch(filteredProject) {
    const result = await ipcRenderer.invoke('launch-project', filteredProject, currentEnvironment)

    if (result.success) {
      setRunningProjects(new Set([...runningProjects, currentProject.id]))
      addConsoleOutput(currentProject.id, 'system', t('project.startedSuccessfully'), '')
    } else {
      addConsoleOutput(currentProject.id, 'error', `${t('project.failedToStart')}: ${result.error}`, '')
    }
  }

  // Handler para matar processos e lançar projeto
  async function handleKillProcessesAndLaunch() {
    if (!pendingLaunchProject || !ipcRenderer) return

    addConsoleOutput(currentProject.id, 'system', t('port.killingProcesses') || 'Encerrando processos que estão usando as portas...', '')

    // Matar todos os processos que estão usando as portas
    for (const conflict of portConflicts) {
      const killResult = await ipcRenderer.invoke('kill-process-by-pid', conflict.pid)
      if (killResult.success) {
        addConsoleOutput(currentProject.id, 'system', `${t('port.processKilled') || 'Processo encerrado'} (PID ${conflict.pid}, porta ${conflict.port})`, '')
      } else {
        addConsoleOutput(currentProject.id, 'error', `${t('port.failedToKill') || 'Falha ao encerrar processo'} (PID ${conflict.pid})`, '')
      }
    }

    // Aguardar um pouco para garantir que as portas foram liberadas
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Fechar dialog
    setPortConflictDialogOpen(false)
    setPortConflicts([])
    setPendingLaunchProject(null)

    // Lançar o projeto
    await executeLaunch(pendingLaunchProject)
  }

  async function stopProject() {
    if (!currentProject || !ipcRenderer) return

    const result = await ipcRenderer.invoke('stop-project', currentProject.id)

    if (result.success) {
      const newRunning = new Set(runningProjects)
      newRunning.delete(currentProject.id)
      setRunningProjects(newRunning)
      setCapturedUrls({}) // Limpar URLs capturadas
      addConsoleOutput(currentProject.id, 'system', t('project.stopped'), '')
    } else {
      addConsoleOutput(currentProject.id, 'error', `${t('project.failedToStop')}: ${result.error}`, '')
    }
  }

  function addConsoleOutput(projectId, type, data, taskName) {
    const timestamp = new Date().toLocaleTimeString()
    setProjectConsoles(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), { type, data, taskName, timestamp }]
    }))
  }

  function clearConsole() {
    if (!currentProject) return
    setProjectConsoles(prev => ({
      ...prev,
      [currentProject.id]: []
    }))
  }

  async function copyConsole() {
    if (!currentProject) return
    const consoleOutput = projectConsoles[currentProject.id] || []
    const text = consoleOutput
      .map(line => `[${line.timestamp}]${line.taskName ? ` [${line.taskName}]` : ''} ${line.data}`)
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy console output:', err)
    }
  }

  function selectProject(project) {
    setCurrentProject(project)
    setView('project')
    setActiveConsoleTab('all') // Resetar para aba "Tudo" ao trocar de projeto
  }

  function goHome() {
    setView('home')
    setCurrentProject(null)
    setActiveConsoleTab('all')
  }

  function handleBreadcrumbNav(index) {
    if (index === 0) {
      goHome()
    }
  }

  const isRunning = currentProject && runningProjects.has(currentProject.id)

  const breadcrumbItems = view === 'home'
    ? ['Home']
    : ['Home', currentProject?.name || t('breadcrumb.projects')]

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TitleBar />

      {loading ? (
        <Loading message={t('loading.projects')} />
      ) : (
        <div className="flex flex-1 min-h-0">
          <Sidebar
            projects={projects}
            currentProject={currentProject}
            runningProjects={runningProjects}
            onSelectProject={selectProject}
            onNewProject={openNewProjectModal}
          />

          <main className="flex-1 flex flex-col">
            <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNav} />

            {view === 'home' ? (
              <Home
                projects={projects}
                runningProjects={runningProjects}
                onSelectProject={selectProject}
                onNewProject={openNewProjectModal}
              />
            ) : currentProject && (
              <ScrollArea className="flex-1">
              <div className="flex flex-col min-h-0">
                <div className="p-6 border-b border-border flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{currentProject.name}</h2>
                      <p className="text-muted-foreground text-sm mt-0.5">{currentProject.description || t('sidebar.noDescription')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1">
                      <button
                        onClick={() => setCurrentEnvironment('development')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          currentEnvironment === 'development'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t('project.environment.development')}
                      </button>
                      <button
                        onClick={() => setCurrentEnvironment('production')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          currentEnvironment === 'production'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t('project.environment.production')}
                      </button>
                    </div>

                    <Button variant="outline" size="sm" onClick={() => openEditProjectModal(currentProject)}>
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={deleteProject}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {isRunning ? (
                      <Button
                        variant="destructive"
                        onClick={stopProject}
                        disabled={currentProject.tasks.every(task => task.executionMode === 'external')}
                        title={currentProject.tasks.every(task => task.executionMode === 'external')
                          ? t('project.cannotStopExternalTerminal') || 'Não é possível parar processos em terminal externo'
                          : ''}
                      >
                        <Square className="w-4 h-4" />
                        {t('buttons.stop')}
                      </Button>
                    ) : (
                      <Button onClick={launchProject}>
                        <Play className="w-4 h-4" />
                        {t('buttons.launch')}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border-b border-border">
                  <div className="p-6 pb-3 flex justify-between items-center">
                    <h3 className="text-sm font-semibold">{t('project.tasks')}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTasksCollapsed(!tasksCollapsed)}
                      className="h-7 w-7 p-0"
                    >
                      {tasksCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                  </div>

                  {!tasksCollapsed && (
                    <div className="px-6 pb-6">
                      {currentProject.tasks.length === 0 ? (
                        <div className="text-muted-foreground text-sm">{t('project.noTasks')}</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentProject.tasks.map((task, index) => (
                        <div key={index} className="bg-card p-4 rounded-lg border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            {isRunning && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                            <h4 className="font-medium text-sm">{task.name}</h4>
                            {task.monitoring?.enabled && (
                              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {task.monitoring.type}
                              </span>
                            )}
                            {task.executionMode === 'external' && (
                              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                                <Terminal className="w-3 h-3" />
                                <span>Terminal</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="font-mono truncate">$ {task.command}</div>
                            <div className="truncate flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              {task.workingDirectory}
                            </div>
                            {task.envFilePath && (
                              <div className="truncate flex items-center gap-1 text-primary">
                                <FileText className="w-3 h-3" />
                                {task.envFilePath.split('/').pop() || task.envFilePath.split('\\').pop()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isRunning && Object.keys(capturedUrls).length > 0 && (
                  <div className="p-6 border-b border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Link className="w-4 h-4" />
                      <h3 className="text-sm font-semibold">URLs Capturadas</h3>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(capturedUrls).map(([service, url]) => (
                        <div key={service} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-emerald-400 mb-1 uppercase">
                                {service}
                              </div>
                              <div className="font-mono text-xs text-foreground truncate">
                                {url}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(url)
                                // Opcional: mostrar feedback visual
                              }}
                              className="text-emerald-400 hover:text-emerald-300 shrink-0"
                            >
                              {t('buttons.copy')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance Panel - só mostra se tiver tasks internas (com PIDs monitoráveis) */}
                {currentProject.tasks.some(task => (task.executionMode || 'internal') === 'internal') && (
                  <PerformancePanel
                    projectId={currentProject.id}
                    projectName={currentProject.name}
                    isRunning={isRunning}
                  />
                )}

                {/* Health Check Panel - só mostra se tiver health checks configurados */}
                <HealthCheckPanel
                  projectId={currentProject.id}
                  projectName={currentProject.name}
                  isRunning={isRunning}
                />

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-6 py-3 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-normal">{t('project.console')}</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyConsole}
                        disabled={(projectConsoles[currentProject.id] || []).length === 0}
                        className="gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4" strokeWidth={1.5} />
                            <span className="font-light">{t('buttons.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" strokeWidth={1.5} />
                            <span className="font-light">{t('buttons.copy')}</span>
                          </>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearConsole}>
                        <span className="font-light">{t('buttons.clear')}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Abas do Console - Separar logs por task */}
                  {currentProject.tasks.filter(t => (t.executionMode || 'internal') === 'internal').length > 0 && (
                    <div className="border-b border-border bg-card/30">
                      <div className="flex gap-1 px-4 py-2 overflow-x-auto">
                        {/* Aba "Tudo" */}
                        <button
                          onClick={() => setActiveConsoleTab('all')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                            activeConsoleTab === 'all'
                              ? 'bg-background text-foreground border border-b-0 border-border'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                          }`}
                        >
                          <ListOrdered className="w-3 h-3" />
                          {t('console.allTasks') || 'Tudo'}
                        </button>

                        {/* Aba por Task Interna */}
                        {currentProject.tasks
                          .filter(task => (task.executionMode || 'internal') === 'internal')
                          .map((task, index) => {
                            const taskLogs = (projectConsoles[currentProject.id] || []).filter(
                              log => log.taskName === task.name
                            )
                            const hasLogs = taskLogs.length > 0

                            return (
                              <button
                                key={index}
                                onClick={() => setActiveConsoleTab(task.name)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                                  activeConsoleTab === task.name
                                    ? 'bg-background text-foreground border border-b-0 border-border'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                              >
                                <span>{task.name}</span>
                                {hasLogs && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                )}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  <ScrollArea className="flex-1">
                    <div className="p-4 font-mono text-xs space-y-1 console-content">
                      {(() => {
                        const allLogs = projectConsoles[currentProject.id] || []
                        const filteredLogs = activeConsoleTab === 'all'
                          ? allLogs
                          : allLogs.filter(log => log.taskName === activeConsoleTab)

                        if (filteredLogs.length === 0) {
                          return (
                            <div className="text-muted-foreground text-center py-8">
                              {activeConsoleTab === 'all'
                                ? t('project.noOutput')
                                : `${t('console.noOutputForTask') || 'Nenhuma saída para'} ${activeConsoleTab}`}
                            </div>
                          )
                        }

                        return filteredLogs.map((line, index) => (
                          <div
                            key={index}
                            className={`${
                              line.type === 'stderr' ? 'text-destructive' :
                              line.type === 'system' ? 'text-primary' :
                              'text-foreground'
                            }`}
                          >
                            {activeConsoleTab === 'all' && line.taskName && (
                              <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] mr-2">
                                {line.taskName}
                              </span>
                            )}
                            <span className="text-muted-foreground">[{line.timestamp}]</span> <AnsiText>{line.data}</AnsiText>
                          </div>
                        ))
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              </ScrollArea>
            )}
          </main>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? t('modal.editProject') : t('modal.newProject')}</DialogTitle>
            <DialogDescription>
              {t('modal.projectSettings')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('form.projectName')}</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('form.projectNamePlaceholder')}
                className="mt-1.5"
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('form.description')}</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
                className="mt-1.5"
                rows={2}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium">{t('form.tasks')}</label>
                <Button size="sm" variant="outline" onClick={addTask}>
                  <Plus className="w-3 h-3" />
                  {t('buttons.addTask')}
                </Button>
              </div>

              <div className="space-y-3">
                {formTasks.map((task, index) => (
                  <div key={index} className="bg-card p-4 rounded-lg border border-border space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={task.name}
                        onChange={(e) => updateTask(index, 'name', e.target.value)}
                        placeholder={t('form.taskNamePlaceholder')}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeTask(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={task.command}
                        onChange={(e) => updateTask(index, 'command', e.target.value)}
                        placeholder={t('form.commandPlaceholder')}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => autoDetectService(index)}
                        title="Detectar serviço automaticamente (ngrok, cloudflared)"
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-light">
                        {t('form.environment')}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const envs = task.environments || []
                            updateTask(index, 'environments', ['development', 'production'])
                          }}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all ${
                            (task.environments || []).includes('development') && (task.environments || []).includes('production')
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          {t('form.environmentBoth')}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTask(index, 'environments', ['development'])}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all ${
                            (task.environments || []).includes('development') && !(task.environments || []).includes('production')
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          {t('form.environmentDev')}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTask(index, 'environments', ['production'])}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all ${
                            (task.environments || []).includes('production') && !(task.environments || []).includes('development')
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          {t('form.environmentProd')}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-light">
                        {t('form.executionMode') || 'Modo de Execução'}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateTask(index, 'executionMode', 'internal')}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                            (task.executionMode || 'internal') === 'internal'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          {t('form.executionModeInternal') || 'Console Interno'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTask(index, 'executionMode', 'external')}
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                            (task.executionMode || 'internal') === 'external'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          {t('form.executionModeExternal') || 'Terminal Externo'}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={task.workingDirectory}
                        onChange={(e) => updateTask(index, 'workingDirectory', e.target.value)}
                        placeholder={t('form.workingDirectoryPlaceholder')}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => selectDirectory(index)}
                      >
                        <Folder className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={task.envFilePath || ''}
                        onChange={(e) => updateTask(index, 'envFilePath', e.target.value)}
                        placeholder={t('form.envFilePlaceholder')}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => selectEnvFile(index)}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      {task.envFilePath && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEnvConfigModal(index)}
                          className="text-primary"
                        >
                          <Code2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {task.monitoring?.config && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg space-y-2 mt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={task.monitoring.enabled || false}
                            onChange={(e) => updateTaskMonitoring(index, 'enabled', e.target.checked)}
                            className="rounded accent-emerald-500"
                          />
                          <span className="text-sm font-medium text-emerald-400">
                            Monitorar <strong>{task.monitoring.type}</strong> e capturar URL
                          </span>
                        </label>
                        {task.monitoring.enabled && (
                          <div className="text-xs text-muted-foreground space-y-1 pl-6">
                            <div className="flex items-center gap-1.5">
                              <Link className="w-3 h-3" />
                              API: <code className="bg-black/20 px-1 rounded">{task.monitoring.apiUrl}</code>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3 h-3" />
                              Atualizar variável: <code className="bg-black/20 px-1 rounded">{task.monitoring.envVarToUpdate}</code>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Timer className="w-3 h-3" />
                              Timeout: {task.monitoring.timeout?.maxAttempts || 15}x de {(task.monitoring.timeout?.intervalMs || 2000) / 1000}s
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Health Check Configuration */}
                    {(task.executionMode || 'internal') === 'internal' && (
                      <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg space-y-3 mt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={task.healthCheck?.enabled || false}
                            onChange={(e) => {
                              const newTasks = [...formTasks]
                              if (!newTasks[index].healthCheck) {
                                newTasks[index].healthCheck = {
                                  enabled: e.target.checked,
                                  url: '',
                                  interval: 30000,
                                  timeout: 5000,
                                  retries: 3,
                                  autoRestart: true
                                }
                              } else {
                                newTasks[index].healthCheck.enabled = e.target.checked
                              }
                              setFormTasks(newTasks)
                            }}
                            className="rounded accent-blue-500"
                          />
                          <div className="flex items-center gap-1.5">
                            <HeartPulse className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-blue-400">
                              Health Check
                            </span>
                          </div>
                        </label>
                        {task.healthCheck?.enabled && (
                          <div className="space-y-2 pl-6">
                            <div>
                              <label className="text-xs text-muted-foreground">URL para verificar</label>
                              <Input
                                value={task.healthCheck.url || ''}
                                onChange={(e) => {
                                  const newTasks = [...formTasks]
                                  newTasks[index].healthCheck.url = e.target.value
                                  setFormTasks(newTasks)
                                }}
                                placeholder="http://localhost:3000/health"
                                className="mt-1 text-xs h-8"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Intervalo (ms)</label>
                                <Input
                                  type="number"
                                  value={task.healthCheck.interval || 30000}
                                  onChange={(e) => {
                                    const newTasks = [...formTasks]
                                    newTasks[index].healthCheck.interval = parseInt(e.target.value)
                                    setFormTasks(newTasks)
                                  }}
                                  className="mt-1 text-xs h-8"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Timeout (ms)</label>
                                <Input
                                  type="number"
                                  value={task.healthCheck.timeout || 5000}
                                  onChange={(e) => {
                                    const newTasks = [...formTasks]
                                    newTasks[index].healthCheck.timeout = parseInt(e.target.value)
                                    setFormTasks(newTasks)
                                  }}
                                  className="mt-1 text-xs h-8"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Tentativas</label>
                                <Input
                                  type="number"
                                  value={task.healthCheck.retries || 3}
                                  onChange={(e) => {
                                    const newTasks = [...formTasks]
                                    newTasks[index].healthCheck.retries = parseInt(e.target.value)
                                    setFormTasks(newTasks)
                                  }}
                                  className="mt-1 text-xs h-8"
                                />
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={task.healthCheck.autoRestart !== false}
                                    onChange={(e) => {
                                      const newTasks = [...formTasks]
                                      newTasks[index].healthCheck.autoRestart = e.target.checked
                                      setFormTasks(newTasks)
                                    }}
                                    className="rounded accent-blue-500"
                                  />
                                  <span className="text-xs text-blue-400">Auto-restart</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {formTasks.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    {t('form.noTasks')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('buttons.cancel')}</Button>
            <Button onClick={saveProject}>{t('buttons.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={envModalOpen} onOpenChange={setEnvModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('modal.configureEnv')}</DialogTitle>
            <DialogDescription>
              {t('modal.envSettings')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="grid grid-cols-[200px_1fr_1fr] gap-3 font-semibold text-sm pb-2 border-b">
              <div>{t('envConfig.variable')}</div>
              <div>{t('envConfig.development')}</div>
              <div>{t('envConfig.production')}</div>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {Object.entries(envVariables).map(([key, values]) => (
                  <div key={key} className="grid grid-cols-[200px_1fr_1fr] gap-3 items-center">
                    <div className="font-mono text-sm text-muted-foreground truncate">{key}</div>
                    <Input
                      value={values.development || ''}
                      onChange={(e) => updateEnvVariable(key, 'development', e.target.value)}
                      placeholder={t('envConfig.developmentValue')}
                      className="font-mono text-xs"
                    />
                    <Input
                      value={values.production || ''}
                      onChange={(e) => updateEnvVariable(key, 'production', e.target.value)}
                      placeholder={t('envConfig.productionValue')}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvModalOpen(false)}>{t('buttons.cancel')}</Button>
            <Button onClick={saveEnvConfig}>{t('buttons.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('project.deleteConfirm')}
        description={currentProject ? `"${currentProject.name}"` : ''}
        confirmText={t('buttons.delete')}
        cancelText={t('buttons.cancel')}
        onConfirm={confirmDeleteProject}
        variant="destructive"
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}
        title={alertDialog.title}
        description={alertDialog.description}
        buttonText="OK"
      />

      {/* Dialog de Conflito de Porta */}
      <Dialog open={portConflictDialogOpen} onOpenChange={setPortConflictDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              {t('port.conflictTitle') || 'Porta em uso'}
            </DialogTitle>
            <DialogDescription>
              {t('port.conflictDescription') || 'As seguintes portas já estão sendo usadas por outros processos:'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {portConflicts.map((conflict, index) => (
              <div key={index} className="bg-card p-3 rounded-lg border border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">
                      {t('port.port') || 'Porta'}: <span className="text-primary">{conflict.port}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('port.task') || 'Task'}: {conflict.taskName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      PID: {conflict.pid}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            {t('port.killWarning') || 'Deseja encerrar estes processos e continuar? Os processos serão forçadamente terminados.'}
          </DialogDescription>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPortConflictDialogOpen(false)
                setPortConflicts([])
                setPendingLaunchProject(null)
              }}
            >
              {t('buttons.cancel') || 'Cancelar'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleKillProcessesAndLaunch}
            >
              {t('port.killAndLaunch') || 'Encerrar e Lançar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
