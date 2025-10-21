# Guia de Início Rápido

## ⚡ Instalação (2 minutos)

```bash
# 1. Instalar dependências
npm install

# 2. Executar aplicação
npm run dev
```

A aplicação abrirá automaticamente com projetos de exemplo.

---

## 🎯 Exemplo Prático: Projeto Full Stack

Vamos configurar um projeto completo com **Frontend + Backend + Ngrok** (similar ao Alpha Force BR).

### Passo 1: Criar Projeto

Clique em **"Novo Projeto"** e preencha:

- **Nome**: `Alpha Force BR - Full Stack`
- **Descrição**: `E-commerce com React + Node.js + Ngrok`

### Passo 2: Adicionar Tasks

#### Task 1 - Frontend

- **Nome**: `Frontend`
- **Comando**: `cd frontend && yarn dev`
- **Diretório**: Selecionar pasta `frontend/`
- **Arquivo .env**: Selecionar `frontend/.env`

#### Task 2 - Backend

- **Nome**: `Backend`
- **Comando**: `cd backend && yarn dev`
- **Diretório**: Selecionar pasta `backend/`
- **Arquivo .env**: Selecionar `backend/.env`

#### Task 3 - Ngrok (COM MONITORAMENTO) 🔍

1. **Nome**: `Ngrok Tunnel`
2. **Comando**: `ngrok http 3000`
3. **Diretório**: Pasta raiz do projeto
4. **Clique no botão 🔍** ao lado do campo de comando
5. **Resultado**: Sistema detectará automaticamente:
   ```
   ✅ ngrok detectado!

   📡 API: http://localhost:4040/api/tunnels
   📝 Atualizar variável: WEBHOOK_URL
   🔄 Transformação: {{url}}/v1/webhook
   ⏱️ Timeout: 15x de 2s
   ```
6. **Marcar**: ✅ "Monitorar ngrok e capturar URL"
7. **Arquivo .env**: Selecionar `backend/.env`

#### Tasks Adicionais (Opcional)

**Task 4 - Redis**:
- Comando: `redis-cli`
- Sem monitoramento

**Task 5 - MeiliSearch**:
- Comando: `meilisearch --http-addr 127.0.0.1:3001 --master-key sua_chave`
- Sem monitoramento

**Task 6 - Cloudflared**:
- Comando: `cloudflared tunnel run seu_tunnel`
- Sem monitoramento

### Passo 3: Variáveis de Ambiente Globais (Opcional)

Se quiser adicionar variáveis aplicadas a todas as tasks:

```
NODE_ENV=development
DEBUG=true
```

### Passo 4: Salvar e Executar

1. Clique em **"Salvar Projeto"**
2. Selecione o projeto na sidebar
3. Clique em **"Executar"**

### Passo 5: Acompanhar Execução

Você verá no console:

```
[Frontend] VITE v5.0.0  ready in 234 ms
[Frontend] ➜  Local:   http://localhost:5173/

[Backend] 🚀 Servidor rodando na porta 3000

[Ngrok Tunnel] Session Status  online
[Ngrok Tunnel] Forwarding      https://abc123.ngrok-free.app -> http://localhost:3000

🔗 URLs Capturadas:
┌─────────────────────────────────────────────────┐
│ NGROK                                           │
│ https://abc123.ngrok-free.app/v1/webhook        │
│                                        [Copiar] │
└─────────────────────────────────────────────────┘
```

### Passo 6: Verificar Atualização do .env

O arquivo `backend/.env` foi atualizado automaticamente:

```bash
# Antes
WEBHOOK_URL=

# Depois (atualizado automaticamente!)
WEBHOOK_URL=https://abc123.ngrok-free.app/v1/webhook
```

---

## 🔧 Configuração Manual de Monitoramento

Se preferir configurar manualmente (sem o botão 🔍):

