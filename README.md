# Software Launcher

<div align="center">

**Automatize a inicialização dos seus projetos de desenvolvimento com um único clique**

![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

## 📋 Sobre

Software Launcher é uma aplicação desktop moderna e minimalista construída com Electron que permite automatizar completamente o processo de inicialização dos seus projetos de desenvolvimento.

Cansado de abrir múltiplos terminais, navegar para diferentes diretórios e executar comandos repetitivos toda vez que inicia seu projeto? O Software Launcher resolve isso!

### ✨ Características Principais

- **Execução com Um Clique**: Lance múltiplas tarefas simultaneamente com apenas um clique
- **Configuração Dinâmica**: Configure quantos projetos quiser, cada um com suas próprias tarefas
- **Múltiplos Terminais**: Execute comandos em diferentes diretórios ao mesmo tempo
- **Variáveis de Ambiente**: Configure variáveis de ambiente globais e por tarefa
- **Interface Minimalista**: Design moderno e limpo, fácil de usar
- **Monitoramento em Tempo Real**: Veja a saída de todos os processos em um console unificado
- **Persistência**: Suas configurações são salvas automaticamente

## 🚀 Como Usar

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/software-launcher.git
cd software-launcher
```

2. Instale as dependências:
```bash
npm install
```

3. Execute a aplicação:
```bash
npm start
```

### Criando Seu Primeiro Projeto

1. **Clique em "Novo Projeto"** na sidebar

2. **Configure as Informações Básicas**:
   - Nome do Projeto (ex: "Meu App Full Stack")
   - Descrição (opcional)

3. **Adicione Tarefas**:
   - Clique em "Adicionar Tarefa"
   - Configure cada tarefa:
     - **Nome**: Frontend, Backend, Database, etc.
     - **Comando**: `yarn dev`, `npm start`, `docker-compose up`, etc.
     - **Diretório**: Selecione a pasta onde o comando será executado

4. **Configure Variáveis de Ambiente** (opcional):
   - Adicione variáveis globais que serão aplicadas a todas as tarefas
   - Exemplos: `NODE_ENV=development`, `PORT=3000`

5. **Salve e Execute**:
   - Clique em "Salvar Projeto"
   - Selecione o projeto na sidebar
   - Clique em "Executar"

### Exemplo de Configuração

#### Projeto Full Stack com React + Node.js

**Tarefa 1 - Frontend**:
- Nome: `Frontend`
- Comando: `yarn dev`
- Diretório: `C:\projetos\meu-app\frontend`

**Tarefa 2 - Backend**:
- Nome: `Backend`
- Comando: `yarn dev`
- Diretório: `C:\projetos\meu-app\backend`

**Variáveis de Ambiente**:
- `NODE_ENV=development`
- `DEBUG=true`

## 🎯 Casos de Uso

### Desenvolvimento Full Stack
Execute frontend, backend e banco de dados simultaneamente:
```
Frontend: yarn dev (pasta ./frontend)
Backend: npm run dev (pasta ./backend)
Database: docker-compose up (pasta ./docker)
```

### Microserviços
Inicie múltiplos serviços de uma vez:
```
Auth Service: npm start (pasta ./services/auth)
API Gateway: npm start (pasta ./services/gateway)
Payment Service: npm start (pasta ./services/payment)
```

### Ambiente de Desenvolvimento Completo
```
App: yarn dev
Storybook: yarn storybook
API Mock: json-server --watch db.json
Tests: yarn test --watch
```

## 🛠️ Build para Produção

### Windows
```bash
npm run build:win
```

### Linux
```bash
npm run build:linux
```

### macOS
```bash
npm run build:mac
```

Os executáveis serão gerados na pasta `dist/`.

## 📁 Estrutura do Projeto

```
software-launcher/
├── main.js              # Processo principal do Electron
├── renderer.js          # Lógica da interface
├── index.html           # Interface HTML
├── styles.css           # Estilos
├── package.json         # Configurações e dependências
├── assets/              # Ícones e recursos
└── README.md            # Documentação
```

## 🔧 Desenvolvimento

### Modo de Desenvolvimento
```bash
npm run dev
```

Isso abrirá a aplicação com as DevTools habilitadas.

### Estrutura de Dados

Os projetos são salvos em JSON no diretório de dados do usuário:

```json
{
  "id": "unique-id",
  "name": "Meu Projeto",
  "description": "Descrição do projeto",
  "tasks": [
    {
      "name": "Frontend",
      "command": "yarn dev",
      "workingDirectory": "/path/to/frontend",
      "environmentVariables": {}
    }
  ],
  "environmentVariables": {
    "NODE_ENV": "development"
  }
}
```

## 🎨 Customização

### Cores e Tema

Edite as variáveis CSS em `styles.css`:

```css
:root {
  --bg-primary: #1a1a1a;
  --accent: #6366f1;
  /* ... outras variáveis */
}
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abrir um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🐛 Problemas Conhecidos

- No Windows, ao parar processos, pode ser necessário aguardar alguns segundos para que todos os subprocessos sejam encerrados

## 💡 Roadmap

- [ ] Suporte para agendamento de tarefas
- [ ] Templates de projetos pré-configurados
- [ ] Temas personalizáveis
- [ ] Exportar/Importar configurações
- [ ] Logs persistentes
- [ ] Notificações de sistema
- [ ] Suporte para scripts customizados pré/pós execução

## 📧 Contato

Para dúvidas ou sugestões, abra uma issue no GitHub.

---

<div align="center">
Feito com ❤️ usando Electron
</div>
