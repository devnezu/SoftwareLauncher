const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const ServiceMonitor = require('./serviceMonitor');
const ServiceDetector = require('./serviceDetector');
const PerformanceMonitor = require('./performanceMonitor');

let mainWindow;
let serviceMonitor;
let performanceMonitor;
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

  // Inicializar ServiceMonitor e PerformanceMonitor
  serviceMonitor = new ServiceMonitor(mainWindow);
  performanceMonitor = new PerformanceMonitor(mainWindow);

  if (isDev) {
    // Usa a URL do servidor de desenvolvimento fornecida pelo vite-plugin-electron
    // ou fallback para localhost:5173 se não estiver definida
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    console.log('Loading development server from:', devServerUrl);

    // 🔧 ABRIR DevTools automaticamente no modo dev
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 🖱️ MENU DE CONTEXTO (Botão Direito) com DevTools
  mainWindow.webContents.on('context-menu', (e, params) => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🔍 Inspecionar Elemento',
        click: () => {
          mainWindow.webContents.inspectElement(params.x, params.y);
        }
      },
      {
        label: '🛠️ Abrir DevTools',
        accelerator: 'F12',
        click: () => {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      },
      {
        label: '🔄 Recarregar',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          mainWindow.reload();
        }
      },
      { type: 'separator' },
      {
        label: '📋 Copiar',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy',
        enabled: params.selectionText.length > 0
      },
      {
        label: '📄 Colar',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
      },
      { type: 'separator' },
      {
        label: '❌ Fechar DevTools',
        click: () => {
          mainWindow.webContents.closeDevTools();
        }
      }
    ]);

    contextMenu.popup();
  });

  // ⌨️ ATALHOS DE TECLADO para DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 para abrir/fechar DevTools
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }

    // Ctrl+Shift+I (ou Cmd+Shift+I no Mac) para abrir/fechar DevTools
    if ((input.control || input.meta) && input.shift && input.key === 'I' && input.type === 'keyDown') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }

    // Ctrl+Shift+C (ou Cmd+Shift+C no Mac) para modo inspecionar
    if ((input.control || input.meta) && input.shift && input.key === 'C' && input.type === 'keyDown') {
      mainWindow.webContents.openDevTools({ mode: 'detach', activate: true });
      mainWindow.webContents.devToolsWebContents?.executeJavaScript('DevToolsAPI.enterInspectElementMode()');
    }
  });
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

    // Separar tasks por modo de execução
    const internalTasks = project.tasks.filter(task => (task.executionMode || 'internal') === 'internal');
    const externalTasks = project.tasks.filter(task => task.executionMode === 'external');

    // Iniciar tasks internas (console integrado)
    for (const task of internalTasks) {
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

    // Abrir tasks externas em UMA ÚNICA janela com múltiplas guias
    if (externalTasks.length > 0) {
      launchAllInExternalTerminal(externalTasks, project);
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

    // Iniciar monitoramento de performance (CPU/RAM) para processos internos
    if (projectProcesses.length > 0 && performanceMonitor) {
      setTimeout(() => {
        performanceMonitor.startMonitoring(project.id, projectProcesses, project.name);
      }, 2000);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Função para abrir TODAS as tasks externas em UMA ÚNICA janela com múltiplas guias/abas
function launchAllInExternalTerminal(tasks, project) {
  mainWindow.webContents.send('process-output', {
    projectId: project.id,
    taskName: project.name,
    type: 'system',
    data: `🪟 Abrindo ${tasks.length} guia(s) em terminal externo para: ${project.name}`
  });

  if (process.platform === 'win32') {
    // Windows: usar Windows Terminal (wt) com múltiplas abas
    // Igual ao código Python: wt ; new-tab ; new-tab

    // Começar comando com primeira tab
    const firstTask = tasks[0];
    let wtCommand = `wt -d "${firstTask.workingDirectory}" --title "${project.name} - ${firstTask.name}" cmd /k "${firstTask.command}"`;

    // Adicionar demais tasks como novas abas
    for (let i = 1; i < tasks.length; i++) {
      const task = tasks[i];
      wtCommand += ` ; new-tab -d "${task.workingDirectory}" --title "${project.name} - ${task.name}" cmd /k "${task.command}"`;
    }

    console.log('🚀 Executando Windows Terminal:', wtCommand);

    spawn(wtCommand, {
      shell: true,
      detached: true,
      stdio: 'ignore'
    });

  } else if (process.platform === 'darwin') {
    // macOS: abrir Terminal.app com múltiplas abas
    let script = `tell application "Terminal"\n  activate\n`;

    tasks.forEach((task, index) => {
      if (index === 0) {
        script += `  do script "cd '${task.workingDirectory}' && echo '${project.name} - ${task.name}' && ${task.command}"\n`;
      } else {
        script += `  tell application "System Events" to keystroke "t" using command down\n`;
        script += `  delay 0.5\n`;
        script += `  do script "cd '${task.workingDirectory}' && echo '${project.name} - ${task.name}' && ${task.command}" in selected tab of the front window\n`;
      }
    });

    script += `end tell`;

    spawn('osascript', ['-e', script], {
      detached: true,
      stdio: 'ignore'
    });

  } else {
    // Linux: tentar gnome-terminal com múltiplas abas
    // gnome-terminal suporta --tab para abrir várias abas

    const terminals = [
      {
        cmd: 'gnome-terminal',
        buildArgs: () => {
          const args = [];
          tasks.forEach((task, index) => {
            if (index > 0) args.push('--tab');
            args.push('--title', `${project.name} - ${task.name}`);
            args.push('--working-directory', task.workingDirectory);
            args.push('--', 'bash', '-c', `${task.command}; exec bash`);
          });
          return args;
        }
      },
      {
        cmd: 'konsole',
        buildArgs: () => {
          const args = ['--new-tab'];
          tasks.forEach((task) => {
            args.push('--workdir', task.workingDirectory, '-e', 'bash', '-c', `echo "${project.name} - ${task.name}" && ${task.command}; exec bash`);
          });
          return args;
        }
      }
    ];

    let launched = false;
    for (const terminal of terminals) {
      try {
        const args = terminal.buildArgs();
        spawn(terminal.cmd, args, {
          detached: true,
          stdio: 'ignore'
        });
        launched = true;
        break;
      } catch (err) {
        continue;
      }
    }

    if (!launched) {
      // Fallback: abrir em janelas separadas
      tasks.forEach(task => {
        const terminals = [
          { cmd: 'gnome-terminal', args: ['--', 'bash', '-c', `cd "${task.workingDirectory}" && ${task.command}; exec bash`] },
          { cmd: 'xterm', args: ['-e', `cd "${task.workingDirectory}" && ${task.command}; exec bash`] }
        ];

        for (const term of terminals) {
          try {
            spawn(term.cmd, term.args, { detached: true, stdio: 'ignore' });
            break;
          } catch (err) {
            continue;
          }
        }
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

    // Parar monitoramento de performance
    if (performanceMonitor) {
      performanceMonitor.stopMonitoring(projectId);
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

// Handler para obter histórico de métricas de performance
ipcMain.handle('get-performance-history', async (event, projectId) => {
  try {
    if (performanceMonitor) {
      return performanceMonitor.getHistory(projectId);
    }
    return [];
  } catch (error) {
    return [];
  }
});
