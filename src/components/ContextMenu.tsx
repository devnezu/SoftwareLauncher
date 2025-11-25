import { useEffect, useState, useRef } from 'react'
import { RefreshCw, Bug } from 'lucide-react'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

export function ContextMenu() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setVisible(true)
      setPosition({ x: e.pageX, y: e.pageY })
    }

    const handleClick = () => setVisible(false)
    const handleScroll = () => setVisible(false)

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', handleClick)
    document.addEventListener('scroll', handleScroll)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleReload = () => {
    if (ipcRenderer) ipcRenderer.invoke('app-reload')
    setVisible(false)
  }

  const handleInspect = () => {
    if (ipcRenderer) ipcRenderer.invoke('app-inspect', position.x, position.y)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div 
      ref={menuRef}
      className="fixed z-[9999] w-48 bg-[#09090b] border border-white/10 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: position.y, left: position.x }}
    >
      <button 
        onClick={handleReload}
        className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors text-left"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Reload App
      </button>
      
      <div className="h-[1px] bg-white/5 my-1 mx-2" />
      
      <button 
        onClick={handleInspect}
        className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors text-left"
      >
        <Bug className="w-3.5 h-3.5" />
        Inspect Element
      </button>
    </div>
  )
}