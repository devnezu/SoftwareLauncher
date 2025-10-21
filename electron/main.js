const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'projects.json');

// Armazena os processos em execução
const runningProcesses = new Map();

// Detecta se está em modo desenvolvimento
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
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../assets', 'icon.png')
  });

  // Em desenvolvimento, carrega do servidor Vite
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Em produção, carrega do build
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Encerra todos os processos em execução
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

// IPC Handlers

// Carregar projetos salvos
ipcMain.handle('load-projects', async () => {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Se o arquivo não existir, retorna array vazio
    return [];
  }
});

// Salvar projetos
ipcMain.handle('save-projects', async (event, projects) => {
  try {
    await fs.writeFile(configPath, JSON.stringify(projects, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Executar projeto
ipcMain.handle('launch-project', async (event, project) => {
  try {
    const projectProcesses = [];

    for (const task of project.tasks) {
      const env = {
        ...process.env,
        ...project.environmentVariables,
        ...task.environmentVariables
      };

      // Cria o processo
      const childProcess = spawn(task.command, {
        cwd: task.workingDirectory,
        shell: true,
        env: env,
        detached: false
      });

      // Envia saída do processo para o renderer
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

    // Armazena os processos
    runningProcesses.set(project.id, projectProcesses);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Parar projeto
ipcMain.handle('stop-project', async (event, projectId) => {
  try {
    const processes = runningProcesses.get(projectId);

    if (processes) {
      processes.forEach(proc => {
        if (proc && !proc.killed) {
          // No Windows, usa taskkill para matar a árvore de processos
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
          } else {
            proc.kill();
          }
        }
      });

      runningProcesses.delete(projectId);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Selecionar diretório
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

// Carregar projetos mock para debug
ipcMain.handle('load-mock-projects', async () => {
  return [
    {
      id: 'mock-1',
      name: 'Full Stack App',
      description: 'React Frontend + Node.js Backend',
      tasks: [
        {
          name: 'Frontend',
          command: 'echo "Frontend server started on http://localhost:3000" && timeout /t 999999',
          workingDirectory: process.cwd(),
          environmentVariables: {
            PORT: '3000'
          }
        },
        {
          name: 'Backend',
          command: 'echo "Backend API started on http://localhost:5000" && timeout /t 999999',
          workingDirectory: process.cwd(),
          environmentVariables: {
            PORT: '5000'
          }
        }
      ],
      environmentVariables: {
        NODE_ENV: 'development'
      }
    },
    {
      id: 'mock-2',
      name: 'Microservices',
      description: 'Auth + API Gateway + Payment Service',
      tasks: [
        {
          name: 'Auth Service',
          command: 'echo "Auth Service started" && timeout /t 999999',
          workingDirectory: process.cwd(),
          environmentVariables: {}
        },
        {
          name: 'API Gateway',
          command: 'echo "API Gateway started" && timeout /t 999999',
          workingDirectory: process.cwd(),
          environmentVariables: {}
        },
        {
          name: 'Payment Service',
          command: 'echo "Payment Service started" && timeout /t 999999',
          workingDirectory: process.cwd(),
          environmentVariables: {}
        }
      ],
      environmentVariables: {
        NODE_ENV: 'development',
        DEBUG: 'true'
      }
    }
  ];
});
