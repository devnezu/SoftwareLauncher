const pidusage = require('pidusage');
const fs = require('fs').promises;
const path = require('path');
const { app, Notification } = require('electron');

class PerformanceMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.monitors = new Map(); // projectId -> { interval, processes }
    this.history = new Map(); // projectId -> array de métricas
    this.alertCooldowns = new Map(); // Evitar spam de notificações
    this.maxHistorySize = 60; // Guardar últimos 60 pontos (1 min se coleta a cada 1s)
    this.persistenceEnabled = true; // Ativar persistência
    this.persistenceInterval = 60000; // Salvar a cada 60 segundos
    this.historyPath = path.join(app.getPath('userData'), 'performance-history');

    // Criar diretório de histórico se não existir
    this.ensureHistoryDir();
  }

  /**
   * Garante que o diretório de histórico existe
   */
  async ensureHistoryDir() {
    try {
      await fs.mkdir(this.historyPath, { recursive: true });
    } catch (error) {
      console.error('Erro ao criar diretório de histórico:', error.message);
    }
  }

  /**
   * Salva histórico em arquivo JSON (formato: YYYY-MM.json)
   */
  async saveHistoryToFile(projectId, metrics) {
    if (!this.persistenceEnabled) return;

    try {
      const date = new Date(metrics.timestamp);
      const fileName = `${projectId}-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}.json`;
      const filePath = path.join(this.historyPath, fileName);

      // Ler arquivo existente ou criar novo
      let existingData = [];
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        existingData = JSON.parse(content);
      } catch (err) {
        // Arquivo não existe ainda
      }

      // Adicionar nova métrica
      existingData.push(metrics);

      // Limitar tamanho (manter últimas 50.000 entradas por mês ~1 mês de dados a cada 2s)
      if (existingData.length > 50000) {
        existingData = existingData.slice(-50000);
      }

      // Salvar
      await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error.message);
    }
  }

  /**
   * Carrega histórico de um período específico
   * @param {string} projectId - ID do projeto
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   */
  async loadHistoryFromFiles(projectId, startDate, endDate) {
    try {
      const metrics = [];

      // Gerar lista de arquivos para o período
      const files = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        const fileName = `${projectId}-${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}.json`;
        files.push(fileName);
        current.setMonth(current.getMonth() + 1);
      }

      // Ler todos os arquivos
      for (const fileName of files) {
        const filePath = path.join(this.historyPath, fileName);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // Filtrar por período
          const filtered = data.filter(m => {
            const timestamp = new Date(m.timestamp);
            return timestamp >= startDate && timestamp <= endDate;
          });

          metrics.push(...filtered);
        } catch (err) {
          // Arquivo não existe, continuar
        }
      }

      return metrics;
    } catch (error) {
      console.error('Erro ao carregar histórico:', error.message);
      return [];
    }
  }

  /**
   * Lista todos os períodos disponíveis para um projeto
   */
  async getAvailablePeriods(projectId) {
    try {
      const files = await fs.readdir(this.historyPath);
      const periods = [];

      for (const file of files) {
        if (file.startsWith(projectId) && file.endsWith('.json')) {
          // Extrair ano e mês do nome do arquivo: projectId-YYYY-MM.json
          const match = file.match(/-(\d{4})-(\d{2})\.json$/);
          if (match) {
            periods.push({
              year: parseInt(match[1]),
              month: parseInt(match[2]),
              label: `${match[1]}-${match[2]}`
            });
          }
        }
      }

      // Ordenar por data (mais recente primeiro)
      periods.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      return periods;
    } catch (error) {
      console.error('Erro ao listar períodos:', error.message);
      return [];
    }
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

      // Adicionar ao histórico em memória
      const history = this.history.get(projectId);
      history.push(metrics);

      // Limitar tamanho do histórico em memória
      if (history.length > this.maxHistorySize) {
        history.shift();
      }

      // Salvar em arquivo (assíncrono, não bloqueia)
      this.saveHistoryToFile(projectId, metrics).catch(err => {
        console.error('Erro ao persistir histórico:', err.message);
      });

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

    // Enviar alertas para frontend e notificações desktop
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        this.mainWindow.webContents.send('performance-alert', alert);

        // Notificação desktop com cooldown (1 notificação a cada 5 minutos por tipo)
        const cooldownKey = `${projectId}-${alert.type}-${alert.level}`;
        const lastAlert = this.alertCooldowns.get(cooldownKey);
        const now = Date.now();

        if (!lastAlert || now - lastAlert > 5 * 60 * 1000) { // 5 minutos
          this.alertCooldowns.set(cooldownKey, now);

          const notification = new Notification({
            title: `${alert.level === 'critical' ? '🚨' : '⚠️'} ${alert.projectName}`,
            body: alert.message,
            urgency: alert.level === 'critical' ? 'critical' : 'normal'
          });
          notification.show();
        }
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
