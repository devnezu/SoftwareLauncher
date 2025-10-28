const pidusage = require('pidusage');

class PerformanceMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.monitors = new Map(); // projectId -> { interval, processes }
    this.history = new Map(); // projectId -> array de métricas
    this.maxHistorySize = 60; // Guardar últimos 60 pontos (1 min se coleta a cada 1s)
  }

  /**
   * Inicia monitoramento de performance para um projeto
   * @param {string} projectId - ID do projeto
   * @param {Array} processes - Array de processos child_process
   * @param {string} projectName - Nome do projeto
   */
  startMonitoring(projectId, processes, projectName) {
    // Se já está monitorando, para primeiro
    this.stopMonitoring(projectId);

    console.log(`📊 Iniciando monitoring de performance para projeto: ${projectName} (${processes.length} processos)`);

    // Inicializar histórico
    if (!this.history.has(projectId)) {
      this.history.set(projectId, []);
    }

    // Coletar métricas a cada 2 segundos
    const interval = setInterval(() => {
      this.collectMetrics(projectId, processes, projectName);
    }, 2000);

    // Armazenar referência
    this.monitors.set(projectId, {
      interval,
      processes,
      projectName,
      startTime: Date.now()
    });

    // Coletar primeira amostra imediatamente
    this.collectMetrics(projectId, processes, projectName);
  }

  /**
   * Coleta métricas de CPU/RAM de todos os processos
   */
  async collectMetrics(projectId, processes, projectName) {
    try {
      const pids = processes
        .filter(proc => proc && proc.pid && !proc.killed)
        .map(proc => proc.pid);

      if (pids.length === 0) {
        // Nenhum processo ativo
        return;
      }

      // Coletar estatísticas de todos os PIDs
      const stats = await pidusage(pids);

      // Calcular totais
      let totalCpu = 0;
      let totalMemory = 0;
      const processStats = [];

      pids.forEach(pid => {
        if (stats[pid]) {
          totalCpu += stats[pid].cpu;
          totalMemory += stats[pid].memory;

          processStats.push({
            pid,
            cpu: stats[pid].cpu.toFixed(2),
            memory: (stats[pid].memory / 1024 / 1024).toFixed(2), // MB
            elapsed: stats[pid].elapsed
          });
        }
      });

      const monitor = this.monitors.get(projectId);
      const uptime = monitor ? Math.floor((Date.now() - monitor.startTime) / 1000) : 0;

      const metrics = {
        projectId,
        projectName,
        timestamp: Date.now(),
        uptime,
        cpu: totalCpu.toFixed(2),
        memory: (totalMemory / 1024 / 1024).toFixed(2), // MB
        processCount: pids.length,
        processes: processStats
      };

      // Adicionar ao histórico
      const history = this.history.get(projectId);
      history.push(metrics);

      // Limitar tamanho do histórico
      if (history.length > this.maxHistorySize) {
        history.shift();
      }

      // Enviar para frontend
      this.mainWindow.webContents.send('performance-metrics', metrics);

      // Verificar alertas
      this.checkAlerts(projectId, metrics);

    } catch (error) {
      // Processo pode ter terminado
      if (error.code !== 'ENOENT') {
        console.error(`Erro ao coletar métricas para ${projectId}:`, error.message);
      }
    }
  }

  /**
   * Verifica se métricas ultrapassam limites e envia alertas
   */
  checkAlerts(projectId, metrics) {
    const alerts = [];

    // Alerta de CPU alta (acima de 80%)
    if (parseFloat(metrics.cpu) > 80) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `CPU alta: ${metrics.cpu}%`,
        projectId,
        projectName: metrics.projectName
      });
    }

    // Alerta de CPU muito alta (acima de 95%)
    if (parseFloat(metrics.cpu) > 95) {
      alerts.push({
        type: 'cpu',
        level: 'critical',
        message: `CPU crítica: ${metrics.cpu}%`,
        projectId,
        projectName: metrics.projectName
      });
    }

    // Alerta de memória alta (acima de 500MB)
    if (parseFloat(metrics.memory) > 500) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `Memória alta: ${metrics.memory} MB`,
        projectId,
        projectName: metrics.projectName
      });
    }

    // Alerta de memória muito alta (acima de 1GB)
    if (parseFloat(metrics.memory) > 1024) {
      alerts.push({
        type: 'memory',
        level: 'critical',
        message: `Memória crítica: ${metrics.memory} MB`,
        projectId,
        projectName: metrics.projectName
      });
    }

    // Enviar alertas para frontend
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        this.mainWindow.webContents.send('performance-alert', alert);
      });
    }
  }

  /**
   * Para monitoramento de um projeto específico
   */
  stopMonitoring(projectId) {
    const monitor = this.monitors.get(projectId);

    if (monitor) {
      clearInterval(monitor.interval);
      this.monitors.delete(projectId);
      console.log(`📊 Monitoramento parado para projeto: ${monitor.projectName}`);
    }
  }

  /**
   * Obtém histórico de métricas de um projeto
   */
  getHistory(projectId) {
    return this.history.get(projectId) || [];
  }

  /**
   * Para todos os monitoramentos
   */
  stopAll() {
    this.monitors.forEach((monitor, projectId) => {
      this.stopMonitoring(projectId);
    });
    this.history.clear();
  }
}

module.exports = PerformanceMonitor;
