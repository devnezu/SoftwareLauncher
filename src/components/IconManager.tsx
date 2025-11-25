import React, { useState } from 'react'
import * as Icons from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'

// Lista de ícones comuns para dev
const COMMON_ICONS = [
  'Terminal', 'Code', 'Box', 'Layers', 'Database', 'Server', 'Globe', 'Cpu', 
  'Activity', 'Zap', 'LayoutGrid', 'Folder', 'FileCode', 'Settings', 'Command',
  'Hash', 'Braces', 'Webhook', 'Cloud', 'Radio', 'Monitor', 'Smartphone', 
  'Tablet', 'Watch', 'Wifi', 'Bluetooth', 'HardDrive', 'Save', 'Play', 
  'Pause', 'StopCircle', 'RefreshCw', 'GitBranch', 'GitCommit', 'Github',
  'Aperture', 'Chrome', 'Codepen', 'Codesandbox', 'Coffee', 'Container', 
  'Feather', 'Figma', 'Framer', 'Hexagon', 'Image', 'Link', 'BoxSelect',
  'Package', 'Rocket', 'Shield', 'Slash', 'Sliders', 'ToggleLeft', 'Truck',
  'User', 'Users', 'Video', 'Wrench'
]

interface DynamicIconProps extends React.ComponentProps<any> {
  name: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const LucideIcon = (Icons as any)[name] || Icons.HelpCircle;
  return <LucideIcon {...props} />;
};

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (iconName: string) => void;
}

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filteredIcons = COMMON_ICONS.filter(icon => 
    icon.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-10 h-10 p-0 rounded-lg border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20">
          <DynamicIcon name={selectedIcon || 'Box'} className="w-5 h-5 text-zinc-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#09090b] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Select Icon</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input 
            placeholder="Search icons..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900/50 border-white/10 focus:border-indigo-500/50"
          />
          
          <ScrollArea className="h-[300px]">
            <div className="grid grid-cols-6 gap-2 p-1">
              {filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => { onSelect(iconName); setOpen(false) }}
                  className={`p-2 rounded-md flex items-center justify-center transition-all
                    ${selectedIcon === iconName 
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                      : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
                  title={iconName}
                >
                  <DynamicIcon name={iconName} className="w-5 h-5" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}