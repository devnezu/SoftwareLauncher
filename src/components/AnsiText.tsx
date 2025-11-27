import { useMemo } from 'react'

const { ipcRenderer } = window.require ? window.require('electron') : {ipcRenderer: null}

interface AnsiTextProps {
  children: string
  className?: string
  currentProjectRoot?: string // Add current project root to resolving relative paths if needed
}

// Mapeamento de cores ANSI para Tailwind
const ansiColors: Record<string, string> = {
  // Cores normais
  '30': 'text-gray-900',    // Preto
  '31': 'text-red-500',      // Vermelho
  '32': 'text-green-500',    // Verde
  '33': 'text-yellow-500',   // Amarelo
  '34': 'text-blue-500',     // Azul
  '35': 'text-purple-500',   // Magenta
  '36': 'text-cyan-500',     // Ciano
  '37': 'text-gray-300',     // Branco

  // Cores brilhantes
  '90': 'text-zinc-500',     // Preto brilhante (Ajustado para o tema dark)
  '91': 'text-red-400',      // Vermelho brilhante
  '92': 'text-green-400',    // Verde brilhante
  '93': 'text-yellow-400',   // Amarelo brilhante
  '94': 'text-blue-400',     // Azul brilhante
  '95': 'text-purple-400',   // Magenta brilhante
  '96': 'text-cyan-400',     // Ciano brilhante
  '97': 'text-white',        // Branco brilhante
}

const ansiStyles: Record<string, string> = {
  '1': 'font-bold',          // Negrito
  '2': 'opacity-60',         // Dim
  '3': 'italic',             // Itálico
  '4': 'underline',          // Sublinhado
  '22': 'font-normal',       // Negrito desligado
}

// Regex to capture file paths with line/column numbers
// Matches: /abs/path/to/file.ts:10:5 or src/file.js:10
// We need to be careful not to match random text.
// Strategy: Look for specific extension or / at start, followed by :line(:col)?
const filePathRegex = /((?:[a-zA-Z]:\\|\/|[\w.-]+\/)[\w.-]+\.[a-zA-Z0-9]+):(\d+)(?::(\d+))?/g;

export function AnsiText({ children, className = '', currentProjectRoot }: AnsiTextProps) {
  const parsedContent = useMemo(() => {
    if (!children) return []

    // 1. Remove control codes
    let cleanText = children.replace(/\x1B\[[\d;]*[A-HJKSTfhilmnsu]/g, '')

    // 2. Split by ANSI codes
    const ansiRegex = /\x1B\[([0-9;]+)m/g
    const parts: Array<{ text: string; classes: string[] }> = []
    let lastIndex = 0
    let currentClasses: string[] = []

    let match
    while ((match = ansiRegex.exec(cleanText)) !== null) {
      if (match.index > lastIndex) {
        const text = cleanText.substring(lastIndex, match.index)
        parts.push({ text, classes: [...currentClasses] })
      }

      const codes = match[1].split(';')
      for (const code of codes) {
        if (code === '0' || code === '39' || code === '22') {
          currentClasses = []
        } else if (ansiColors[code]) {
          currentClasses = currentClasses.filter(c => !c.startsWith('text-'))
          currentClasses.push(ansiColors[code])
        } else if (ansiStyles[code]) {
          if (!currentClasses.includes(ansiStyles[code])) {
            currentClasses.push(ansiStyles[code])
          }
        }
      }
      lastIndex = ansiRegex.lastIndex
    }

    if (lastIndex < cleanText.length) {
      const text = cleanText.substring(lastIndex)
      parts.push({ text, classes: [...currentClasses] })
    }

    // 3. Process links in each text part
    const finalParts: Array<{ text: string; classes: string[]; isLink?: boolean; path?: string; line?: number }> = [];
    
    parts.forEach(part => {
        let lastLinkIndex = 0;
        let linkMatch;
        // We need to use a new regex object or reset lastIndex because we are inside a loop
        const regex = new RegExp(filePathRegex);
        
        while ((linkMatch = regex.exec(part.text)) !== null) {
            if (linkMatch.index > lastLinkIndex) {
                finalParts.push({ 
                    text: part.text.substring(lastLinkIndex, linkMatch.index), 
                    classes: part.classes 
                });
            }
            
            const fullMatch = linkMatch[0];
            const filePath = linkMatch[1];
            const line = parseInt(linkMatch[2]);
            
            finalParts.push({
                text: fullMatch,
                classes: [...part.classes, 'text-blue-400', 'underline', 'cursor-pointer', 'hover:text-blue-300'],
                isLink: true,
                path: filePath,
                line: line
            });
            
            lastLinkIndex = linkMatch.index + fullMatch.length;
        }
        
        if (lastLinkIndex < part.text.length) {
            finalParts.push({
                text: part.text.substring(lastLinkIndex),
                classes: part.classes
            });
        }
    });

    return finalParts
  }, [children])

  const handleLinkClick = async (path: string, line: number) => {
     if(ipcRenderer) {
         // Resolve relative path if needed, but usually compilers output helpful paths or we try direct.
         // If path is relative and we have project root, pre-pend.
         let finalPath = path;
         if (currentProjectRoot && !path.startsWith('/') && !path.match(/^[a-zA-Z]:/)) {
            // It's relative
            // We'll rely on VS Code opening it relative to workspace if we pass relative, 
            // but providing absolute is safer.
            // For now, try sending as is.
         }
         await ipcRenderer.invoke('open-file-at-line', finalPath, line);
     }
  }

  if (!parsedContent.length) return <span className={className}>{children}</span>

  return (
    <span className={className}>
      {parsedContent.map((part, index) => (
        part.isLink ? (
            <span 
                key={index} 
                className={part.classes.join(' ')} 
                onClick={(e) => { e.stopPropagation(); if(part.path && part.line) handleLinkClick(part.path, part.line); }}
                title={`Open ${part.path} at line ${part.line}`}
            >
                {part.text}
            </span>
        ) : (
            <span key={index} className={part.classes.join(' ')}>
                {part.text}
            </span>
        )
      ))}
    </span>
  )
}
