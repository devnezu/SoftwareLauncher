const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const PerformanceMonitor = require('./performanceMonitor');
const HealthCheckMonitor = require('./healthCheckMonitor');
const ProjectAnalyzer = require('./projectAnalyzer');
const os = require('os');

let mainWindow;
let tray;
let isQuitting = false;
let performanceMonitor;
let healthCheckMonitor;
const projectAnalyzer = new ProjectAnalyzer();

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'projects.json');
const sessionPath = path.join(userDataPath, 'session.json');

const runningProcesses = new Map(); 
const runningProjects = new Map();

async function checkPort(port) {
  if (!port) return null;
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          // Standard format: Proto Local Address Foreign Address State PID
          // TCP 0.0.0.0:3000 ...
          const localAddress = parts[1];
          if (localAddress && localAddress.endsWith(`:${port}`)) {
             const pid = parts[parts.length - 1];
             return parseInt(pid);
          }
        }
      }
    } else {
      const { stdout } = await execAsync(`lsof -i :${port} -t`);
      if (stdout.trim()) return parseInt(stdout.trim().split('\n')[0]);
    }
  } catch (e) { return null; }
  return null;
}

async function killProcessByPid(pid) {
  try {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /pid ${pid} /f /t`);
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch (e) { return false; }
}

async function saveSession() {
  try {
    const session = {
      lastActiveProjectId: null,
      runningProjectIds: Array.from(runningProjects.keys())
    };
    await fs.writeFile(sessionPath, JSON.stringify(session));
  } catch (e) { console.error(e); }
}

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
        saveSession();
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

function createTray() {
  const iconPath = path.join(__dirname, '../assets', 'icon.png'); 
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('Software Launcher');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => mainWindow.show());
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  Menu.setApplicationMenu(null);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  performanceMonitor = new PerformanceMonitor(mainWindow);
  healthCheckMonitor = new HealthCheckMonitor(mainWindow);

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('before-quit', async (e) => {
  if (runningProcesses.size > 0 && !isQuitting) {
    e.preventDefault();
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Kill All & Exit', 'Detach (Keep Running)', 'Cancel'],
      title: 'Active Processes',
      message: 'There are active processes running. How do you want to exit?',
      defaultId: 0,
      cancelId: 2
    });

    if (response === 0) { // Kill All
      for (const [projectId, procs] of runningProcesses) {
        procs.forEach(proc => {
          if (!proc.killed) {
             try {
                if (process.platform === 'win32') spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
                else proc.kill('SIGKILL');
             } catch(err) {}
          }
        });
      }
      isQuitting = true;
      app.quit();
    } else if (response === 1) { // Detach
      isQuitting = true;
      app.quit();
    } else { // Cancel
      // Do nothing, preventing quit
    }
  } else {
    isQuitting = true;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle('window-close', () => mainWindow.hide()); 

ipcMain.handle('app-reload', () => mainWindow.reload());
ipcMain.handle('app-inspect', (event, x, y) => mainWindow.webContents.inspectElement(x, y));

ipcMain.handle('load-projects', async () => {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) { return []; }
});

ipcMain.handle('check-running-session', async () => {
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

    if (task.port) {
      const busyPid = await checkPort(task.port);
      if (busyPid) {
        return { success: false, error: 'PORT_IN_USE', port: task.port, pid: busyPid };
      }
    }

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

ipcMain.handle('kill-process-by-pid', async (event, pid) => {
  return await killProcessByPid(pid);
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

// IPC Handlers removed: get-performance-history, get-health-status, get-health-history, get-available-periods, load-performance-history

// --- Project Context Composer & IDE Utils ---

async function scanDirectoryRecursively(dir, ignore = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  const defaultIgnore = ['.git', 'node_modules', 'dist', 'build', '.next', '.vscode', 'coverage', 'tmp', 'temp'];
  const allIgnore = [...defaultIgnore, ...ignore];

  for (const entry of entries) {
    if (allIgnore.includes(entry.name)) continue;
    
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await scanDirectoryRecursively(fullPath, ignore);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

ipcMain.handle('scan-directory', async (event, dirPath) => {
  try {
    const files = await scanDirectoryRecursively(dirPath);
    // Return relative paths for cleaner UI, or full paths? 
    // Let's return full paths but the UI can handle display.
    // Actually, tree structure is better handled by flattening here and rebuilding or just sending flat list.
    // Flat list of full paths is easier to process for the 'read' step.
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-files-content', async (event, filePaths) => {
  try {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > 1024 * 1024) { // Skip files > 1MB
           results.push({ path: filePath, content: '<Skipped: File too large>', size: stats.size });
           continue;
        }
        const content = await fs.readFile(filePath, 'utf-8');
        results.push({ path: filePath, content, size: content.length });
      } catch (err) {
        results.push({ path: filePath, content: `<Error reading file: ${err.message}>`, size: 0 });
      }
    }
    return { success: true, files: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-in-ide', async (event, dirPath) => {
  try {
    // Try VS Code first
    await execAsync(`code "${dirPath}"`);
    return { success: true };
  } catch (e) {
    try {
        // Fallback to system explorer
        if (process.platform === 'win32') await execAsync(`start "" "${dirPath}"`);
        else if (process.platform === 'darwin') await execAsync(`open "${dirPath}"`);
        else await execAsync(`xdg-open "${dirPath}"`);
        return { success: true, note: 'Opened in Explorer (VS Code not found)' };
    } catch (err) {
        return { success: false, error: err.message };
    }
  }
});

ipcMain.handle('open-file-at-line', async (event, filePath, line) => {
  try {
    // "code -g file:line" opens VS Code at specific line
    const command = `code -g "${filePath}:${line}"`;
    await execAsync(command);
    return { success: true };
  } catch (error) {
    // If VS Code fails, just try opening the file with default app (won't go to line)
    try {
        if (process.platform === 'win32') await execAsync(`start "" "${filePath}"`);
        else if (process.platform === 'darwin') await execAsync(`open "${filePath}"`);
        else await execAsync(`xdg-open "${filePath}"`);
        return { success: true, warning: 'Opened file but could not jump to line (VS Code CLI not found)' };
    } catch (e) {
        return { success: false, error: error.message };
    }
  }
});