const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Detector de serviços conhecidos (ngrok, cloudflared, etc)
 * Auto-configura monitoramento baseado no comando da task
 */
class ServiceDetector {
  /**
   * Verifica se um executável está disponível no PATH do sistema
   */
  static async isAvailable(command) {
    try {
      const checkCommand = process.platform === 'win32'
        ? `where ${command}`
        : `which ${command}`;

      await execAsync(checkCommand);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Auto-detecta configuração de monitoramento baseado no comando
   */
  static async detectMonitoring(command) {
    // Normalizar comando para lowercase para facilitar detecção
    const cmdLower = command.toLowerCase();

    // Detectar Ngrok
    if (cmdLower.includes('ngrok') && cmdLower.includes('http')) {
      return await this.detectNgrok(command);
    }

    // Detectar Cloudflared
    if (cmdLower.includes('cloudflared') && cmdLower.includes('tunnel')) {
      return await this.detectCloudflared(command);
    }

    // Serviço não reconhecido
    return {
      available: false,
      service: null,
      config: null
    };
  }

  /**
   * Detecta e configura Ngrok
   */
  static async detectNgrok(command) {
    const isInstalled = await this.isAvailable('ngrok');

    if (!isInstalled) {
      return {
        available: false,
        service: 'ngrok',
        config: null,
        warning: 'Ngrok não encontrado no PATH do sistema. Instale o ngrok para usar esta funcionalidade.'
      };
    }

    // Extrair porta do comando (ex: "ngrok http 3000" -> porta 3000)
    const portMatch = command.match(/ngrok\s+http\s+(\d+)/i);
    const port = portMatch ? portMatch[1] : '3000';

    return {
      available: true,
      service: 'ngrok',
      config: {
        enabled: true, // Ativado por padrão se detectado
        type: 'ngrok',
        apiUrl: 'http://localhost:4040/api/tunnels',
        envVarToUpdate: 'WEBHOOK_URL',
        urlTransform: '{{url}}/v1/webhook', // Template string
        timeout: {
          maxAttempts: 15,
          intervalMs: 2000
        },
        metadata: {
          port: port,
          description: `Túnel ngrok na porta ${port}`
        }
      }
    };
  }

  /**
   * Detecta e configura Cloudflared
   */
  static async detectCloudflared(command) {
    const isInstalled = await this.isAvailable('cloudflared');

    if (!isInstalled) {
      return {
        available: false,
        service: 'cloudflared',
        config: null,
        warning: 'Cloudflared não encontrado no PATH do sistema. Instale o cloudflared para usar esta funcionalidade.'
      };
    }

    // Cloudflared não tem API HTTP simples como ngrok
    // Precisaria parsear logs ou usar cloudflared-api
    // Por enquanto, vamos marcar como disponível mas sem auto-config
    return {
      available: true,
      service: 'cloudflared',
      config: {
        enabled: false, // Desabilitado por padrão (requer config manual)
        type: 'cloudflared',
        apiUrl: null, // Cloudflared não tem API local padrão
        envVarToUpdate: 'CLOUDFLARE_URL',
        urlTransform: '{{url}}',
        timeout: {
          maxAttempts: 20,
          intervalMs: 3000
        },
        metadata: {
          description: 'Túnel Cloudflare (configuração manual necessária)'
        }
      },
      warning: 'Cloudflared detectado, mas configuração automática não está disponível. Configure manualmente se necessário.'
    };
  }

  /**
   * Retorna lista de todos os serviços suportados
   */
  static getSupportedServices() {
    return [
      {
        name: 'ngrok',
        displayName: 'Ngrok',
        description: 'Túnel HTTP/HTTPS com URL pública',
        commands: ['ngrok http', 'ngrok.exe http'],
        autoDetect: true
      },
      {
        name: 'cloudflared',
        displayName: 'Cloudflare Tunnel',
        description: 'Túnel Cloudflare com URL pública',
        commands: ['cloudflared tunnel', 'cloudflared.exe tunnel'],
        autoDetect: false // Requer configuração manual
      }
    ];
  }

  /**
   * Valida configuração de monitoramento
   */
  static validateConfig(config) {
    if (!config) return { valid: false, error: 'Configuração vazia' };

    const required = ['type', 'apiUrl', 'timeout'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Campos obrigatórios ausentes: ${missing.join(', ')}`
      };
    }

    if (!config.timeout.maxAttempts || !config.timeout.intervalMs) {
      return {
        valid: false,
        error: 'Timeout deve ter maxAttempts e intervalMs'
      };
    }

    return { valid: true };
  }
}

module.exports = ServiceDetector;
