const { app, BrowserWindow, ipcMain, dialog, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const ServiceMonitor = require('./serviceMonitor');
const ServiceDetector = require('./serviceDetector');
const PerformanceMonitor = require('./performanceMonitor');
const HealthCheckMonitor = require('./healthCheckMonitor');
const GeminiService = require('./geminiService');

let mainWindow;
let serviceMonitor;
let performanceMonitor;
let healthCheckMonitor;
let geminiService;
const configPath = path.join(app.getPath('userData'), 'projects.json');

const runningProcesses = new Map();
const runningProjects = new Map(); // Para armazenar referências completas dos projetos
const stoppingProjects = new Set(); // Para rastrear projetos sendo parados manualmente

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

  // Inicializar ServiceMonitor, PerformanceMonitor, HealthCheckMonitor e GeminiService
  serviceMonitor = new ServiceMonitor(mainWindow);
  performanceMonitor = new PerformanceMonitor(mainWindow);
  healthCheckMonitor = new HealthCheckMonitor(mainWindow);

  // GeminiService será inicializado quando o usuário configurar a API Key através da UI
  // Não é mais necessário configurar via variável de ambiente
  geminiService = null;

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

// ==================== PORT DETECTION ====================

/**
 * Extrai números de porta de um comando
 * Procura por padrões como: -p 3000, --port 3000, :3000, PORT=3000
 */
function extractPortsFromCommand(command) {
  const ports = [];

  // Padrão 1: -p 3000, --port 3000, --port=3000
  const flagPattern = /(?:-p|--port)[=\s]+(\d+)/gi;
  let match;
  while ((match = flagPattern.exec(command)) !== null) {
    ports.push(parseInt(match[1]));
  }

  // Padrão 2: :3000 (comum em URLs como localhost:3000)
  const colonPattern = /:(\d{4,5})\b/g;
  while ((match = colonPattern.exec(command)) !== null) {
    const port = parseInt(match[1]);
    if (port >= 1000 && port <= 65535) {
      ports.push(port);
    }
  }

  // Padrão 3: PORT=3000, PORT 3000
  const portVarPattern = /PORT[=\s]+(\d+)/gi;
  while ((match = portVarPattern.exec(command)) !== null) {
    ports.push(parseInt(match[1]));
  }

  // Remover duplicatas
  return [...new Set(ports)];
}

/**
 * Verifica se uma porta está em uso e retorna o PID do processo
 * @param {number} port - Número da porta
 * @returns {Promise<number|null>} PID do processo ou null se porta está livre
 */
async function checkPortInUse(port) {
  return new Promise((resolve) => {
    let command, args;

    if (process.platform === 'win32') {
      // Windows: netstat -ano para verificar todas as conexões
      command = 'cmd';
      args = ['/c', `netstat -ano | findstr :${port}`];
    } else {
      // Linux/macOS: lsof -i :<port>
      command = 'lsof';
      args = ['-i', `:${port}`, '-t'];
    }

    const proc = spawn(command, args, { shell: true });
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (process.platform === 'win32') {
        // Parse Windows netstat output
        // Formato: TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       12345
        // ou:      TCP    [::]:3333              [::]:0                 LISTENING       67890
        const lines = output.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();

          // Verificar se a linha contém a porta e está em estado LISTENING ou ESTABLISHED
          if (trimmed.includes(`:${port}`) && (trimmed.includes('LISTENING') || trimmed.includes('ESTABLISHED'))) {
            // Extrair PID da última coluna
            const parts = trimmed.split(/\s+/);
            const pid = parseInt(parts[parts.length - 1]);

            if (pid && !isNaN(pid) && pid > 0) {
              console.log(`[Port Check] Porta ${port} em uso pelo PID ${pid}`);
              return resolve(pid);
            }
          }
        }

        // Se não encontrou, a porta está livre
        console.log(`[Port Check] Porta ${port} está livre`);
        resolve(null);
      } else {
        // Parse Linux/macOS lsof output (apenas PID)
        const firstLine = output.trim().split('\n')[0];
        const pid = parseInt(firstLine);

        if (pid && !isNaN(pid) && pid > 0) {
          console.log(`[Port Check] Porta ${port} em uso pelo PID ${pid}`);
          resolve(pid);
        } else {
          console.log(`[Port Check] Porta ${port} está livre`);
          resolve(null);
        }
      }
    });

    proc.on('error', (err) => {
      console.error(`[Port Check] Erro ao verificar porta ${port}:`, err.message);
      resolve(null);
    });
  });
}

