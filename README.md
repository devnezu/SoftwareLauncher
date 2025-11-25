# Software Launcher

<div align="center">

**🚀 Gerencie e execute múltiplos processos de desenvolvimento com controle total**

![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

</div>

---

## 📋 Sobre

**Software Launcher** é uma aplicação desktop profissional que automatiza e centraliza o gerenciamento de ambientes de desenvolvimento complexos. Execute frontend, backend, workers, bancos de dados e serviços auxiliares simultaneamente com um único clique, monitorando performance, saúde dos serviços e logs em tempo real.

### 🎯 Problema Resolvido

Elimina a necessidade de:
- Abrir múltiplas janelas de terminal manualmente
- Memorizar comandos complexos para cada serviço
- Monitorar logs em várias janelas diferentes
- Configurar variáveis de ambiente repetidamente
- Verificar manualmente se serviços estão funcionando

---

## ✨ Funcionalidades Principais

### 🔧 Gerenciamento de Processos

- ✅ **Execução Simultânea**: Lance todos os serviços do seu projeto com 1 clique
- ✅ **Controle Individual**: Start, Stop e Restart de cada task independentemente
- ✅ **Modo Interno/Externo**:
  - **Interno**: Console integrado com captura de output
  - **Externo**: Abre terminal nativo do sistema operacional
- ✅ **Auto-Restart**: Reinicialização automática em caso de falha
- ✅ **Gerenciamento Cross-Platform**: Windows, macOS e Linux

### 📊 Monitoramento em Tempo Real

- ✅ **Performance Metrics**:
  - CPU e RAM por projeto (atualização a cada 2s)
  - Histórico de performance com persistência em disco
  - Gráficos visuais de consumo de recursos
  - Alertas configuráveis (CPU > 80%, RAM > 500MB)

- ✅ **Health Checks**:
  - Monitoramento HTTP/HTTPS de endpoints
  - Intervalos configuráveis (padrão: 30s)
  - Retry automático com contadores
  - Auto-restart em caso de falha
  - Indicadores visuais de saúde (healthy/degraded/unhealthy)
  - Notificações desktop para falhas críticas

### 🖥️ Console Integrado

- ✅ **Output em Tempo Real**: stdout/stderr de todos os processos
- ✅ **Suporte ANSI**: Cores, negrito, itálico e outros códigos de terminal
- ✅ **Filtros por Task**: Visualize logs individuais ou todos juntos
- ✅ **Auto-Scroll**: Acompanhamento automático de novas mensagens
- ✅ **Timestamps**: Horário de cada log para debugging
- ✅ **Limpeza de Console**: Botão para limpar histórico
- ✅ **Buffer Inteligente**: Limita a 1000 linhas para otimização

### 🤖 Análise com IA (Google Gemini)

- ✅ **Auto-Discovery**: Escaneia diretórios e detecta package.json
- ✅ **Geração Automática de Tasks**: Analisa scripts npm/yarn
- ✅ **Configuração Inteligente**: Sugere health checks para servidores
- ✅ **Detecção de Portas**: Identifica portas usadas pelos serviços
- ✅ **Filtragem Smart**: Ignora scripts de test, lint e build

### 🎨 Interface Moderna

- ✅ **Design Premium**: Tema dark profissional com Tailwind CSS
- ✅ **Ícones Customizáveis**: Escolha entre 50+ ícones (Lucide)
- ✅ **Responsivo**: Layout adaptável a diferentes resoluções
- ✅ **Animações Suaves**: Transições e feedbacks visuais
- ✅ **Frameless Window**: Controles de janela customizados
- ✅ **Status em Tempo Real**: Indicadores visuais de execução

### 🌍 Internacionalização

- ✅ Português (Brasil)
- ✅ English
- ✅ Español
- ✅ Français
- ✅ 中文 (Chinês)

---

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 16+
- npm ou yarn
- Git

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/software-launcher.git
cd software-launcher

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm run dev
```

### Criando Seu Primeiro Projeto

1. **Clique em "New Project"** no canto superior esquerdo
2. **Configure o projeto**:
   - Nome do projeto
   - Descrição (opcional)
   - Escolha um ícone
3. **Adicione Tasks**:
   - Nome da task (ex: "Backend API")
   - Comando (ex: `npm run dev`)
   - Diretório de trabalho
   - Modo de execução (Interno/Externo)
   - Ícone personalizado
4. **Configure Health Check** (opcional):
   - URL do endpoint (ex: `http://localhost:3000/health`)
   - Intervalo de verificação
   - Auto-restart em falha
5. **Salve e Execute**: Clique em "Launch Project"

### Ou Use IA para Auto-Configuração!

1. Clique em "New Project"
2. Clique em **"Auto-Scan"** (🔍 Scan Directory)
3. Selecione a pasta raiz do seu projeto
4. Aguarde a IA analisar e configurar automaticamente
5. Revise as tasks geradas e clique em "Save"

---

## 📦 Stack Tecnológica

### Frontend
- **React 18.2** - UI framework com hooks
- **TypeScript 5.3** - Type safety
- **Vite 5.0** - Build tool e dev server ultra-rápido
- **Tailwind CSS 3.4** - Utility-first styling
- **Radix UI** - Componentes acessíveis (Dialog, ScrollArea)
- **shadcn/ui** - Biblioteca de componentes premium
- **Lucide React** - 50+ ícones modernos
- **Recharts** - Gráficos de performance

### Backend/Electron
- **Electron 28.0** - Framework desktop cross-platform
- **pidusage** - Monitoramento de CPU/RAM
- **Google Generative AI** - Integração com Gemini
- **child_process** - Gerenciamento de processos
- **fs.promises** - Operações assíncronas de arquivos

### Build Tools
- **electron-builder** - Empacotamento de aplicação
- **PostCSS** - Processamento de CSS
- **TypeScript Compiler** - Compilação e type checking

---

## 🏗️ Arquitetura do Projeto

```
Software Launcher/
├── electron/                           # Processo Principal Electron
│   ├── main.js                        # Entry point, IPC handlers
│   ├── performanceMonitor.js          # Sistema de monitoramento CPU/RAM
│   ├── healthCheckMonitor.js          # Sistema de health checks HTTP
│   └── geminiService.js               # Integração com Google Gemini
│
├── src/                               # Renderer Process (React)
│   ├── App.tsx                       # Componente principal
│   ├── main.tsx                      # Entry point React
│   ├── index.css                     # Estilos globais + Tailwind
│   │
│   ├── components/
│   │   ├── Home.tsx                  # Dashboard inicial
│   │   ├── Sidebar.tsx               # Navegação de projetos
│   │   ├── TitleBar.tsx              # Barra de título customizada
│   │   ├── AnsiText.tsx              # Parser de códigos ANSI
│   │   ├── IconManager.tsx           # Sistema de ícones dinâmicos
│   │   ├── ContextMenu.tsx           # Menu de contexto
│   │   ├── PerformancePanel.tsx      # Painel de métricas
│   │   ├── HealthCheckPanel.tsx      # Painel de saúde
│   │   └── ui/                       # Componentes base (shadcn/ui)
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── scroll-area.tsx
│   │       └── textarea.tsx
│   │
│   ├── i18n/                         # Internacionalização
│   │   ├── LanguageContext.tsx
│   │   └── translations.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── index.ts                  # Project, Task, ConsoleLog
│   │   └── electron.d.ts             # Declarações Electron
│   │
│   └── lib/
│       └── utils.ts                  # Funções utilitárias (cn, etc.)
│
├── assets/                            # Assets da aplicação
│   ├── icon.png
│   ├── icon.ico                      # Windows
│   └── icon.icns                     # macOS
│
├── dist/                              # Executáveis compilados
├── dist-electron/                     # Electron transpilado
│
├── package.json                       # Dependências e scripts
├── vite.config.js                    # Configuração Vite
├── tailwind.config.js                # Configuração Tailwind
├── tsconfig.json                     # Configuração TypeScript
├── electron-builder.json5            # Configuração de build
│
└── README.md                          # Este arquivo
```

---

## 🔧 Build e Distribuição

### Desenvolvimento

```bash
npm run dev
```

Inicia o servidor Vite em porta aleatória (3000-9000) e o Electron em modo watch.

### Produção

```bash
# Build para Windows
npm run build:win      # Gera NSIS installer

# Build para Linux
npm run build:linux    # Gera AppImage

# Build para macOS
npm run build:mac      # Gera DMG
```

**Saída**: `dist/` contém os instaladores.

---

## 💡 Casos de Uso

### 1. Full Stack Development

```yaml
Projeto: E-Commerce Platform
Icon: ShoppingCart

Tasks:
  - Frontend (React):
      Command: cd frontend && npm run dev
      Directory: /projeto/frontend
      Mode: Internal
      Icon: Monitor
      Health Check: http://localhost:5173

  - Backend API (Node.js):
      Command: npm run dev
      Directory: /projeto/backend
      Mode: Internal
      Icon: Server
      Health Check: http://localhost:3000/api/health

  - Database (PostgreSQL):
      Command: docker compose up postgres
      Directory: /projeto
      Mode: External
      Icon: Database
```

### 2. Microserviços com Workers

```yaml
Projeto: Payment System
Icon: CreditCard

Tasks:
  - Auth Service:
      Command: npm start
      Directory: /services/auth
      Health Check: http://localhost:4000/health

  - Payment Gateway:
      Command: npm start
      Directory: /services/payment
      Health Check: http://localhost:4001/health

  - Email Worker:
      Command: ts-node-dev src/worker.ts
      Directory: /workers/email
      Mode: Internal
      Icon: Mail

  - Notification Worker:
      Command: ts-node-dev src/worker.ts
      Directory: /workers/notifications
      Mode: Internal
      Icon: Bell
```

### 3. Desenvolvimento com Tunneling

```yaml
Projeto: Webhook Testing
Icon: Webhook

Tasks:
  - Backend:
      Command: npm run dev
      Directory: /backend
      Health Check: http://localhost:3333/health

  - Ngrok Tunnel:
      Command: ngrok http 3333
      Mode: External
      Icon: Globe
```

---

## ⚙️ Configuração Avançada

### Estrutura de Dados (projects.json)

```json
{
  "id": "1234567890",
  "name": "My Full Stack App",
  "description": "React frontend + Node.js backend",
  "icon": "Rocket",
  "tasks": [
    {
      "name": "Backend API",
      "command": "npm run dev",
      "workingDirectory": "/path/to/backend",
      "executionMode": "internal",
      "icon": "Server",
      "healthCheck": {
        "enabled": true,
        "url": "http://localhost:3000/health",
        "interval": 30000,
        "timeout": 5000,
        "retries": 3,
        "autoRestart": true
      }
    }
  ]
}
```

### Variáveis de Ambiente

**Globais** (aplicam a todas as tasks):
```bash
NODE_ENV=development
DEBUG=true
```

**Por Task** (usando .env files):
```bash
DATABASE_URL=postgresql://localhost:5432/mydb
JWT_SECRET=supersecret
```

### Health Check Configuração

| Propriedade | Tipo | Padrão | Descrição |
|------------|------|--------|-----------|
| `enabled` | boolean | false | Ativa health check |
| `url` | string | - | Endpoint HTTP/HTTPS |
| `interval` | number | 30000 | Intervalo entre checks (ms) |
| `timeout` | number | 5000 | Timeout da requisição (ms) |
| `retries` | number | 3 | Tentativas antes de marcar unhealthy |
| `autoRestart` | boolean | true | Reinicia automaticamente em falha |

### Performance Monitor

- Coleta métricas a cada **2 segundos**
- Armazena histórico em `userData/performance-history/`
- Formato: `{projectId}-YYYY-MM.json`
- Limite: 50.000 entradas por mês (~2 meses de dados)
- Alertas:
  - ⚠️ Warning: CPU > 80%, RAM > 500MB
  - 🚨 Critical: CPU > 95%, RAM > 1GB
- Cooldown de notificações: 5 minutos

---

## 🔐 Segurança e Privacidade

- ✅ Dados armazenados localmente (sem cloud)
- ✅ Gemini API Key em localStorage (nunca enviada para terceiros)
- ✅ Configurações em `userData` do sistema operacional
- ⚠️ `nodeIntegration: true` e `contextIsolation: false` (necessário para IPC)
- ⚠️ `webSecurity: false` (permite acesso a arquivos locais)

### Localização dos Dados

| OS | Caminho |
|----|---------|
| Windows | `C:\Users\{User}\AppData\Roaming\software-launcher\` |
| macOS | `~/Library/Application Support/software-launcher/` |
| Linux | `~/.config/software-launcher/` |

**Arquivos**:
- `projects.json` - Configurações de projetos
- `performance-history/` - Histórico de métricas
- `session.json` - Estado da sessão (running projects)

---

## 🛠️ Desenvolvimento

### Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build de produção
npm run build:win    # Build Windows (NSIS)
npm run build:linux  # Build Linux (AppImage)
npm run build:mac    # Build macOS (DMG)
npm run preview      # Preview do build
```

### Arquitetura IPC

**Main → Renderer (Events)**:
- `process-output` - Stdout/stderr de processos
- `process-closed` - Processo encerrado
- `performance-metrics` - Métricas de CPU/RAM
- `health-check-status` - Status de health check

**Renderer → Main (Handlers)**:
- `launch-project` - Inicia todas as tasks
- `stop-project` - Para todas as tasks
- `start-task` - Inicia task individual
- `stop-task` - Para task individual
- `restart-task` - Reinicia task
- `analyze-project-with-ai` - Análise com Gemini
- `load-projects` / `save-projects` - Persistência

### Debugging

1. Console do Electron: `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Option+I` (macOS)
2. Logs do Main Process: Terminal onde executou `npm run dev`
3. Network tab: Verifica chamadas HTTP dos health checks

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Guidelines

- Use TypeScript para novos códigos
- Siga os padrões do ESLint
- Adicione testes quando possível
- Atualize a documentação

---

## 🐛 Problemas Conhecidos

| Issue | Plataforma | Workaround |
|-------|-----------|------------|
| Processos demoram para encerrar | Windows | Aguardar 3-5s ou usar Task Manager |
| Permissões de execução | Linux | `chmod +x` nos scripts |
| Solicitação de permissões | macOS | Aprovar nas Configurações de Segurança |
| ANSI codes visíveis | Todos | AnsiText já filtra a maioria |

---

## 📝 Roadmap

### ✅ Implementado

- [x] Controle individual de tasks
- [x] Performance monitoring com histórico
- [x] Health checks HTTP com auto-restart
- [x] Análise com IA (Gemini)
- [x] Ícones customizáveis
- [x] Modo interno/externo
- [x] Console com suporte ANSI
- [x] Notificações desktop
- [x] Multi-idioma (i18n)
- [x] Persistência de sessão

### 🚧 Planejado

- [ ] Templates de projetos (Full Stack, Microservices, etc.)
- [ ] Temas personalizáveis (Light mode, cores customizadas)
- [ ] Export/Import de configurações (JSON, YAML)
- [ ] Logs persistentes em arquivo
- [ ] Scripts pré/pós execução (hooks)
- [ ] Suporte nativo para Docker Compose
- [ ] Health checks avançados (TCP, Database, gRPC)
- [ ] Agendamento de execução (cron-like)
- [ ] Métricas de rede (bandwidth usage)
- [ ] Integração com Git (branch, commit info)

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🙏 Agradecimentos

- [Electron](https://www.electronjs.org/) - Framework desktop
- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icon set
- [Google Gemini](https://ai.google.dev/) - AI integration

---

## 📧 Contato

Para dúvidas, sugestões ou reportar bugs:

- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/software-launcher/issues)
- 💬 Discussões: [GitHub Discussions](https://github.com/seu-usuario/software-launcher/discussions)

---

<div align="center">

**Desenvolvido com ❤️ usando Electron + React + TypeScript**

[![Star on GitHub](https://img.shields.io/github/stars/seu-usuario/software-launcher?style=social)](https://github.com/seu-usuario/software-launcher)
[![Fork on GitHub](https://img.shields.io/github/forks/seu-usuario/software-launcher?style=social)](https://github.com/seu-usuario/software-launcher/fork)

</div>
