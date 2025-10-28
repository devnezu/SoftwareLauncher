const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async analyzeProject(projectPath) {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // Analisar estrutura do diretório
      const structure = await this.scanDirectory(projectPath);

      // Ler arquivos importantes
      const fileContents = await this.readImportantFiles(projectPath, structure);

      // Criar prompt para IA
      const prompt = this.buildAnalysisPrompt(projectPath, structure, fileContents);

      // Chamar Gemini
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse da resposta JSON
      const analysis = this.parseAIResponse(text);

      return {
        success: true,
        projectName: analysis.projectName || path.basename(projectPath),
        description: analysis.description || '',
        tasks: analysis.tasks || []
      };
    } catch (error) {
      console.error('Error analyzing project with AI:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async scanDirectory(dirPath, maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const structure = {
      directories: [],
      files: []
    };

    for (const entry of entries) {
      // Ignorar node_modules, .git, dist, build, etc
      if (this.shouldIgnore(entry.name)) continue;

      if (entry.isDirectory()) {
        structure.directories.push({
          name: entry.name,
          path: path.join(dirPath, entry.name)
        });
      } else {
        structure.files.push({
          name: entry.name,
          path: path.join(dirPath, entry.name)
        });
      }
    }

    return structure;
  }

  shouldIgnore(name) {
    const ignoreList = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'out',
      'coverage',
      '.vscode',
      '.idea',
      '__pycache__',
      'venv',
      'env',
      '.pytest_cache'
    ];
    return ignoreList.includes(name) || name.startsWith('.');
  }

  async readImportantFiles(projectPath, structure) {
    const importantFileNames = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.env.example',
      '.env.template',
      'tsconfig.json',
      'vite.config.js',
      'vite.config.ts',
      'next.config.js',
      'next.config.ts',
      'README.md',
      'server.js',
      'server.ts',
      'index.js',
      'index.ts',
      'main.js',
      'main.ts',
      'app.js',
      'app.ts',
      'src/index.js',
      'src/index.ts',
      'src/main.js',
      'src/main.ts',
      'src/server.js',
      'src/server.ts',
      'src/app.js',
      'src/app.ts'
    ];

    const contents = {};

    for (const fileName of importantFileNames) {
      const filePath = path.join(projectPath, fileName);
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile() && stats.size < 100000) { // Max 100KB
          const content = await fs.readFile(filePath, 'utf-8');
          contents[fileName] = content;
        }
      } catch (error) {
        // Arquivo não existe ou erro ao ler
      }
    }

    return contents;
  }

  buildAnalysisPrompt(projectPath, structure, fileContents) {
    const projectName = path.basename(projectPath);

    return `You are an AI assistant that analyzes software projects and extracts configuration information.

Analyze the following project and return a JSON response with project details and tasks to run it.

Project Path: ${projectPath}
Project Name: ${projectName}

Directory Structure:
${JSON.stringify(structure, null, 2)}

File Contents:
${Object.entries(fileContents).map(([name, content]) => `
--- ${name} ---
${content.substring(0, 5000)}
---
`).join('\n')}

IMPORTANT INSTRUCTIONS:
1. Analyze the project structure and files
2. Identify if this is a monorepo with multiple subprojects (frontend, backend, etc.)
3. For EACH subproject or main project, create a task with:
   - name: Clear task name (e.g., "Frontend", "Backend", "API")
   - command: The exact command to run (from package.json scripts, usually "npm run dev" or "npm start")
   - workingDirectory: The full absolute path to the directory where command should run
   - envFilePath: Path to .env file if exists (optional)
   - environments: ["development", "production"] (or specific ones if clear from code)
   - executionMode: "internal" (always use internal)
   - healthCheck: If you can detect a port/URL, add: { enabled: true, url: "http://localhost:PORT", interval: 30000, retries: 3, autoRestart: true }

4. If you find subdirectories like "frontend", "backend", "api", "server", "client", "web", "app", create SEPARATE tasks for each
5. Return ONLY valid JSON, no markdown, no explanation

Expected JSON format:
{
  "projectName": "Project Name",
  "description": "Brief description of the project",
  "tasks": [
    {
      "name": "Task Name",
      "command": "npm run dev",
      "workingDirectory": "/full/path/to/subdirectory",
      "envFilePath": "/full/path/to/.env",
      "envVariables": {},
      "environments": ["development", "production"],
      "executionMode": "internal",
      "healthCheck": {
        "enabled": true,
        "url": "http://localhost:3000",
        "interval": 30000,
        "retries": 3,
        "autoRestart": true
      },
      "monitoring": {
        "enabled": false
      }
    }
  ]
}

Return the JSON now:`;
  }

  parseAIResponse(text) {
    try {
      // Remover markdown se existir
      let jsonText = text.trim();

      // Remover ```json e ```
      jsonText = jsonText.replace(/```json\s*/g, '');
      jsonText = jsonText.replace(/```\s*/g, '');

      // Tentar encontrar JSON no texto
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Raw text:', text);
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  async analyzeMultipleProjects(rootPath) {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // Escanear diretório raiz
      const structure = await this.scanDirectory(rootPath, 1);

      // Detectar se é monorepo (tem subdiretorios com package.json)
      const subProjects = [];

      for (const dir of structure.directories) {
        const packageJsonPath = path.join(dir.path, 'package.json');
        try {
          await fs.access(packageJsonPath);
          subProjects.push(dir);
        } catch (error) {
          // Não tem package.json
        }
      }

      if (subProjects.length > 1) {
        // É monorepo, analisar cada subprojeto
        const allTasks = [];
        let projectName = path.basename(rootPath);
        let description = `Monorepo with ${subProjects.length} projects`;

        for (const subProject of subProjects) {
          const analysis = await this.analyzeProject(subProject.path);
          if (analysis.success && analysis.tasks) {
            allTasks.push(...analysis.tasks);
          }
        }

        return {
          success: true,
          projectName,
          description,
          tasks: allTasks
        };
      } else {
        // Projeto único, analisar normalmente
        return await this.analyzeProject(rootPath);
      }
    } catch (error) {
      console.error('Error analyzing multiple projects:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GeminiService;
