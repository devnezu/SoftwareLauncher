const axios = require('axios');
const fs = require('fs').promises;
const { Notification } = require('electron');

class ServiceMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.activeMonitors = new Map();
  }

  /**
   * Inicia monitoramento de um serviço (ngrok, cloudflared, etc)
   */
  async startMonitoring(projectId, task, environment) {
    const { monitoring } = task;

    if (!monitoring?.enabled) return;

    const monitorId = `${projectId}-${task.name}`;

    // Cancela monitor existente se houver
    this.stopMonitoring(monitorId);

    // Inicia novo monitor assíncrono
    this.pollService(monitorId, task, environment);
  }

  /**
   * Faz polling da API do serviço até capturar a URL
   */
  async pollService(monitorId, task, environment) {
    const { monitoring, envFilePath } = task;
    const { apiUrl, timeout, envVarToUpdate, urlTransform, type } = monitoring;
    const { maxAttempts = 15, intervalMs = 2000 } = timeout || {};

    this.sendLog(monitorId, `🔍 Iniciando monitoramento de ${type}...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.sendLog(monitorId, `⏳ Tentativa ${attempt}/${maxAttempts} de capturar URL...`);

        const response = await axios.get(apiUrl, {
          timeout: 5000,
          validateStatus: (status) => status === 200
        });

        const url = this.extractUrl(response.data, type);

        if (url) {
          this.sendLog(monitorId, `✅ URL capturada: ${url}`);

          // Aplicar transformação se existir
          const finalUrl = urlTransform ? this.evaluateTransform(urlTransform, url) : url;

          // Atualizar .env se caminho foi fornecido
          if (envFilePath && envVarToUpdate) {
            await this.updateEnvFile(envFilePath, envVarToUpdate, finalUrl, environment);
            this.sendLog(monitorId, `📝 Arquivo .env atualizado: ${envVarToUpdate}=${finalUrl}`);
          }

          // Notificar frontend
          this.mainWindow.webContents.send('url-captured', {
            monitorId,
            service: type,
            url: finalUrl,
            envVar: envVarToUpdate
          });

          // Notificação desktop
          const notification = new Notification({
            title: `🔗 ${type.toUpperCase()} URL Capturada`,
            body: finalUrl,
            urgency: 'normal'
          });
          notification.show();

          // Remover da lista de monitores ativos
          this.activeMonitors.delete(monitorId);

          return { success: true, url: finalUrl };
        }
      } catch (error) {
        // Silenciosamente continua tentando (serviço ainda não está pronto)
        if (attempt === 1) {
          this.sendLog(monitorId, `⏳ Aguardando ${type} inicializar...`);
        }
      }

      if (attempt < maxAttempts) {
        await this.sleep(intervalMs);
      }
    }

    this.sendLog(monitorId, `❌ Timeout: não foi possível capturar URL do ${type} após ${maxAttempts} tentativas`);
    this.activeMonitors.delete(monitorId);
    return { success: false };
  }

  /**
   * Extrai URL da resposta baseado no tipo de serviço
   */
  extractUrl(data, serviceType) {
    if (serviceType === 'ngrok') {
      // Ngrok retorna array de tunnels
      if (data.tunnels && Array.isArray(data.tunnels) && data.tunnels.length > 0) {
        // Prefere HTTPS se disponível
        const httpsTunnel = data.tunnels.find(t => t.public_url?.startsWith('https://'));
        if (httpsTunnel) return httpsTunnel.public_url;

        // Senão pega o primeiro disponível
        return data.tunnels[0].public_url;
      }
    }

    // Para serviços customizados, tentar extrair de data.url ou data.public_url
    if (data.url) return data.url;
    if (data.public_url) return data.public_url;

    return null;
  }

  /**
   * Avalia a transformação da URL (suporta string template)
   */
  evaluateTransform(transform, url) {
    if (typeof transform === 'function') {
      return transform(url);
    }

    if (typeof transform === 'string') {
      // Substituir {{url}} pelo valor real
      return transform.replace(/\{\{url\}\}/g, url);
    }

    return url;
  }

  /**
   * Atualiza arquivo .env com nova variável
   */
  async updateEnvFile(filePath, varName, value, environment) {
    try {
      let content = '';

      // Tentar ler arquivo existente
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (e) {
        // Arquivo não existe, será criado
      }

      const lines = content.split('\n');
      const newLines = [];
      let variableUpdated = false;

      // Processar cada linha
      for (const line of lines) {
        const trimmed = line.trim();

        // Preservar comentários e linhas vazias
        if (!trimmed || trimmed.startsWith('#')) {
          newLines.push(line);
          continue;
        }

        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();

          // Se encontrar a variável, atualizar
          if (key === varName) {
            newLines.push(`${varName}=${value}`);
            variableUpdated = true;
          } else {
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      }

      // Se variável não existia, adicionar no final
      if (!variableUpdated) {
        newLines.push('');
        newLines.push(`# Atualizado automaticamente pelo SoftwareLauncher`);
        newLines.push(`${varName}=${value}`);
      }

      // Escrever de volta
      await fs.writeFile(filePath, newLines.join('\n'), 'utf-8');

      return { success: true };
    } catch (error) {
      this.sendLog('system', `❌ Erro ao atualizar .env: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Para monitoramento de um serviço
   */
  stopMonitoring(monitorId) {
    if (this.activeMonitors.has(monitorId)) {
      this.activeMonitors.delete(monitorId);
    }
  }

  /**
   * Para todos os monitores de um projeto
   */
  stopProjectMonitors(projectId) {
    const monitorsToStop = [];

    for (const monitorId of this.activeMonitors.keys()) {
      if (monitorId.startsWith(`${projectId}-`)) {
        monitorsToStop.push(monitorId);
      }
    }

    monitorsToStop.forEach(id => this.stopMonitoring(id));
  }

  /**
   * Envia log para o console do frontend
   */
  sendLog(taskName, message) {
    this.mainWindow.webContents.send('process-output', {
      taskName: taskName,
      type: 'system',
      data: message
    });
  }

  /**
   * Utilitário para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ServiceMonitor;
