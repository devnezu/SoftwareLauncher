import { useState, useEffect, useRef } from 'react'
import { Play, Square, Settings, Trash2, Folder, FileText, Code2, Copy, Check, Plus } from 'lucide-react'
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
import { useTranslation } from './i18n/LanguageContext'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

function App() {
  const { t } = useTranslation()
  const [view, setView] = useState('home') // 'home' or 'project'
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [runningProjects, setRunningProjects] = useState(new Set())
  const [consoleOutput, setConsoleOutput] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [envModalOpen, setEnvModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [editingTaskIndex, setEditingTaskIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentEnvironment, setCurrentEnvironment] = useState('development')
  const [copied, setCopied] = useState(false)

  const processedOutputsRef = useRef(new Set())

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formTasks, setFormTasks] = useState([])

  const [envVariables, setEnvVariables] = useState({})

  useEffect(() => {
    loadProjects()

    if (ipcRenderer) {
      const handleProcessOutput = (event, data) => {
        const outputId = `${data.projectId}-${data.taskName}-${data.type}-${data.data}-${Date.now()}`
        if (!processedOutputsRef.current.has(outputId)) {
          processedOutputsRef.current.add(outputId)
          addConsoleOutput(data.type, data.data, data.taskName)

          // Limpar outputs antigos do Set para não crescer indefinidamente
          if (processedOutputsRef.current.size > 1000) {
            const items = Array.from(processedOutputsRef.current)
            processedOutputsRef.current = new Set(items.slice(-500))
          }
        }
      }

      const handleProcessClosed = (event, data) => {
        addConsoleOutput('system', `${t('project.processExited')} "${data.taskName}" ${data.code}`, '')
      }

      ipcRenderer.on('process-output', handleProcessOutput)
      ipcRenderer.on('process-closed', handleProcessClosed)

      return () => {
        ipcRenderer.removeListener('process-output', handleProcessOutput)
        ipcRenderer.removeListener('process-closed', handleProcessClosed)
      }
    }
  }, [t])

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
      alert(t('form.selectEnvFirst'))
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
      alert(`${t('form.errorParsingEnv')}: ${result.error}`)
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
      envVariables: {}
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

  function saveProject() {
    if (!formName.trim()) {
      alert(t('form.enterProjectName'))
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
    if (!confirm(`${t('project.deleteConfirm')} "${currentProject.name}"?`)) return

    if (runningProjects.has(currentProject.id)) {
      stopProject()
    }

    const newProjects = projects.filter(p => p.id !== currentProject.id)
    setProjects(newProjects)
    saveProjects(newProjects)
    setCurrentProject(null)
  }

  async function launchProject() {
    if (!currentProject || !ipcRenderer) return

    setConsoleOutput([])
    addConsoleOutput('system', `${t('project.startingIn')} ${currentEnvironment.toUpperCase()}...`, '')

    const result = await ipcRenderer.invoke('launch-project', currentProject, currentEnvironment)

    if (result.success) {
      setRunningProjects(new Set([...runningProjects, currentProject.id]))
      addConsoleOutput('system', t('project.startedSuccessfully'), '')
    } else {
      addConsoleOutput('error', `${t('project.failedToStart')}: ${result.error}`, '')
    }
  }

  async function stopProject() {
    if (!currentProject || !ipcRenderer) return

    const result = await ipcRenderer.invoke('stop-project', currentProject.id)

    if (result.success) {
      const newRunning = new Set(runningProjects)
      newRunning.delete(currentProject.id)
      setRunningProjects(newRunning)
      addConsoleOutput('system', t('project.stopped'), '')
    } else {
      addConsoleOutput('error', `${t('project.failedToStop')}: ${result.error}`, '')
    }
  }

  function addConsoleOutput(type, data, taskName) {
    const timestamp = new Date().toLocaleTimeString()
    setConsoleOutput(prev => [...prev, { type, data, taskName, timestamp }])
  }

  function clearConsole() {
    setConsoleOutput([])
    processedOutputsRef.current.clear()
  }

  async function copyConsole() {
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
  }

  function goHome() {
    setView('home')
    setCurrentProject(null)
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
              <>
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
                      <Button variant="destructive" onClick={stopProject}>
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

                <div className="p-6 border-b border-border">
                  <h3 className="text-sm font-semibold mb-3">{t('project.tasks')}</h3>
                  {currentProject.tasks.length === 0 ? (
                    <div className="text-muted-foreground text-sm">{t('project.noTasks')}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentProject.tasks.map((task, index) => (
                        <div key={index} className="bg-card p-4 rounded-lg border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            {isRunning && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                            <h4 className="font-medium text-sm">{task.name}</h4>
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

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-6 py-3 border-b border-border flex justify-between items-center">
                    <h3 className="text-sm font-normal">{t('project.console')}</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyConsole}
                        disabled={consoleOutput.length === 0}
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
                  <ScrollArea className="flex-1">
                    <div className="p-4 font-mono text-xs space-y-1">
                      {consoleOutput.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">
                          {t('project.noOutput')}
                        </div>
                      ) : (
                        consoleOutput.map((line, index) => (
                          <div
                            key={index}
                            className={`${
                              line.type === 'stderr' ? 'text-destructive' :
                              line.type === 'system' ? 'text-primary' :
                              'text-foreground'
                            }`}
                          >
                            {line.taskName && (
                              <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] mr-2">
                                {line.taskName}
                              </span>
                            )}
                            <span className="text-muted-foreground">[{line.timestamp}]</span> {line.data}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
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

                    <Input
                      value={task.command}
                      onChange={(e) => updateTask(index, 'command', e.target.value)}
                      placeholder={t('form.commandPlaceholder')}
                    />

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
    </div>
  )
}

export default App
