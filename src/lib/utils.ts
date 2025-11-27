import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getIconForScript(scriptName: string): string {
  const lower = scriptName.toLowerCase()
  if (lower.includes('server')) return 'Server'
  if (lower.includes('web') || lower.includes('dev')) return 'Globe'
  if (lower.includes('build')) return 'Package'
  if (lower.includes('test')) return 'Beaker'
  if (lower.includes('lint')) return 'CheckCircle'
  if (lower.includes('deploy')) return 'Rocket'
  return 'Terminal'
}

export function formatContextForClipboard(projectName: string, files: {path: string, content: string}[], rootDir: string): string {
  let clipboardText = `Context for Project: ${projectName}\n\n`
  
  files.forEach((f) => {
    const relativePath = f.path.replace(rootDir, '').replace(/^[\\/]/, '')
    const ext = relativePath.split('.').pop() || 'txt'
    clipboardText += `File: ${relativePath}\n\
\
${ext}\n${f.content}\n\
\
`
  })
  
  return clipboardText
}