/**
 * Mata um processo pelo PID
 */
async function killProcessByPid(pid) {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        // Windows: taskkill /F /PID <pid>
        const proc = spawn('taskkill', ['/F', '/PID', pid.toString()]);
        proc.on('close', (code) => {
          resolve(code === 0);
        });
      } else {
        // Linux/macOS: kill -9 <pid>
        const proc = spawn('kill', ['-9', pid.toString()]);
        proc.on('close', (code) => {
          resolve(code === 0);
        });
      }
    } catch (error) {
      resolve(false);
    }
  });
}

// IPC Handler: Verificar se portas estão em uso
ipcMain.handle('check-ports-in-use', async (event, project) => {
  try {
    const portsInUse = [];

    for (const task of project.tasks) {
      const ports = extractPortsFromCommand(task.command);

      for (const port of ports) {
        const pid = await checkPortInUse(port);
        if (pid) {
          portsInUse.push({
            port,
            pid,
            taskName: task.name,
            command: task.command
          });
        }
      }
    }

    return { success: true, portsInUse };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Matar processo por PID
ipcMain.handle('kill-process-by-pid', async (event, pid) => {
  try {
    const success = await killProcessByPid(pid);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ==================== END PORT DETECTION ====================

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

        // Notificação de crash se saiu com erro
        // Não mostrar se o projeto está sendo parado manualmente
        if (code !== 0 && code !== null && !stoppingProjects.has(project.id)) {
          const notification = new Notification({
            title: `❌ ${project.name}`,
            body: `${task.name} encerrou com erro (código ${code})`,
            urgency: 'critical'
          });
          notification.show();
        }
      });

      // Armazenar referência do processo com nome da task
      childProcess.taskName = task.name;
      projectProcesses.push(childProcess);
    }

    // Abrir tasks externas em UMA ÚNICA janela com múltiplas guias
    if (externalTasks.length > 0) {
      launchAllInExternalTerminal(externalTasks, project);
    }

    runningProcesses.set(project.id, projectProcesses);
    runningProjects.set(project.id, { project, environment }); // Armazenar para auto-restart

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

    // Iniciar health checks para tasks configuradas
    if (healthCheckMonitor) {
      setTimeout(() => {
        project.tasks.forEach((task, index) => {
          if (task.healthCheck?.enabled && (task.executionMode || 'internal') === 'internal') {
            const processRef = projectProcesses.find(p => p.taskName === task.name);
            healthCheckMonitor.startHealthCheck(project.id, project.name, task, processRef);
          }
        });
      }, 3000); // Aguardar 3s para serviços iniciarem
    }

    // Notificação de sucesso
    const notification = new Notification({
      title: `✅ ${project.name}`,
      body: `Projeto iniciado em modo ${environment}`,
      urgency: 'low'
    });
    notification.show();

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
    data: `[Terminal Externo] Abrindo ${tasks.length} guia(s) para: ${project.name}`
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
    // Adicionar ao Set de projetos sendo parados manualmente
    stoppingProjects.add(projectId);

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

    // Parar health checks
    if (healthCheckMonitor) {
      healthCheckMonitor.stopProjectHealthChecks(projectId);
    }

    // Limpar referência do projeto
    const projectInfo = runningProjects.get(projectId);
    runningProjects.delete(projectId);

    // Notificação de parada
    if (projectInfo) {
      const notification = new Notification({
        title: `⏹️ ${projectInfo.project.name}`,
        body: 'Projeto parado',
        urgency: 'low'
      });
      notification.show();
    }

    // Remover do Set após 2 segundos (garantir que todos os processos terminaram)
    setTimeout(() => {
      stoppingProjects.delete(projectId);
    }, 2000);

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

// Handler para obter histórico de métricas de performance (memória)
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

// Handler para carregar histórico de um período específico
ipcMain.handle('load-performance-history', async (event, projectId, startDate, endDate) => {
  try {
    if (performanceMonitor) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await performanceMonitor.loadHistoryFromFiles(projectId, start, end);
    }
    return [];
  } catch (error) {
    console.error('Erro ao carregar histórico:', error.message);
    return [];
  }
});

// Handler para listar períodos disponíveis
ipcMain.handle('get-available-periods', async (event, projectId) => {
  try {
    if (performanceMonitor) {
      return await performanceMonitor.getAvailablePeriods(projectId);
    }
    return [];
  } catch (error) {
    console.error('Erro ao listar períodos:', error.message);
    return [];
  }
});

// ==================== HEALTH CHECKS ====================

// Handler para obter status de health checks
ipcMain.handle('get-health-status', async (event, projectId) => {
  try {
    if (healthCheckMonitor) {
      return healthCheckMonitor.getProjectStatus(projectId);
    }
    return [];
  } catch (error) {
    console.error('Erro ao obter health status:', error.message);
    return [];
  }
});

// Handler para obter histórico de eventos de health
ipcMain.handle('get-health-history', async (event, projectId) => {
  try {
    if (healthCheckMonitor) {
      return healthCheckMonitor.getHistory(projectId);
    }
    return [];
  } catch (error) {
    console.error('Erro ao obter health history:', error.message);
    return [];
  }
});

// Handler para restart manual de uma task
ipcMain.handle('restart-task', async (event, projectId, taskName) => {
  try {
    const projectInfo = runningProjects.get(projectId);
    if (!projectInfo) {
      return { success: false, error: 'Projeto não está em execução' };
    }

    const { project, environment } = projectInfo;
    const task = project.tasks.find(t => t.name === taskName);

    if (!task) {
      return { success: false, error: 'Task não encontrada' };
    }

    // Parar processo atual
    const processes = runningProcesses.get(projectId);
    if (processes) {
      const proc = processes.find(p => p.taskName === taskName);
      if (proc && !proc.killed) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
        } else {
          proc.kill();
        }
        // Remover da lista
        const index = processes.indexOf(proc);
        if (index > -1) {
          processes.splice(index, 1);
        }
      }
    }

    // Aguardar um pouco para processo terminar
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reiniciar processo
    const env = { ...process.env };
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

      if (code !== 0 && code !== null) {
        const notification = new Notification({
          title: `❌ ${project.name}`,
          body: `${task.name} encerrou com erro (código ${code})`,
          urgency: 'critical'
        });
        notification.show();
      }
    });

    childProcess.taskName = task.name;
    processes.push(childProcess);

    // Reiniciar health check
    if (task.healthCheck?.enabled && healthCheckMonitor) {
      setTimeout(() => {
        healthCheckMonitor.stopHealthCheck(projectId, task.name);
        healthCheckMonitor.startHealthCheck(project.id, project.name, task, childProcess);
      }, 2000);
    }

    // Notificação de restart
    const notification = new Notification({
      title: `🔄 ${project.name}`,
      body: `${taskName} reiniciado`,
      urgency: 'low'
    });
    notification.show();

    return { success: true };
  } catch (error) {
    console.error('Erro ao reiniciar task:', error.message);
    return { success: false, error: error.message };
  }
});

