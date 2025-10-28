const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const ServiceMonitor = require('./serviceMonitor');
const ServiceDetector = require('./serviceDetector');

let mainWindow;
let serviceMonitor;
const configPath = path.join(app.getPath('userData'), 'projects.json');

const runningProcesses = new Map();

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    backgroundColor: '#0a0a0a',
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../assets', 'icon.png')
  });

  Menu.setApplicationMenu(null);

  // Inicializar ServiceMonitor
  serviceMonitor = new ServiceMonitor(mainWindow);

  if (isDev) {
    // Usa a URL do servidor de desenvolvimento fornecida pelo vite-plugin-electron
    // ou fallback para localhost:5173 se não estiver definida
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    console.log('Loading development server from:', devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  runningProcesses.forEach((processes, projectId) => {
    processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill();
      }
    });
  });

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow.close();
});

ipcMain.handle('load-projects', async () => {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
});

ipcMain.handle('save-projects', async (event, projects) => {
  try {
    await fs.writeFile(configPath, JSON.stringify(projects, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

ipcMain.handle('select-env-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Environment Files', extensions: ['env'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

ipcMain.handle('parse-env-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const variables = {};

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        variables[key] = value;
      }
    }

    return { success: true, variables };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-env-file', async (event, filePath, variables) => {
  try {
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
    }

    const lines = content.split('\n');
    const newLines = [];
    const updatedKeys = new Set();

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();

        if (variables.hasOwnProperty(key)) {
          newLines.push(`${key}=${variables[key]}`);
          updatedKeys.add(key);
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }

    for (const [key, value] of Object.entries(variables)) {
      if (!updatedKeys.has(key)) {
        newLines.push(`${key}=${value}`);
      }
    }

    await fs.writeFile(filePath, newLines.join('\n'), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('launch-project', async (event, project, environment) => {
  try {
    const projectProcesses = [];

    for (const task of project.tasks) {
      if (task.envFilePath && task.envVariables) {
        const variablesToWrite = {};

        for (const [key, config] of Object.entries(task.envVariables)) {
          variablesToWrite[key] = config[environment] || config.development || '';
        }

        const result = await ipcMain.emit('write-env-file', {}, task.envFilePath, variablesToWrite);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    for (const task of project.tasks) {
      const executionMode = task.executionMode || 'internal';

      if (executionMode === 'external') {
        // Modo externo: abrir terminal separado
        launchInExternalTerminal(task, project.id);
      } else {
        // Modo interno: console integrado (comportamento atual)
        const env = {
          ...process.env
        };

        const childProcess = spawn(task.command, {
          cwd: task.workingDirectory,
          shell: true,
          env: env,
          detached: false
        });

        childProcess.stdout.on('data', (data) => {
          mainWindow.webContents.send('process-output', {
            projectId: project.id,
            taskName: task.name,
            type: 'stdout',
            data: data.toString()
          });
        });

        childProcess.stderr.on('data', (data) => {
          mainWindow.webContents.send('process-output', {
            projectId: project.id,
            taskName: task.name,
            type: 'stderr',
            data: data.toString()
          });
        });

        childProcess.on('close', (code) => {
          mainWindow.webContents.send('process-closed', {
            projectId: project.id,
            taskName: task.name,
            code: code
          });
        });

        projectProcesses.push(childProcess);
      }
    }

    runningProcesses.set(project.id, projectProcesses);

    // Iniciar monitoramento de serviços (ngrok, cloudflared, etc)
    // Pequeno delay para garantir que processos iniciaram
    setTimeout(() => {
      for (const task of project.tasks) {
        if (task.monitoring?.enabled) {
          serviceMonitor.startMonitoring(project.id, task, environment);
        }
      }
    }, 1000);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Função para abrir terminal externo baseado no sistema operacional
function launchInExternalTerminal(task, projectId) {
  const { command, workingDirectory, name } = task;

  mainWindow.webContents.send('process-output', {
    projectId: projectId,
    taskName: name,
    type: 'system',
    data: `🪟 Abrindo terminal externo para: ${name}`
  });

  if (process.platform === 'win32') {
    // Windows: usar cmd com /k para manter janela aberta
    const windowTitle = `SoftwareLauncher - ${name}`;
    const cmdCommand = `start "${windowTitle}" cmd /k "cd /d "${workingDirectory}" && ${command}"`;

    spawn(cmdCommand, {
      shell: true,
      detached: true,
      stdio: 'ignore'
    });
  } else if (process.platform === 'darwin') {
    // macOS: usar osascript para abrir Terminal.app
    const script = `
      tell application "Terminal"
        activate
        do script "cd '${workingDirectory}' && ${command}"
      end tell
    `;

    spawn('osascript', ['-e', script], {
      detached: true,
      stdio: 'ignore'
    });
  } else {
    // Linux: tentar vários emuladores de terminal
    const terminals = [
      { cmd: 'gnome-terminal', args: ['--', 'bash', '-c', `cd "${workingDirectory}" && ${command}; exec bash`] },
      { cmd: 'konsole', args: ['--workdir', workingDirectory, '-e', 'bash', '-c', `${command}; exec bash`] },
      { cmd: 'xfce4-terminal', args: ['--working-directory', workingDirectory, '-e', `bash -c "${command}; exec bash"`] },
      { cmd: 'xterm', args: ['-e', `cd "${workingDirectory}" && ${command}; exec bash`] }
    ];

    let launched = false;
    for (const terminal of terminals) {
      try {
        spawn(terminal.cmd, terminal.args, {
          detached: true,
          stdio: 'ignore'
        });
        launched = true;
        break;
      } catch (err) {
        // Tentar próximo terminal
        continue;
      }
    }

    if (!launched) {
      mainWindow.webContents.send('process-output', {
        projectId: projectId,
        taskName: name,
        type: 'stderr',
        data: '⚠️ Nenhum emulador de terminal encontrado. Instale gnome-terminal, konsole, xfce4-terminal ou xterm.'
      });
    }
  }
}

ipcMain.handle('stop-project', async (event, projectId) => {
  try {
    const processes = runningProcesses.get(projectId);

    if (processes) {
      processes.forEach(proc => {
        if (proc && !proc.killed) {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
          } else {
            proc.kill();
          }
        }
      });

      runningProcesses.delete(projectId);
    }

    // Parar monitores de serviços deste projeto
    if (serviceMonitor) {
      serviceMonitor.stopProjectMonitors(projectId);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para detectar serviços automaticamente (ngrok, cloudflared, etc)
ipcMain.handle('detect-service', async (event, command) => {
  try {
    const result = await ServiceDetector.detectMonitoring(command);
    return result;
  } catch (error) {
    return {
      available: false,
      service: null,
      config: null,
      error: error.message
    };
  }
});

// Handler para obter lista de serviços suportados
ipcMain.handle('get-supported-services', async () => {
  try {
    return ServiceDetector.getSupportedServices();
  } catch (error) {
    return [];
  }
});
