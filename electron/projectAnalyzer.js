const fs = require('fs').promises;
const path = require('path');

class ProjectAnalyzer {
  async analyze(rootPath) {
    try {
      const packageJsonPaths = await this.findPackageJsons(rootPath);
      
      if (packageJsonPaths.length === 0) {
        return { success: false, error: 'No package.json found in this directory.' };
      }

      const tasks = [];
      let mainProjectName = path.basename(rootPath);
      let mainDescription = '';

      for (const pPath of packageJsonPaths) {
        try {
            const data = await fs.readFile(pPath, 'utf-8');
            const pkg = JSON.parse(data);
            const dirName = path.dirname(pPath);
            const relativeDir = path.relative(rootPath, dirName);
            
            // If it's the root package.json, use its details for the project info
            if (relativeDir === '') {
                mainProjectName = pkg.name || mainProjectName;
                mainDescription = pkg.description || mainDescription;
            }

            const prefix = relativeDir ? `${relativeDir.replace(/\\/g, '/')}` : '';

            if (pkg.scripts) {
                for (const [scriptName, command] of Object.entries(pkg.scripts)) {
                    if (this.shouldIgnoreScript(scriptName)) continue;

                    // Name format: "backend: dev" or just "dev" if root
                    const taskName = prefix ? `${prefix}: ${scriptName}` : scriptName;

                    tasks.push({
                        name: taskName,
                        command: `npm run ${scriptName}`,
                        workingDirectory: dirName,
                        executionMode: 'internal',
                        icon: this.guessIcon(scriptName),
                        healthCheck: {
                            enabled: false,
                            url: '',
                            interval: 30000,
                            timeout: 5000,
                            retries: 3,
                            autoRestart: true
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`Error parsing ${pPath}:`, e);
        }
      }

      return {
        success: true,
        projectName: mainProjectName,
        description: mainDescription || `Imported project with ${tasks.length} detected tasks.`,
        tasks: tasks.sort((a, b) => a.name.localeCompare(b.name))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async findPackageJsons(dir) {
    let results = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.vscode') continue;
            results = results.concat(await this.findPackageJsons(fullPath));
        } else if (entry.name === 'package.json') {
            results.push(fullPath);
        }
    }
    return results;
  }

  shouldIgnoreScript(name) {
      const lower = name.toLowerCase();
      // Ignore one-off, setup, or noisy scripts
      if (lower.includes('seed')) return true;
      if (lower.includes('migrate')) return true;
      if (lower.includes('postinstall')) return true;
      if (lower.includes('preinstall')) return true;
      if (lower.includes('upload-')) return true;
      if (lower.includes('sync-')) return true;
      return false;
  }

  guessIcon(scriptName) {
    const lower = scriptName.toLowerCase();
    
    // Build / Bundle
    if (lower.includes('build') || lower.includes('bundle') || lower.includes('compile')) return 'Package';
    
    // Tools / Linting
    if (lower.includes('lint') || lower.includes('fix') || lower.includes('format')) return 'Wrench';
    
    // Containers / Docker
    if (lower.includes('docker') || lower.includes('compose') || lower.includes('container')) return 'Box';
    
    // Database
    if (lower.includes('db') || lower.includes('sql') || lower.includes('prisma')) return 'Database';
    
    // Testing
    if (lower.includes('test') || lower.includes('jest') || lower.includes('spec') || lower.includes('vitest')) return 'FlaskConical';
    
    // Server / Start / Dev
    if (lower.includes('dev') || lower.includes('start') || lower.includes('serve') || lower.includes('preview')) return 'Play';
    
    // Default
    return 'Terminal';
  }
}

module.exports = ProjectAnalyzer;