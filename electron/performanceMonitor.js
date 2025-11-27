const pidusage = require('pidusage');

class PerformanceMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.monitoringInterval = null;
    this.activeProcesses = new Map(); // projectId -> Array of pids
  }

  startMonitoring(projectId, processes, projectName) {
    // Add PIDs to tracking
    const pids = processes.map(p => p.pid).filter(pid => pid);
    if (pids.length === 0) return;

    this.activeProcesses.set(projectId, pids);

    if (!this.monitoringInterval) {
      this.monitoringInterval = setInterval(() => this.monitor(), 2000);
    }
  }

  stopMonitoring(projectId) {
    this.activeProcesses.delete(projectId);
    
    // Safety check: Clean up interval if no projects are being monitored
    if (this.activeProcesses.size === 0 && this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      // Clear pidusage internal cache to prevent memory leaks over time
      pidusage.clear(); 
    }
  }

  async monitor() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        if(this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        return;
    }

    for (const [projectId, pids] of this.activeProcesses) {
      try {
        const stats = await pidusage(pids);
        // stats is an object where keys are PIDs
        let totalCpu = 0;
        let totalMem = 0;

        for (const pid of pids) {
            if (stats[pid]) {
                totalCpu += stats[pid].cpu;
                totalMem += stats[pid].memory;
            }
        }

        const metrics = {
          projectId,
          cpu: Math.round(totalCpu * 10) / 10,
          memory: Math.round(totalMem / 1024 / 1024), // MB
          timestamp: new Date().toISOString()
        };

        this.mainWindow.webContents.send('performance-metrics', metrics);
      } catch (err) {
        // Process might have ended, pidusage throws if pid not found
      }
    }
  }
  
  // Legacy stubs to prevent crashes if called
  getHistory() { return []; }
  getAvailablePeriods() { return []; }
  loadHistoryFromFiles() { return []; }
}

module.exports = PerformanceMonitor;
