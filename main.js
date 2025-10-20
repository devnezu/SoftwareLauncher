const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'projects.json');

// Armazena os processos em execução
const runningProcesses = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#1a1a1a',
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  // Abre DevTools apenas em modo desenvolvimento
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
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
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});
