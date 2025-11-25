const http = require('http');
const https = require('https');
const { Notification } = require('electron');

class HealthCheckMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.monitors = new Map(); // projectId -> Map<taskName, monitorConfig>
    this.healthHistory = new Map(); // projectId -> array de eventos
    this.maxHistorySize = 100;
  }

  /**
   * Inicia health check para uma task específica
   * @param {string} projectId
   * @param {string} projectName
   * @param {object} task
   * @param {object} processRef - referência ao processo para restart
   */
  startHealthCheck(projectId, projectName, task, processRef) {
    if (!task.healthCheck || !task.healthCheck.enabled) {
      return;
    }

    const config = task.healthCheck;
    const monitorKey = `${projectId}-${task.name}`;

    // Se já está monitorando, parar primeiro
    this.stopHealthCheck(projectId, task.name);

    console.log(`[Health Check] Iniciando para ${projectName} - ${task.name} (${config.url})`);

    const monitorConfig = {
      projectId,
      projectName,
      taskName: task.name,
      url: config.url,
      interval: config.interval || 30000, // 30s padrão
      timeout: config.timeout || 5000, // 5s padrão
      retries: config.retries || 3,
      autoRestart: config.autoRestart !== false, // true por padrão
      processRef,
      failureCount: 0,
      lastCheck: null,
      status: 'healthy'
    };

    // Executar primeira verificação
    this.performHealthCheck(monitorConfig);

    // Agendar verificações periódicas
    monitorConfig.intervalId = setInterval(() => {
      this.performHealthCheck(monitorConfig);
    }, monitorConfig.interval);

    // Armazenar configuração
    if (!this.monitors.has(projectId)) {
      this.monitors.set(projectId, new Map());
    }
    this.monitors.get(projectId).set(task.name, monitorConfig);
  }

  /**
   * Executa uma verificação de health
   */
  async performHealthCheck(config) {
    const startTime = Date.now();

    try {
      const isHealthy = await this.checkUrl(config.url, config.timeout);
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        // Sucesso
        if (config.failureCount > 0) {
          // Recuperou de falha
          this.logEvent(config.projectId, {
            type: 'health-recovered',
            projectName: config.projectName,
            taskName: config.taskName,
            message: `${config.taskName} recuperado após ${config.failureCount} falha(s)`,
            timestamp: Date.now(),
            responseTime
          });

          this.sendNotification({
            title: `✅ ${config.projectName}`,
            body: `${config.taskName} recuperado!`,
            urgency: 'normal'
          });
        }

        config.failureCount = 0;
        config.status = 'healthy';
        config.lastCheck = Date.now();

        // Enviar atualização para frontend
        this.mainWindow.webContents.send('health-check-status', {
          projectId: config.projectId,
          taskName: config.taskName,
          status: 'healthy',
          responseTime,
          lastCheck: config.lastCheck
        });
      } else {
        // Falha
        this.handleHealthCheckFailure(config);
      }
    } catch (error) {
      console.error(`[Health Check] Erro em ${config.taskName}:`, error.message);
      this.handleHealthCheckFailure(config);
    }
  }

  /**
   * Lida com falha de health check
   */
  handleHealthCheckFailure(config) {
    config.failureCount++;
    config.lastCheck = Date.now();

    console.log(`[Health Check] Falha ${config.failureCount}/${config.retries} - ${config.taskName}`);

    if (config.failureCount >= config.retries) {
      // Excedeu tentativas
      config.status = 'unhealthy';

      this.logEvent(config.projectId, {
        type: 'health-check-failed',
        projectName: config.projectName,
        taskName: config.taskName,
        message: `${config.taskName} não respondeu após ${config.retries} tentativas`,
        timestamp: Date.now()
      });

      // Notificação crítica
      this.sendNotification({
        title: `🚨 ${config.projectName}`,
        body: `${config.taskName} não está respondendo!`,
        urgency: 'critical',
        sound: true
      });

      // Auto-restart se habilitado
      if (config.autoRestart) {
        this.attemptAutoRestart(config);
      }
    } else {
      // Ainda dentro do limite de retries
      config.status = 'degraded';
    }

    // Enviar atualização para frontend
    this.mainWindow.webContents.send('health-check-status', {
      projectId: config.projectId,
      taskName: config.taskName,
      status: config.status,
      failureCount: config.failureCount,
      maxRetries: config.retries,
      lastCheck: config.lastCheck
    });
  }

  /**
   * Tenta fazer auto-restart do serviço
   */
  attemptAutoRestart(config) {
    console.log(`[Health Check] Tentando auto-restart de ${config.taskName}...`);

    this.logEvent(config.projectId, {
      type: 'auto-restart',
      projectName: config.projectName,
      taskName: config.taskName,
      message: `Iniciando auto-restart de ${config.taskName}`,
      timestamp: Date.now()
    });

    // Enviar evento para o main process fazer restart
    this.mainWindow.webContents.send('health-check-restart-required', {
      projectId: config.projectId,
      taskName: config.taskName
    });

    // Resetar contador após restart
    config.failureCount = 0;
  }

  /**
   * Verifica se uma URL está respondendo
   */
  checkUrl(url, timeout) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.get(url, {
        timeout,
        headers: {
          'User-Agent': 'SoftwareLauncher-HealthCheck/1.0'
        }
      }, (res) => {
        // Status 2xx ou 3xx = sucesso
        const isHealthy = res.statusCode >= 200 && res.statusCode < 400;
        resolve(isHealthy);
        res.resume(); // Consumir response
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Para health check de uma task específica
   */
  stopHealthCheck(projectId, taskName) {
    const projectMonitors = this.monitors.get(projectId);
    if (!projectMonitors) return;

    const config = projectMonitors.get(taskName);
    if (config) {
      clearInterval(config.intervalId);
      projectMonitors.delete(taskName);
      console.log(`[Health Check] Parado para ${taskName}`);
    }
  }

  /**
   * Para todos os health checks de um projeto
   */
  stopProjectHealthChecks(projectId) {
    const projectMonitors = this.monitors.get(projectId);
    if (projectMonitors) {
      projectMonitors.forEach((config, taskName) => {
        clearInterval(config.intervalId);
      });
      this.monitors.delete(projectId);
      console.log(`[Health Check] Todos os checks parados para projeto ${projectId}`);
    }
  }

  /**
   * Envia notificação desktop
   */
  sendNotification(options) {
    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        urgency: options.urgency || 'normal',
        silent: !options.sound,
        icon: options.icon
      });

      notification.show();

      // Enviar também para frontend
      this.mainWindow.webContents.send('desktop-notification', options);
    } catch (error) {
      console.error('[Health Check] Erro ao enviar notificação:', error.message);
    }
  }

  /**
   * Registra evento no histórico
   */
  logEvent(projectId, event) {
    if (!this.healthHistory.has(projectId)) {
      this.healthHistory.set(projectId, []);
    }

    const history = this.healthHistory.get(projectId);
    history.push(event);

    // Limitar tamanho
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Enviar para frontend
    this.mainWindow.webContents.send('health-check-event', event);
  }

  /**
   * Obtém histórico de eventos
   */
  getHistory(projectId) {
    return this.healthHistory.get(projectId) || [];
  }

  /**
   * Obtém status de health checks de um projeto
   */
  getProjectStatus(projectId) {
    const projectMonitors = this.monitors.get(projectId);
    if (!projectMonitors) return [];

    const statuses = [];
    projectMonitors.forEach((config, taskName) => {
      statuses.push({
        taskName,
        status: config.status,
        failureCount: config.failureCount,
        maxRetries: config.retries,
        lastCheck: config.lastCheck,
        url: config.url
      });
    });

    return statuses;
  }

  /**
   * Para todos os health checks
   */
  stopAll() {
    this.monitors.forEach((projectMonitors, projectId) => {
      this.stopProjectHealthChecks(projectId);
    });
    this.healthHistory.clear();
  }
}

module.exports = HealthCheckMonitor;