1. No formulário da task, expanda **"Monitoramento de Serviço"**
2. Marque **"Ativar Monitoramento"**
3. Preencha:
   - **Tipo**: `ngrok` ou `cloudflared`
   - **URL da API**: `http://localhost:4040/api/tunnels`
   - **Variável .env**: `WEBHOOK_URL`
   - **Transformação**: `{{url}}/v1/webhook` (opcional)
   - **Max Tentativas**: `15`
   - **Intervalo (ms)**: `2000`

---

## 📊 Comandos Comuns

| Framework/Ferramenta | Comando Típico |
|---------------------|----------------|
| React (Vite) | `npm run dev` |
| React (CRA) | `npm start` |
| Next.js | `npm run dev` |
| Node.js (Express) | `npm run dev` |
| Python (Flask) | `python app.py` |
| Docker Compose | `docker-compose up` |
| Ngrok | `ngrok http 3000` |
| Cloudflared | `cloudflared tunnel run nome` |

---

## 🎨 Múltiplos Ambientes

Crie projetos separados para diferentes ambientes:

### Alpha Force BR - Development
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- .env: `backend/.env` (NODE_ENV=development)

### Alpha Force BR - Production
- Frontend: `https://alphaforcebr.com`
- Backend: `https://api.alphaforcebr.com`
- .env: `backend/.env.production` (NODE_ENV=production)

---

## 🛑 Parar Projeto

Clique em **"Parar"** para encerrar todos os processos de uma vez.

O monitoramento é automaticamente interrompido e as URLs capturadas são limpas.

---

## 🚨 Solução de Problemas

### Ngrok não foi detectado

**Problema**: Cliquei em 🔍 mas nada aconteceu

**Solução**:
- ✅ Verifique se digitou o comando antes de clicar em 🔍
- ✅ Comando deve conter `ngrok` ou `cloudflared`
- ✅ Exemplo válido: `ngrok http 3000`

### URL não foi capturada

**Problema**: Projeto rodou mas URL não apareceu

**Solução**:
- ✅ Verifique se o ngrok iniciou corretamente no console
- ✅ Acesse `http://localhost:4040` no navegador para confirmar
- ✅ Verifique se marcou "Monitorar e capturar URL"
- ✅ Aguarde até 30 segundos (15 tentativas × 2s)

### .env não foi atualizado

**Problema**: Capturou URL mas .env continua vazio

**Solução**:
- ✅ Verifique se selecionou o arquivo `.env` na task
- ✅ Confirme que o arquivo tem permissões de escrita
- ✅ Veja os logs no console para mensagens de erro

---

## 💡 Dicas Avançadas

### 1. Ordem de Execução

Tasks são executadas simultaneamente, mas você pode usar delays:

```bash
# Backend primeiro
cd backend && yarn dev

# Frontend com delay de 5s
sleep 5 && cd frontend && yarn dev
```

### 2. Múltiplas Portas no Ngrok

Para expor múltiplas portas:

```bash
# Task 1: Ngrok Backend
ngrok http 3000

# Task 2: Ngrok Frontend
ngrok http 5173
```

### 3. Transformações Personalizadas

Configure transformações diferentes:

- **Webhook**: `{{url}}/v1/webhook`
- **API**: `{{url}}/api`
- **Sem sufixo**: `{{url}}`

### 4. Variáveis Específicas

Configure diferentes variáveis por serviço:

- **Backend**: `API_URL` → URL do ngrok backend
- **Frontend**: `VITE_API_URL` → URL do ngrok backend

---

## 📚 Próximos Passos

Agora que você criou seu primeiro projeto:

- ✅ Adicione mais tasks (Redis, MeiliSearch, etc.)
- ✅ Configure monitoramento para cloudflared
- ✅ Crie projetos para diferentes ambientes
- ✅ Experimente com transformações de URL personalizadas

---

## ❓ Mais Ajuda

Veja a [Documentação Completa](README.md) para informações detalhadas.

---

**Automatize seu fluxo de desenvolvimento! 🚀**