// ==================== AI PROJECT ANALYSIS ====================

// Handler para analisar projeto com IA
ipcMain.handle('analyze-project-with-ai', async (event, projectPath) => {
  try {
    if (!geminiService) {
      return {
        success: false,
        error: 'AI service not initialized'
      };
    }

    const result = await geminiService.analyzeMultipleProjects(projectPath);
    return result;
  } catch (error) {
    console.error('Error analyzing project with AI:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handler para selecionar diretório de projeto para análise
ipcMain.handle('select-project-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar Pasta do Projeto'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

// Handler para configurar/atualizar a Gemini API Key
ipcMain.handle('set-gemini-api-key', async (event, apiKey) => {
  try {
    if (apiKey && apiKey.trim()) {
      // Inicializa ou atualiza o GeminiService com a nova API key
      if (geminiService) {
        geminiService.setApiKey(apiKey.trim());
      } else {
        geminiService = new GeminiService(apiKey.trim());
      }
      console.log('Gemini API Key configured successfully');
      return { success: true };
    } else {
      // Remove o serviço se a API key for removida
      geminiService = null;
      console.log('Gemini API Key removed');
      return { success: true };
    }
  } catch (error) {
    console.error('Error setting Gemini API Key:', error);
    return { success: false, error: error.message };
  }
});

// ==================== END AI PROJECT ANALYSIS ====================

// ==================== END HEALTH CHECKS ====================
