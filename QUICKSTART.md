# Guia de Início Rápido - Software Launcher

## ⚡ Instalação e Primeiro Uso (5 minutos)

### 1. Instalar Dependências

```bash
npm install
```

### 2. Executar a Aplicação

```bash
npm start
```

Pronto! A aplicação será aberta.

## 🎯 Criando Seu Primeiro Projeto

### Exemplo: Projeto Full Stack React + Node.js

Vamos configurar um projeto que inicia frontend e backend automaticamente.

#### Passo 1: Criar Novo Projeto

1. Clique no botão **"Novo Projeto"** (botão roxo na sidebar)

#### Passo 2: Informações Básicas

- **Nome**: `Meu App Full Stack`
- **Descrição**: `Frontend React + Backend Node.js`

#### Passo 3: Adicionar Tarefa do Frontend

1. Clique em **"Adicionar Tarefa"**
2. Preencha:
   - **Nome**: `Frontend`
   - **Comando**: `yarn dev` (ou `npm run dev`)
   - **Diretório**: Clique em "Selecionar" e escolha a pasta do frontend
     - Exemplo: `C:\projetos\meu-app\frontend`

#### Passo 4: Adicionar Tarefa do Backend

1. Clique em **"Adicionar Tarefa"** novamente
2. Preencha:
   - **Nome**: `Backend`
   - **Comando**: `yarn dev` (ou `npm run dev`)
   - **Diretório**: Clique em "Selecionar" e escolha a pasta do backend
     - Exemplo: `C:\projetos\meu-app\backend`

#### Passo 5: Variáveis de Ambiente (Opcional)

Se quiser adicionar variáveis de ambiente globais:

1. Clique em **"Adicionar Variável"**
2. Preencha:
   - **Nome**: `NODE_ENV`
   - **Valor**: `development`

#### Passo 6: Salvar

Clique em **"Salvar Projeto"**

#### Passo 7: Executar! 🚀

1. Clique no projeto na sidebar
2. Clique no botão **"Executar"**
3. Veja ambos os servidores iniciando no console!

## 📊 Visualização do Console

O console mostrará a saída de todas as tarefas em tempo real:

```
[Frontend] Servidor iniciado em http://localhost:3000
[Backend] API rodando em http://localhost:5000
```

## 🛑 Parar o Projeto

Clique no botão **"Parar"** para encerrar todos os processos de uma vez.

## 💡 Dicas Rápidas

### Comandos Comuns

| Tipo de Projeto | Comando Usual |
|----------------|---------------|
| React (Vite) | `npm run dev` |
| React (CRA) | `npm start` |
| Next.js | `npm run dev` |
| Node.js | `npm run dev` ou `node index.js` |
| Python | `python app.py` |
| Docker | `docker-compose up` |

### Variáveis de Ambiente Úteis

| Variável | Uso | Exemplo |
|----------|-----|---------|
| `NODE_ENV` | Ambiente Node.js | `development` |
| `PORT` | Porta do servidor | `3000` |
| `DEBUG` | Logs detalhados | `true` |
| `API_URL` | URL da API | `http://localhost:5000` |

## 🔧 Editando Projetos

1. Selecione o projeto na sidebar
2. Clique em **"Editar"**
3. Faça as alterações necessárias
4. Clique em **"Salvar Projeto"**

## 🗑️ Excluindo Projetos

1. Selecione o projeto na sidebar
2. Clique em **"Excluir"**
3. Confirme a exclusão

## 🎨 Múltiplos Projetos

Você pode criar quantos projetos quiser! Exemplos:

- **Projeto 1**: E-commerce (Frontend + Backend + Database)
- **Projeto 2**: Blog (Next.js + Strapi)
- **Projeto 3**: Dashboard (React + Python API)

Cada projeto mantém suas configurações independentes.

## 🚨 Solução de Problemas

### O comando não está sendo executado

- ✅ Verifique se o caminho do diretório está correto
- ✅ Verifique se o comando é válido naquele diretório
- ✅ Tente executar o comando manualmente no terminal primeiro

### O processo não para corretamente

- No Windows, alguns processos podem levar alguns segundos para encerrar completamente
- Você pode fechar a aplicação que todos os processos serão encerrados automaticamente

### Caracteres estranhos no console

- Isso pode acontecer com alguns frameworks que usam cores no terminal
- A saída ainda é funcional, apenas a formatação pode ficar diferente

## 📚 Próximos Passos

Agora que você criou seu primeiro projeto, explore:

- Adicionar mais tarefas ao projeto
- Configurar variáveis de ambiente específicas
- Criar projetos para diferentes ambientes (dev, staging, prod)
- Experimentar com diferentes tipos de comandos

## ❓ Precisa de Ajuda?

Consulte o [README.md](README.md) completo para documentação detalhada.

---

**Divirta-se automatizando seus projetos! 🎉**
