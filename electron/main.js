const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const PerformanceMonitor = require('./performanceMonitor');
const HealthCheckMonitor = require('./healthCheckMonitor');
const ProjectAnalyzer = require('./projectAnalyzer');
const os = require('os');

let mainWindow;
let performanceMonitor;
let healthCheckMonitor;
const projectAnalyzer = new ProjectAnalyzer();

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'projects.json');
const sessionPath = path.join(userDataPath, 'session.json'); // Novo arquivo para estado da sessão

const runningProcesses = new Map(); 
const runningProjects = new Map();

// --- Persistência de Sessão ---
async function saveSession() {
  try {
    const session = {
      lastActiveProjectId: null,
      runningProjectIds: Array.from(runningProjects.keys())
    };
    // Tenta pegar o projeto focado se possível, mas aqui salvamos apenas o que está rodando
    await fs.writeFile(sessionPath, JSON.stringify(session));
  } catch (e) { console.error('Failed to save session', e); }
}

// --- Funções de Processo (Mantinadas) ---
function runExternalTerminal(command, cwd) {
  const platform = os.platform();
  if (platform === 'win32') {
    return spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `title SoftwareLauncher & cd /d "${cwd}" & ${command}`], { shell: true });
  } else if (platform === 'darwin') {
    const script = `tell application "Terminal" to do script "cd '${cwd}' && ${command}"`;
    return spawn('osascript', ['-e', script]);
  } else if (platform === 'linux') {
    return spawn('x-terminal-emulator', ['-e', `bash -c "cd '${cwd}'; ${command}; exec bash"`]);
  }
}

function spawnProjectTask(project, task, environment = 'development') {
  const mode = task.executionMode || 'internal';

  if (mode === 'external') {
    const extProc = runExternalTerminal(task.command, task.workingDirectory);
    if (extProc) extProc.taskName = task.name;
    return extProc;
  } else {
    const childProcess = spawn(task.command, {
      cwd: task.workingDirectory,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
      detached: false
    });

    childProcess.taskName = task.name;

    childProcess.stdout.on('data', (data) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('process-output', {
        projectId: project.id, taskName: task.name, type: 'stdout', data: data.toString()
      });
    });

    childProcess.stderr.on('data', (data) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('process-output', {
        projectId: project.id, taskName: task.name, type: 'stderr', data: data.toString()
      });
    });

    childProcess.on('close', (code) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('process-closed', {
        projectId: project.id, taskName: task.name, code
      });
      
      const currentProcs = runningProcesses.get(project.id) || [];
      const updatedProcs = currentProcs.filter(p => p !== childProcess);
      
      if (updatedProcs.length === 0) {
        runningProcesses.delete(project.id);
        runningProjects.delete(project.id);
        if (performanceMonitor) performanceMonitor.stopMonitoring(project.id);
        saveSession(); // Salva estado atualizado
      } else {
        runningProcesses.set(project.id, updatedProcs);
      }
    });

    return childProcess;
  }
}

