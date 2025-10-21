import { useState, useEffect } from 'react'
import { Play, Square, Plus, Settings, Trash2, Folder } from 'lucide-react'
import { Button } from './components/ui/button'
import {  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { ScrollArea } from './components/ui/scroll-area'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

// Modo debug - quando true, carrega projetos mock
const DEBUG_MODE = import.meta.env.DEV

function App() {
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [runningProjects, setRunningProjects] = useState(new Set())
  const [consoleOutput, setConsoleOutput] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formTasks, setFormTasks] = useState([])
  const [formEnvVars, setFormEnvVars] = useState([])

  // Load projects on mount
  useEffect(() => {
    loadProjects()

    // Listen for process output
    if (ipcRenderer) {
      ipcRenderer.on('process-output', (event, data) => {
        addConsoleOutput(data.type, data.data, data.taskName)
      })

      ipcRenderer.on('process-closed', (event, data) => {
        addConsoleOutput('system', `Process "${data.taskName}" exited with code ${data.code}`, '')
      })
    }
  }, [])

  async function loadProjects() {
    if (!ipcRenderer) return

    let loadedProjects = []

    if (DEBUG_MODE) {
      // Carrega projetos mock em modo debug
      loadedProjects = await ipcRenderer.invoke('load-mock-projects')
    } else {
      loadedProjects = await ipcRenderer.invoke('load-projects')
    }

    setProjects(loadedProjects)
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
    setFormEnvVars([])
    setModalOpen(true)
  }

  function openEditProjectModal(project) {
    setEditingProject(project)
    setFormName(project.name)
    setFormDescription(project.description || '')
    setFormTasks(project.tasks || [])
    setFormEnvVars(Object.entries(project.environmentVariables || {}).map(([key, value]) => ({ key, value })))
    setModalOpen(true)
  }

  function addTask() {
    setFormTasks([...formTasks, { name: '', command: '', workingDirectory: '', environmentVariables: {} }])
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

  function addEnvVar() {
    setFormEnvVars([...formEnvVars, { key: '', value: '' }])
  }

  function removeEnvVar(index) {
    setFormEnvVars(formEnvVars.filter((_, i) => i !== index))
  }

  function updateEnvVar(index, field, value) {
    const newEnvVars = [...formEnvVars]
    newEnvVars[index][field] = value
    setFormEnvVars(newEnvVars)
  }

  function saveProject() {
    if (!formName.trim()) {
      alert('Please enter a project name')
      return
    }

    const envVarsObject = {}
    formEnvVars.forEach(({ key, value }) => {
      if (key.trim()) {
        envVarsObject[key.trim()] = value
      }
    })

    const project = {
      id: editingProject?.id || `proj-${Date.now()}`,
      name: formName.trim(),
      description: formDescription.trim(),
      tasks: formTasks.filter(t => t.name && t.command && t.workingDirectory),
      environmentVariables: envVarsObject
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
    if (!confirm(`Are you sure you want to delete "${currentProject.name}"?`)) return

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
    addConsoleOutput('system', 'Starting project...', '')

    const result = await ipcRenderer.invoke('launch-project', currentProject)

    if (result.success) {
      setRunningProjects(new Set([...runningProjects, currentProject.id]))
      addConsoleOutput('system', 'Project started successfully!', '')
    } else {
      addConsoleOutput('error', `Failed to start project: ${result.error}`, '')
    }
  }

  async function stopProject() {
    if (!currentProject || !ipcRenderer) return

    const result = await ipcRenderer.invoke('stop-project', currentProject.id)

    if (result.success) {
      const newRunning = new Set(runningProjects)
      newRunning.delete(currentProject.id)
      setRunningProjects(newRunning)
      addConsoleOutput('system', 'Project stopped.', '')
    } else {
      addConsoleOutput('error', `Failed to stop project: ${result.error}`, '')
    }
  }

  function addConsoleOutput(type, data, taskName) {
    const timestamp = new Date().toLocaleTimeString()
    setConsoleOutput(prev => [...prev, { type, data, taskName, timestamp }])
  }

  function clearConsole() {
    setConsoleOutput([])
  }

  const isRunning = currentProject && runningProjects.has(currentProject.id)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-80 border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-semibold mb-4">Software Launcher</h1>
          {DEBUG_MODE && (
            <div className="mb-4 px-3 py-2 bg-primary/10 text-primary text-xs rounded-md border border-primary/20">
              Debug Mode Active
            </div>
          )}
          <Button onClick={openNewProjectModal} className="w-full">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3">
            {projects.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No projects yet
              </div>
            )}
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => setCurrentProject(project)}
                className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                  currentProject?.id === project.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                <div className="flex items-start gap-2">
                  {runningProjects.has(project.id) && (
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 animate-pulse" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{project.name}</h3>
                    <p className="text-xs opacity-70 truncate mt-0.5">
                      {project.description || 'No description'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {!currentProject ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Play className="w-24 h-24 mx-auto mb-4 opacity-20" />
              <h2 className="text-2xl font-semibold mb-2">Welcome to Software Launcher</h2>
              <p className="text-muted-foreground">Create a new project or select an existing one to get started</p>
            </div>
          </div>
        ) : (
          <>
            {/* Project Header */}
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-semibold">{currentProject.name}</h2>
                <p className="text-muted-foreground text-sm mt-1">{currentProject.description || 'No description'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditProjectModal(currentProject)}>
                  <Settings className="w-4 h-4" />
                </Button>
                <Button variant="destructive" size="sm" onClick={deleteProject}>
                  <Trash2 className="w-4 h-4" />
                </Button>
                {isRunning ? (
                  <Button variant="destructive" onClick={stopProject}>
                    <Square className="w-4 h-4" />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={launchProject}>
                    <Play className="w-4 h-4" />
                    Launch
                  </Button>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="p-6 border-b border-border">
              <h3 className="text-sm font-semibold mb-3">Tasks</h3>
              {currentProject.tasks.length === 0 ? (
                <div className="text-muted-foreground text-sm">No tasks configured</div>
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
                        <div className="truncate">{task.workingDirectory}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Console */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-6 py-3 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold">Console</h3>
                <Button variant="ghost" size="sm" onClick={clearConsole}>Clear</Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 font-mono text-xs space-y-1">
                  {consoleOutput.length === 0 ? (
                    <div className="text-muted-foreground text-center py-8">
                      No output yet. Launch the project to see logs.
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

      {/* Project Config Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'New Project'}</DialogTitle>
            <DialogDescription>
              Configure your project settings, tasks, and environment variables
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Full Stack App"
                className="mt-1.5"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Project description..."
                className="mt-1.5"
                rows={2}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium">Tasks</label>
                <Button size="sm" variant="outline" onClick={addTask}>
                  <Plus className="w-3 h-3" />
                  Add Task
                </Button>
              </div>

              <div className="space-y-3">
                {formTasks.map((task, index) => (
                  <div key={index} className="bg-card p-4 rounded-lg border border-border space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={task.name}
                        onChange={(e) => updateTask(index, 'name', e.target.value)}
                        placeholder="Task name (e.g., Frontend)"
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
                      placeholder="Command (e.g., npm run dev)"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={task.workingDirectory}
                        onChange={(e) => updateTask(index, 'workingDirectory', e.target.value)}
                        placeholder="Working directory"
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
                  </div>
                ))}
                {formTasks.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No tasks yet. Click "Add Task" to get started.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium">Environment Variables (Global)</label>
                <Button size="sm" variant="outline" onClick={addEnvVar}>
                  <Plus className="w-3 h-3" />
                  Add Variable
                </Button>
              </div>

              <div className="space-y-2">
                {formEnvVars.map((envVar, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={envVar.key}
                      onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                      placeholder="VARIABLE_NAME"
                      className="flex-1"
                    />
                    <Input
                      value={envVar.value}
                      onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                      placeholder="value"
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => removeEnvVar(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {formEnvVars.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-2">
                    No environment variables configured
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveProject}>Save Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
