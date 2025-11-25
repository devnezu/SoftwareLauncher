const fs = require('fs').promises;
const path = require('path');

class ProjectAnalyzer {
  constructor() {
    this.ignoreDirs = new Set([
      'node_modules', '.git', 'dist', 'build', 'out', '.next', 
      'coverage', '.vscode', '.idea', 'venv', '__pycache__'
    ]);

    this.ignoreScripts = [
      'seed', 'test', 'lint', 'format', 'clean', 'postinstall', 
      'prepare', 'typecheck', 'migrate', 'husky', 'cy:', 'cypress'
    ];
  }

  async analyze(rootPath) {
    try {
      const projectName = path.basename(rootPath);
      const packageJsonFiles = await this.scanDirectory(rootPath);
      
      let allTasks = [];

      for (const pkgPath of packageJsonFiles) {
        const tasks = await this.processPackageJson(pkgPath, rootPath);
        allTasks = [...allTasks, ...tasks];
      }

      return {
        success: true,
        projectName: projectName,
        description: `Projeto detectado em ${rootPath}`,
        tasks: allTasks
      };
    } catch (error) {
      console.error(error);
      return { success: false, error: error.message };
    }
  }

  async scanDirectory(dir, depth = 0, maxDepth = 2) {
    if (depth > maxDepth) return [];

    let results = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      const hasPackageJson = entries.some(e => e.name === 'package.json' && e.isFile());
      if (hasPackageJson) {
        results.push(path.join(dir, 'package.json'));
      }

      for (const entry of entries) {
        if (entry.isDirectory() && !this.ignoreDirs.has(entry.name)) {
          const subResults = await this.scanDirectory(path.join(dir, entry.name), depth + 1, maxDepth);
          results = [...results, ...subResults];
        }
      }
    } catch (error) {
      return [];
    }

    return results;
  }

  async processPackageJson(pkgPath, rootPath) {
    try {
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const dir = path.dirname(pkgPath);
      
      const relativeDir = path.relative(rootPath, dir);
      const dirName = relativeDir === '' ? 'Root' : relativeDir;

      const isYarn = await this.checkForYarn(dir, rootPath);
      
      const tasks = [];
      if (pkg.scripts) {
        Object.entries(pkg.scripts).forEach(([scriptName, command]) => {
          if (this.shouldIncludeScript(scriptName)) {
            
            const taskName = relativeDir === '' 
              ? scriptName 
              : `${dirName}: ${scriptName}`;

            tasks.push({
              name: taskName,
              command: isYarn ? `yarn ${scriptName}` : `npm run ${scriptName}`,
              workingDirectory: dir,
              executionMode: 'internal',
              healthCheck: this.detectHealthCheck(scriptName, command)
            });
          }
        });
      }

      return tasks;
    } catch (error) {
      return [];
    }
  }

  shouldIncludeScript(name) {
    if (this.ignoreScripts.some(ignore => name.startsWith(ignore))) {
      return false;
    }
    
    if (name.includes('test')) return false;

    return true;
  }

  async checkForYarn(dir, rootPath) {
    try {
      const localLock = await fs.stat(path.join(dir, 'yarn.lock')).catch(() => null);
      if (localLock) return true;

      if (dir !== rootPath) {
        const rootLock = await fs.stat(path.join(rootPath, 'yarn.lock')).catch(() => null);
        if (rootLock) return true;
      }
    } catch (e) {}
    return false;
  }

  detectHealthCheck(name, command) {
    if (name === 'dev' || name === 'start' || name === 'preview' || name.includes('server')) {
      let port = 3000;
      
      const portMatch = command.match(/--port\s+(\d+)/) || command.match(/PORT=(\d+)/);
      if (portMatch) port = parseInt(portMatch[1]);
      else if (name.includes('vite')) port = 5173;
      else if (name.includes('next')) port = 3000;
      else if (name.includes('react')) port = 3000;
      else if (name.includes('electron')) return undefined;

      return {
        enabled: true,
        url: `http://localhost:${port}`,
        interval: 30000,
        timeout: 5000,
        retries: 3,
        autoRestart: true
      };
    }
    return undefined;
  }
}

module.exports = ProjectAnalyzer;