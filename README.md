# Software Launcher

<div align="center">

**Gerencie e execute múltiplos processos de desenvolvimento com um único clique**

![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

## 📋 Sobre

Software Launcher é uma aplicação desktop que automatiza a inicialização de projetos de desenvolvimento. Execute frontend, backend, bancos de dados e serviços auxiliares simultaneamente com um único clique.

### ✨ Recursos

- **Execução Simultânea**: Lance múltiplas tarefas ao mesmo tempo
- **Console Integrado**: Monitore logs de todos os processos em tempo real
- **Gestão de Ambientes**: Configure variáveis de ambiente globais e por tarefa
- **Monitoramento de Serviços**: Captura automática de URLs do ngrok e cloudflared
- **Seleção de Arquivos .env**: Carregue variáveis de ambiente de arquivos específicos
- **Interface Moderna**: Design responsivo com tema escuro/claro
- **Persistência Local**: Configurações salvas automaticamente
- **Multi-idioma**: Suporte para PT-BR, EN, ES, FR e ZH
- **Análise IA com Gemini**: Configure sua própria API Key e analise projetos automaticamente

### 🎯 Sistema de Monitoramento

O Software Launcher detecta automaticamente serviços como **ngrok** e **cloudflared** e captura suas URLs públicas:

- **Auto-detecção**: Botão 🔍 identifica o serviço no comando
- **Polling Inteligente**: Monitora APIs locais até capturar a URL (30s timeout)
- **Atualização de .env**: Atualiza automaticamente variáveis como `WEBHOOK_URL`
- **Transformações**: Aplica sufixos personalizados (ex: `{{url}}/v1/webhook`)
- **Notificações**: Exibe URLs capturadas na interface

#### Serviços Suportados

| Serviço | API Local | Detecção Automática |
|---------|-----------|---------------------|
| ngrok | `http://localhost:4040/api/tunnels` | ✅ |
| cloudflared | `http://localhost:4040/metrics` | ✅ |

## 🚀 Início Rápido

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/software-launcher.git
cd software-launcher

# Instale as dependências
npm install

# Execute em desenvolvimento
npm run dev
```

### Primeiro Projeto

1. Clique em **"Novo Projeto"**
2. Adicione suas tarefas (Frontend, Backend, etc.)
3. Configure diretórios de trabalho
4. Selecione arquivos `.env` (opcional)
5. Para ngrok/cloudflared:
   - Digite o comando (ex: `ngrok http 3000`)
   - Clique em **🔍** para auto-detectar
   - Ative o monitoramento
6. Clique em **"Salvar"** e depois em **"Executar"**

Veja o [Guia de Início Rápido](QUICKSTART.md) para um exemplo completo.

## 📦 Stack Tecnológica

- **Electron** - Framework desktop cross-platform
- **React 18 + TypeScript** - Interface tipada
- **Vite** - Build tool
- **shadcn/ui** - Componentes UI
- **Tailwind CSS** - Estilização
- **i18next** - Internacionalização
- **axios** - Cliente HTTP para monitoramento

## 🛠️ Build

```bash
# Windows
npm run build:win

# Linux
npm run build:linux

# macOS
npm run build:mac
```

Os executáveis serão gerados em `dist/`.

## 📁 Estrutura

```
SoftwareLauncher/
├── electron/
│   ├── main.js              # Processo principal
│   ├── serviceMonitor.js    # Monitoramento de serviços
│   └── serviceDetector.js   # Auto-detecção de serviços
├── src/
│   ├── App.tsx              # Interface principal
│   ├── components/          # Componentes React
│   └── i18n/                # Traduções
├── assets/                  # Ícones
└── package.json
```

## 🎨 Casos de Uso

### Full Stack (Frontend + Backend + Ngrok)

```yaml
Projeto: Alpha Force BR
├── Task 1: Frontend
│   Comando: cd frontend && yarn dev
│   .env: frontend/.env
│
├── Task 2: Backend
│   Comando: cd backend && yarn dev
│   .env: backend/.env
│
└── Task 3: Ngrok Tunnel [🔍 Monitoramento Ativo]
    Comando: ngrok http 3000
    .env: backend/.env
    Monitora: http://localhost:4040/api/tunnels
    Atualiza: WEBHOOK_URL
    Transforma: {{url}}/v1/webhook
```

### Microserviços

```yaml
Projeto: Sistema de Microserviços
├── Auth Service: npm start (./services/auth)
├── API Gateway: npm start (./services/gateway)
└── Payment: npm start (./services/payment)
```

## ⚙️ Configuração

### Gemini API Key (Análise de Projetos com IA)

Para usar a análise automática de projetos com IA:

1. Clique no ícone de **Configurações** (⚙️) na sidebar
2. Cole sua [Gemini API Key gratuita](https://makersuite.google.com/app/apikey)
3. Clique em **Salvar**

A API Key é armazenada localmente no seu navegador e nunca é enviada para servidores externos (apenas para a API do Google Gemini).

### Variáveis de Ambiente

**Globais** (aplicadas a todas as tasks):
```
NODE_ENV=development
DEBUG=true
```

**Por Arquivo .env** (específicas de cada task):
- Selecione o arquivo `.env` desejado
- Variáveis são carregadas automaticamente

### Monitoramento de Serviços

Para configurar manualmente:

```json
{
  "monitoring": {
    "enabled": true,
    "type": "ngrok",
    "apiUrl": "http://localhost:4040/api/tunnels",
    "envVarToUpdate": "WEBHOOK_URL",
    "urlTransform": "{{url}}/v1/webhook",
    "timeout": {
      "maxAttempts": 15,
      "intervalMs": 2000
    }
  }
}
```

## 🔧 Desenvolvimento

### Modo Debug

Execute `npm run dev` para carregar projetos mock automaticamente.

### Estrutura de Dados

Projetos são salvos em JSON:

```json
{
  "id": "uuid",
  "name": "Meu Projeto",
  "description": "Descrição",
  "tasks": [
    {
      "name": "Backend",
      "command": "yarn dev",
      "workingDirectory": "/path/to/backend",
      "envFilePath": "/path/to/.env",
      "monitoring": {
        "enabled": true,
        "type": "ngrok",
        "apiUrl": "http://localhost:4040/api/tunnels",
        "envVarToUpdate": "WEBHOOK_URL",
        "urlTransform": "{{url}}/v1/webhook"
      }
    }
  ],
  "environmentVariables": {
    "NODE_ENV": "development"
  }
}
```

## 🤝 Contribuindo

1. Faça um Fork
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit (`git commit -m 'Adiciona MinhaFeature'`)
4. Push (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🐛 Problemas Conhecidos

- **Windows**: Processos podem levar alguns segundos para encerrar
- **Linux**: Requer permissões de execução para alguns comandos
- **macOS**: Pode solicitar permissões de acessibilidade

## 💡 Roadmap

- [x] Monitoramento de ngrok/cloudflared
- [x] Auto-detecção de serviços
- [x] Seleção de arquivos .env
- [ ] Templates de projetos
- [ ] Temas personalizáveis
- [ ] Exportar/Importar configurações
- [ ] Logs persistentes
- [ ] Notificações de sistema
- [ ] Scripts pré/pós execução
- [ ] Suporte para Docker Compose
- [ ] Health checks de serviços

---

<div align="center">
Desenvolvido com Electron + React + TypeScript
</div>
