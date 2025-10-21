const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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
    frame: false, // Custom title bar
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../assets', 'icon.png')
  });

  // Remove o menu padrão
  Menu.setApplicationMenu(null);

  // Em desenvolvimento, carrega do servidor Vite
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
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

// Window controls
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

// Carregar projetos salvos
ipcMain.handle('load-projects', async () => {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
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

// Selecionar arquivo .env
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

// Ler e parsear arquivo .env
ipcMain.handle('parse-env-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const variables = {};

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Ignora comentários e linhas vazias
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE
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

// Escrever arquivo .env
ipcMain.handle('write-env-file', async (event, filePath, variables) => {
  try {
    // Lê o arquivo original para preservar comentários e estrutura
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      // Arquivo não existe, criar do zero
    }

    const lines = content.split('\n');
    const newLines = [];
    const updatedKeys = new Set();

    for (const line of lines) {
      const trimmed = line.trim();

      // Preserva comentários e linhas vazias
      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      // Parse KEY=VALUE
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();

        if (variables.hasOwnProperty(key)) {
          // Atualiza valor
          newLines.push(`${key}=${variables[key]}`);
          updatedKeys.add(key);
        } else {
          // Mantém linha original
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }

    // Adiciona novas variáveis que não existiam
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

// Executar projeto
ipcMain.handle('launch-project', async (event, project, environment) => {
  try {
    const projectProcesses = [];

    // Primeiro, atualiza todos os .env files de acordo com o ambiente
    for (const task of project.tasks) {
      if (task.envFilePath && task.envVariables) {
        const variablesToWrite = {};

        for (const [key, config] of Object.entries(task.envVariables)) {
          // Usa o valor do ambiente selecionado
          variablesToWrite[key] = config[environment] || config.development || '';
        }

        const result = await ipcMain.emit('write-env-file', {}, task.envFilePath, variablesToWrite);
      }
    }

    // Aguarda um pouco para garantir que os arquivos foram escritos
    await new Promise(resolve => setTimeout(resolve, 500));

    // Então inicia os processos
    for (const task of project.tasks) {
      const env = {
        ...process.env
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
