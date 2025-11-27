export interface Task {
  name: string
  command: string
  workingDirectory: string
  envFilePath?: string
  envVariables?: { [key: string]: { development: string; production: string } }
  executionMode?: 'internal' | 'external'
  icon?: string // Novo
  port?: number
  healthCheck?: {
    enabled: boolean
    url: string
    interval: number
    timeout: number
    retries: number
    autoRestart: boolean
  }
}

export interface Project {
  id: string
  name: string
  description?: string
  icon?: string // Novo
  tasks: Task[]
  environmentVariables?: Record<string, string>
  contextPresets?: { name: string; files: string[] }[]
  hiddenContextPaths?: string[]
}

export interface ConsoleLog {
  type: 'stdout' | 'stderr' | 'system' | 'error'
  data: string
  taskName: string
  timestamp: string
}