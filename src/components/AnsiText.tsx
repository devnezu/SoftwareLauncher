import { useMemo } from 'react'

interface AnsiTextProps {
  children: string
  className?: string
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

// ALTERAÇÃO AQUI: Mudado de React.FC para function normal para evitar conflito de tipos
export function AnsiText({ children, className = '' }: AnsiTextProps) {
  const parsedContent = useMemo(() => {
    if (!children) return []

    // Primeiro, remover códigos de controle de cursor (K, G, H, J, etc.)
    // Esses códigos controlam posição do cursor e limpeza, não fazem sentido em UI web
    let cleanText = children.replace(/\x1B\[[\d;]*[A-HJKSTfhilmnsu]/g, '')

    // Regex para detectar códigos ANSI de cor/estilo: \x1B[...m
    const ansiRegex = /\x1B\[([0-9;]+)m/g

    const parts: Array<{ text: string; classes: string[] }> = []
    let lastIndex = 0
    let currentClasses: string[] = []

    let match
    while ((match = ansiRegex.exec(cleanText)) !== null) {
      // Adicionar texto antes do código ANSI
      if (match.index > lastIndex) {
        const text = cleanText.substring(lastIndex, match.index)
        parts.push({ text, classes: [...currentClasses] })
      }

      // Processar código ANSI
      const codes = match[1].split(';')

      for (const code of codes) {
        if (code === '0' || code === '39' || code === '22') {
          // Reset
          currentClasses = []
        } else if (ansiColors[code]) {
          // Remover cores antigas e adicionar nova cor
          currentClasses = currentClasses.filter(c => !c.startsWith('text-'))
          currentClasses.push(ansiColors[code])
        } else if (ansiStyles[code]) {
          // Adicionar estilo
          if (!currentClasses.includes(ansiStyles[code])) {
            currentClasses.push(ansiStyles[code])
          }
        }
      }

      lastIndex = ansiRegex.lastIndex
    }

    // Adicionar texto restante
    if (lastIndex < cleanText.length) {
      const text = cleanText.substring(lastIndex)
      parts.push({ text, classes: [...currentClasses] })
    }

    return parts
  }, [children])

  if (!parsedContent.length) {
    // Se não há códigos ANSI, ainda assim remover códigos de controle
    const cleanText = children.replace(/\x1B\[[\d;]*[A-HJKSTfhilmnsu]/g, '')
    return <span className={className}>{cleanText}</span>
  }

  return (
    <span className={className}>
      {parsedContent.map((part, index) => (
        <span key={index} className={part.classes.join(' ')}>
          {part.text}
        </span>
      ))}
    </span>
  )
}