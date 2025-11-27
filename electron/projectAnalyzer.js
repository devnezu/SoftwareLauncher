const fs = require('fs').promises;
const path = require('path');

class ProjectAnalyzer {
  async analyze(projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const data = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(data);

      const tasks = [];
      if (packageJson.scripts) {
        for (const [key, value] of Object.entries(packageJson.scripts)) {
          tasks.push({
            name: key,
            command: `npm run ${key}`,
            workingDirectory: projectPath,
            executionMode: 'internal',
            icon: this.guessIcon(key),
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

      return {
        success: true,
        projectName: packageJson.name || path.basename(projectPath),
        description: packageJson.description || 'Imported from package.json',
        tasks: tasks
      };
    } catch (error) {
      return { success: false, error: 'No package.json found or invalid format.' };
    }
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
    if (lower.includes('db') || lower.includes('sql') || lower.includes('prisma') || lower.includes('migrate')) return 'Database';
    
    // Testing
    if (lower.includes('test') || lower.includes('jest') || lower.includes('spec') || lower.includes('vitest')) return 'FlaskConical';
    
    // Server / Start / Dev
    if (lower.includes('dev') || lower.includes('start') || lower.includes('serve')) return 'Play';
    
    // Default
    return 'Terminal';
  }
}

module.exports = ProjectAnalyzer;