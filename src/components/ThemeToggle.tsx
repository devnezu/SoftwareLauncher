import { Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from './ui/button'

export function ThemeToggle() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    applyTheme(savedTheme)
  }, [])

  function applyTheme(newTheme: string) {
    const root = document.documentElement
    if (newTheme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }

  function toggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-lg"
      title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" strokeWidth={1.5} />
      ) : (
        <Moon className="w-4 h-4" strokeWidth={1.5} />
      )}
    </Button>
  )
}