async function stopTaskInternal(projectId, taskName) {
  const processes = runningProcesses.get(projectId);
  if (!processes) return;

  const taskProcIndex = processes.findIndex(p => p.taskName === taskName);
  if (taskProcIndex > -1) {
    const proc = processes[taskProcIndex];
    
    if (proc && !proc.killed) {
       if (process.platform === 'win32') spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
       else proc.kill('SIGKILL');
    }

    processes.splice(taskProcIndex, 1);
    
    if (processes.length === 0) {
      runningProcesses.delete(projectId);
      runningProjects.delete(projectId);
      if (performanceMonitor) performanceMonitor.stopMonitoring(projectId);
      saveSession();
    } else {
      runningProcesses.set(projectId, processes);
    }

    if (healthCheckMonitor) healthCheckMonitor.stopHealthCheck(projectId, taskName);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    show: false,
    icon: path.join(__dirname, '../assets', 'icon.png')
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  Menu.setApplicationMenu(null);

  performanceMonitor = new PerformanceMonitor(mainWindow);
  healthCheckMonitor = new HealthCheckMonitor(mainWindow);

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

// Ao fechar todas as janelas, matar processos
app.on('window-all-closed', () => {
  runningProcesses.forEach((processes) => {
    processes.forEach(proc => {
      if (proc && !proc.killed && typeof proc.kill === 'function') {
        try { process.kill(proc.pid); } catch(e) {}
      }
    });
  });
  // Limpar sessão de running pois matamos tudo
  fs.writeFile(sessionPath, JSON.stringify({ runningProjectIds: [] })).catch(() => {});
  
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle('window-close', () => mainWindow.close());

ipcMain.handle('app-reload', () => mainWindow.reload());
ipcMain.handle('app-inspect', (event, x, y) => mainWindow.webContents.inspectElement(x, y));

ipcMain.handle('load-projects', async () => {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) { return []; }
});

// Novo Handler: Verificar estado inicial
ipcMain.handle('check-running-session', async () => {
    // Como matamos os processos no fechamento, ao abrir, a lista "runningProcesses" em memória está vazia.
    // Este handler serve mais para o Frontend saber se deveria "restaurar" visualmente algo,
    // mas funcionalmente começamos do zero.
    // Se implementássemos processos detached, aqui reconectaríamos.
    return { runningProjectIds: [] };
});

ipcMain.handle('save-projects', async (event, projects) => {
  try {
    await fs.writeFile(configPath, JSON.stringify(projects, null, 2));
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return !result.canceled ? result.filePaths[0] : null;
});

ipcMain.handle('launch-project', async (event, project, environment) => {
  try {
    const projectProcesses = [];
    
    for (const task of project.tasks) {
      const proc = spawnProjectTask(project, task, environment);
      if (proc) projectProcesses.push(proc);
    }

    runningProcesses.set(project.id, projectProcesses);
    runningProjects.set(project.id, { project, environment });
    saveSession();

    if (projectProcesses.length > 0) {
        if (performanceMonitor) performanceMonitor.startMonitoring(project.id, projectProcesses, project.name);
        
        if (healthCheckMonitor) {
            setTimeout(() => {
                project.tasks.forEach((task) => {
                    if (task.healthCheck?.enabled) {
                        const processRef = projectProcesses.find(p => p.taskName === task.name);
                        healthCheckMonitor.startHealthCheck(project.id, project.name, task, processRef);
                    }
                });
            }, 3000);
        }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-project', async (event, projectId) => {
  try {
    const processes = runningProcesses.get(projectId);
    if (processes) {
      processes.forEach(proc => {
        if (proc && !proc.killed) {
            if (process.platform === 'win32') spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
            else proc.kill('SIGKILL');
        }
      });
      runningProcesses.delete(projectId);
    }

    if (performanceMonitor) performanceMonitor.stopMonitoring(projectId);
    if (healthCheckMonitor) healthCheckMonitor.stopProjectHealthChecks(projectId);
    runningProjects.delete(projectId);
    saveSession();

    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('start-task', async (event, project, taskName) => {
  try {
    const task = project.tasks.find(t => t.name === taskName);
    if (!task) return { success: false, error: 'Task not found' };

    const proc = spawnProjectTask(project, task);
    if (!proc) return { success: false, error: 'Failed to spawn' };

    const currentProcs = runningProcesses.get(project.id) || [];
    currentProcs.push(proc);
    runningProcesses.set(project.id, currentProcs);

    if (!runningProjects.has(project.id)) {
      runningProjects.set(project.id, { project, environment: 'development' });
    }
    saveSession();

    if (performanceMonitor) performanceMonitor.startMonitoring(project.id, currentProcs, project.name);
    
    if (healthCheckMonitor && task.healthCheck?.enabled) {
       healthCheckMonitor.startHealthCheck(project.id, project.name, task, proc);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-task', async (event, projectId, taskName) => {
  try {
    await stopTaskInternal(projectId, taskName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restart-task', async (event, project, taskName) => {
  try {
    await stopTaskInternal(project.id, taskName);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    const task = project.tasks.find(t => t.name === taskName);
    if (!task) return { success: false, error: 'Task not found' };

    const proc = spawnProjectTask(project, task);
    if (!proc) return { success: false, error: 'Failed to respawn' };

    const currentProcs = runningProcesses.get(project.id) || [];
    currentProcs.push(proc);
    runningProcesses.set(project.id, currentProcs);

    if (!runningProjects.has(project.id)) {
      runningProjects.set(project.id, { project, environment: 'development' });
    }
    saveSession();

    if (performanceMonitor) performanceMonitor.startMonitoring(project.id, currentProcs, project.name);
    if (healthCheckMonitor && task.healthCheck?.enabled) {
       healthCheckMonitor.startHealthCheck(project.id, project.name, task, proc);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('analyze-project-with-ai', async (event, projectPath) => {
  return await projectAnalyzer.analyze(projectPath);
});

ipcMain.handle('set-gemini-api-key', async () => ({ success: true }));
ipcMain.handle('get-performance-history', async (e, id) => performanceMonitor?.getHistory(id) || []);
ipcMain.handle('get-health-status', async (e, id) => healthCheckMonitor?.getProjectStatus(id) || []);