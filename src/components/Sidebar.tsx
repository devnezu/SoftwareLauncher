import { useState } from 'react'
import { Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { LanguageSelector } from './LanguageSelector'
import { ThemeToggle } from './ThemeToggle'
import { Settings } from './Settings'
import { useTranslation } from '../i18n/LanguageContext'

export function Sidebar({ projects, currentProject, runningProjects, onSelectProject, onNewProject }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`border-r border-border flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-80'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h1 className="text-lg font-normal">{t('sidebar.projects')}</h1>
          )}
          <div className="flex items-center gap-2">
            {!collapsed && (
              <Button onClick={onNewProject} size="icon" variant="ghost" className="h-8 w-8">
                <Plus className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            )}
            <Button
              onClick={() => setCollapsed(!collapsed)}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {projects.length === 0 && !collapsed && (
            <div className="text-center text-muted-foreground text-sm py-8 font-light">
              {t('sidebar.noProjects')}
            </div>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project)}
              className={`w-full mb-2 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                currentProject?.id === project.id
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-card hover:bg-accent border border-border'
              } ${collapsed ? 'p-2' : 'p-3'}`}
              title={collapsed ? project.name : ''}
            >
              <div className={`flex items-start gap-2 ${collapsed ? 'justify-center' : ''}`}>
                {runningProjects.has(project.id) && (
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 animate-pulse" />
                )}
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="font-normal text-sm truncate">{project.name}</h3>
                    <p className="text-xs opacity-70 truncate mt-0.5 font-light">
                      {project.description || t('sidebar.noDescription')}
                    </p>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <Settings compact />
            <ThemeToggle />
            <LanguageSelector compact />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Settings compact />
            <ThemeToggle />
            <LanguageSelector compact collapsed />
          </div>
        )}
      </div>
    </aside>
  )
}
