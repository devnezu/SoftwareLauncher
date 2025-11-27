export interface IElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, listener: (...args: any[]) => void) => void
  removeListener: (channel: string, listener: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    require?: (module: string) => any
  }
}

export interface Project {
  id: string
  name: string
  description?: string
  tasks: Task[]
  environmentVariables?: Record<string, string>
  contextPresets?: { name: string; files: string[] }[]
  hiddenContextPaths?: string[]
}

export interface Task {
  name: string
  command: string
  workingDirectory: string
  envFilePath?: string
  envVariables?: Record<string, EnvVariableConfig>
  executionMode?: 'internal' | 'external'
  icon?: string
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

export interface EnvVariableConfig {
  development: string
  production: string
}

export interface ConsoleOutput {
  type: 'stdout' | 'stderr' | 'system' | 'error'
  data: string
  taskName: string
  timestamp: string
}

export interface ProcessOutputData {
  projectId: string
  taskName: string
  type: 'stdout' | 'stderr'
  data: string
}

export interface ProcessClosedData {
  projectId: string
  taskName: string
  code: number
}

export {}
