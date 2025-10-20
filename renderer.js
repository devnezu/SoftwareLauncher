const { ipcRenderer } = require('electron');

// Estado da aplicação
let projects = [];
let currentProject = null;
let editingProjectId = null;
let runningProjects = new Set();

// Elementos do DOM
const elements = {
  // Sidebar
  btnNewProject: document.getElementById('btnNewProject'),
  projectsList: document.getElementById('projectsList'),

  // Main content
  welcomeScreen: document.getElementById('welcomeScreen'),
  projectView: document.getElementById('projectView'),

  // Project view
  projectTitle: document.getElementById('projectTitle'),
  projectDescription: document.getElementById('projectDescription'),
  btnEditProject: document.getElementById('btnEditProject'),
  btnDeleteProject: document.getElementById('btnDeleteProject'),
  btnLaunch: document.getElementById('btnLaunch'),
  btnStop: document.getElementById('btnStop'),
  tasksList: document.getElementById('tasksList'),
  consoleOutput: document.getElementById('consoleOutput'),
  btnClearConsole: document.getElementById('btnClearConsole'),

  // Modal
  configModal: document.getElementById('configModal'),
  modalTitle: document.getElementById('modalTitle'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnCancelModal: document.getElementById('btnCancelModal'),
  btnSaveProject: document.getElementById('btnSaveProject'),

  // Form
  projectName: document.getElementById('projectName'),
  projectDescription2: document.getElementById('projectDescription'),
  tasksList2: document.getElementById('tasksList2'),
  btnAddTask: document.getElementById('btnAddTask'),
  envVarsList: document.getElementById('envVarsList'),
  btnAddEnvVar: document.getElementById('btnAddEnvVar')
};

// Inicialização
async function init() {
  await loadProjects();
  setupEventListeners();
}

// Carregar projetos salvos
async function loadProjects() {
  projects = await ipcRenderer.invoke('load-projects');
  renderProjectsList();
}

// Salvar projetos
async function saveProjects() {
  const result = await ipcRenderer.invoke('save-projects', projects);
  return result.success;
}

// Renderizar lista de projetos
function renderProjectsList() {
  elements.projectsList.innerHTML = '';

  if (projects.length === 0) {
    elements.projectsList.innerHTML = '<div class="empty-state">Nenhum projeto criado</div>';
    return;
  }

  projects.forEach(project => {
    const item = document.createElement('div');
    item.className = 'project-item';
    if (currentProject && currentProject.id === project.id) {
      item.classList.add('active');
    }

    const statusClass = runningProjects.has(project.id) ? 'running' : '';

    item.innerHTML = `
      <h3>
        <span class="project-status ${statusClass}"></span>
        ${escapeHtml(project.name)}
      </h3>
      <p>${escapeHtml(project.description || 'Sem descrição')}</p>
    `;

    item.addEventListener('click', () => selectProject(project));
    elements.projectsList.appendChild(item);
  });
}

// Selecionar projeto
function selectProject(project) {
  currentProject = project;
  renderProjectsList();
  showProjectView();
}

// Mostrar visualização do projeto
function showProjectView() {
  elements.welcomeScreen.style.display = 'none';
  elements.projectView.style.display = 'flex';

  elements.projectTitle.textContent = currentProject.name;
  elements.projectDescription.textContent = currentProject.description || 'Sem descrição';

  // Atualizar botões de acordo com o estado
  const isRunning = runningProjects.has(currentProject.id);
  elements.btnLaunch.style.display = isRunning ? 'none' : 'flex';
  elements.btnStop.style.display = isRunning ? 'flex' : 'none';

  renderTasksList();
}

// Renderizar lista de tarefas
function renderTasksList() {
  elements.tasksList.innerHTML = '';

  if (!currentProject.tasks || currentProject.tasks.length === 0) {
    elements.tasksList.innerHTML = '<div class="empty-state">Nenhuma tarefa configurada</div>';
    return;
  }

  currentProject.tasks.forEach((task, index) => {
    const item = document.createElement('div');
    item.className = 'task-item';

    const isRunning = runningProjects.has(currentProject.id);
    const statusClass = isRunning ? 'running' : '';

    item.innerHTML = `
      <h4>
        <span class="task-status ${statusClass}"></span>
        ${escapeHtml(task.name)}
      </h4>
      <div class="task-details">
        <div class="task-detail"><strong>Comando:</strong> ${escapeHtml(task.command)}</div>
        <div class="task-detail"><strong>Diretório:</strong> ${escapeHtml(task.workingDirectory)}</div>
      </div>
    `;

    elements.tasksList.appendChild(item);
  });
}

// Abrir modal de configuração
function openConfigModal(project = null) {
  editingProjectId = project ? project.id : null;

  if (project) {
    elements.modalTitle.textContent = 'Editar Projeto';
    elements.projectName.value = project.name;
    elements.projectDescription2.value = project.description || '';

    // Carregar tarefas
    elements.tasksList2.innerHTML = '';
    if (project.tasks) {
      project.tasks.forEach(task => addTaskToConfig(task));
    }

    // Carregar variáveis de ambiente
    elements.envVarsList.innerHTML = '';
    if (project.environmentVariables) {
      Object.entries(project.environmentVariables).forEach(([key, value]) => {
        addEnvVarToConfig(key, value);
      });
    }
  } else {
    elements.modalTitle.textContent = 'Novo Projeto';
    elements.projectName.value = '';
    elements.projectDescription2.value = '';
    elements.tasksList2.innerHTML = '';
    elements.envVarsList.innerHTML = '';
  }

  elements.configModal.classList.add('active');
}

// Fechar modal
function closeConfigModal() {
  elements.configModal.classList.remove('active');
  editingProjectId = null;
}

// Adicionar tarefa à configuração
function addTaskToConfig(task = null) {
  const taskItem = document.createElement('div');
  taskItem.className = 'task-config-item';

  const taskName = task ? task.name : '';
  const taskCommand = task ? task.command : '';
  const taskDir = task ? task.workingDirectory : '';

  taskItem.innerHTML = `
    <div class="task-config-header">
      <input type="text" class="task-name" placeholder="Nome da tarefa (ex: Frontend)" value="${escapeHtml(taskName)}">
      <button class="btn-remove" onclick="this.parentElement.parentElement.remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="form-group">
      <label>Comando</label>
      <input type="text" class="task-command" placeholder="yarn dev" value="${escapeHtml(taskCommand)}">
    </div>
    <div class="form-group">
      <label>Diretório de Trabalho</label>
      <div style="display: flex; gap: 8px;">
        <input type="text" class="task-directory" placeholder="C:\\projetos\\meu-app\\frontend" value="${escapeHtml(taskDir)}">
        <button class="btn-select-dir" onclick="selectDirectory(this)">Selecionar</button>
      </div>
    </div>
  `;

  elements.tasksList2.appendChild(taskItem);
}

// Selecionar diretório
async function selectDirectory(button) {
  const directory = await ipcRenderer.invoke('select-directory');
  if (directory) {
    const input = button.previousElementSibling;
    input.value = directory;
  }
}

// Tornar selectDirectory global para ser acessível no HTML
window.selectDirectory = selectDirectory;

// Adicionar variável de ambiente
function addEnvVarToConfig(key = '', value = '') {
  const envItem = document.createElement('div');
  envItem.className = 'env-var-item';

  envItem.innerHTML = `
    <input type="text" class="env-key" placeholder="NOME_VARIAVEL" value="${escapeHtml(key)}">
    <input type="text" class="env-value" placeholder="valor" value="${escapeHtml(value)}">
    <button class="btn-remove" onclick="this.parentElement.remove()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  elements.envVarsList.appendChild(envItem);
}

// Salvar projeto
function saveProject() {
  const name = elements.projectName.value.trim();
  if (!name) {
    alert('Por favor, insira um nome para o projeto');
    return;
  }

  // Coletar tarefas
  const tasks = [];
  const taskItems = elements.tasksList2.querySelectorAll('.task-config-item');

  taskItems.forEach(item => {
    const name = item.querySelector('.task-name').value.trim();
    const command = item.querySelector('.task-command').value.trim();
    const workingDirectory = item.querySelector('.task-directory').value.trim();

    if (name && command && workingDirectory) {
      tasks.push({
        name,
        command,
        workingDirectory,
        environmentVariables: {}
      });
    }
  });

  // Coletar variáveis de ambiente
  const environmentVariables = {};
  const envItems = elements.envVarsList.querySelectorAll('.env-var-item');

  envItems.forEach(item => {
    const key = item.querySelector('.env-key').value.trim();
    const value = item.querySelector('.env-value').value.trim();

    if (key) {
      environmentVariables[key] = value;
    }
  });

  const project = {
    id: editingProjectId || generateId(),
    name,
    description: elements.projectDescription2.value.trim(),
    tasks,
    environmentVariables
  };

  if (editingProjectId) {
    // Atualizar projeto existente
    const index = projects.findIndex(p => p.id === editingProjectId);
    projects[index] = project;
  } else {
    // Adicionar novo projeto
    projects.push(project);
  }

  saveProjects();
  renderProjectsList();
  closeConfigModal();

  // Se estiver editando o projeto atual, atualizar a visualização
  if (editingProjectId && currentProject && currentProject.id === editingProjectId) {
    currentProject = project;
    showProjectView();
  }
}

// Excluir projeto
function deleteProject() {
  if (!currentProject) return;

  if (confirm(`Tem certeza que deseja excluir o projeto "${currentProject.name}"?`)) {
    // Parar o projeto se estiver rodando
    if (runningProjects.has(currentProject.id)) {
      stopProject();
    }

    projects = projects.filter(p => p.id !== currentProject.id);
    saveProjects();
    renderProjectsList();

    currentProject = null;
    elements.welcomeScreen.style.display = 'flex';
    elements.projectView.style.display = 'none';
  }
}

// Executar projeto
async function launchProject() {
  if (!currentProject) return;

  // Limpar console
  elements.consoleOutput.innerHTML = '';

  // Adicionar linha inicial
  addConsoleOutput('system', 'Iniciando projeto...', '');

  const result = await ipcRenderer.invoke('launch-project', currentProject);

  if (result.success) {
    runningProjects.add(currentProject.id);
    renderProjectsList();
    showProjectView();
    addConsoleOutput('system', 'Projeto iniciado com sucesso!', '');
  } else {
    addConsoleOutput('error', `Erro ao iniciar projeto: ${result.error}`, '');
  }
}

// Parar projeto
async function stopProject() {
  if (!currentProject) return;

  const result = await ipcRenderer.invoke('stop-project', currentProject.id);

  if (result.success) {
    runningProjects.delete(currentProject.id);
    renderProjectsList();
    showProjectView();
    addConsoleOutput('system', 'Projeto parado.', '');
  } else {
    addConsoleOutput('error', `Erro ao parar projeto: ${result.error}`, '');
  }
}

// Adicionar saída ao console
function addConsoleOutput(type, data, taskName) {
  // Remove a mensagem de vazio se existir
  const emptyMsg = elements.consoleOutput.querySelector('.console-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  const line = document.createElement('div');
  line.className = `console-line ${type}`;

  const timestamp = new Date().toLocaleTimeString();
  let content = '';

  if (taskName) {
    content = `<span class="task-label">${escapeHtml(taskName)}</span>`;
  }

  if (type === 'system') {
    content += `[${timestamp}] ${escapeHtml(data)}`;
  } else if (type === 'error') {
    content += `[${timestamp}] ERROR: ${escapeHtml(data)}`;
  } else {
    content += escapeHtml(data);
  }

  line.innerHTML = content;
  elements.consoleOutput.appendChild(line);

  // Auto-scroll para o final
  elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
}

// Limpar console
function clearConsole() {
  elements.consoleOutput.innerHTML = '<div class="console-empty">Console limpo.</div>';
}

// Event Listeners
function setupEventListeners() {
  // Botões principais
  elements.btnNewProject.addEventListener('click', () => openConfigModal());
  elements.btnEditProject.addEventListener('click', () => openConfigModal(currentProject));
  elements.btnDeleteProject.addEventListener('click', deleteProject);
  elements.btnLaunch.addEventListener('click', launchProject);
  elements.btnStop.addEventListener('click', stopProject);
  elements.btnClearConsole.addEventListener('click', clearConsole);

  // Modal
  elements.btnCloseModal.addEventListener('click', closeConfigModal);
  elements.btnCancelModal.addEventListener('click', closeConfigModal);
  elements.btnSaveProject.addEventListener('click', saveProject);

  // Fechar modal ao clicar fora
  elements.configModal.addEventListener('click', (e) => {
    if (e.target === elements.configModal) {
      closeConfigModal();
    }
  });

  // Adicionar tarefa/variável
  elements.btnAddTask.addEventListener('click', () => addTaskToConfig());
  elements.btnAddEnvVar.addEventListener('click', () => addEnvVarToConfig());

  // IPC Listeners
  ipcRenderer.on('process-output', (event, data) => {
    if (currentProject && data.projectId === currentProject.id) {
      addConsoleOutput(data.type, data.data, data.taskName);
    }
  });

  ipcRenderer.on('process-closed', (event, data) => {
    if (currentProject && data.projectId === currentProject.id) {
      addConsoleOutput('system', `Processo "${data.taskName}" encerrado com código ${data.code}`, '');
    }
  });
}

// Utilitários
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Inicializar aplicação
init();
