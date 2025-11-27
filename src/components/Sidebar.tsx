import { useState } from 'react'
import { Plus, Terminal, ChevronRight, ChevronLeft, LayoutGrid } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { useTranslation } from '../i18n/LanguageContext'
import { Project } from '../types'
import { cn } from '../lib/utils'
import { DynamicIcon } from './IconManager' 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface SidebarProps {
  projects: Project[];
  currentProject: Project | null;
  runningProjects: Set<string>;
  onSelectProject: (project: Project | null) => void;
  onNewProject: () => void;
}

export function Sidebar({ projects, currentProject, runningProjects, onSelectProject, onNewProject }: SidebarProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <aside 
      className={cn(
        "flex flex-col bg-zinc-50 dark:bg-[#020202] border-r border-border z-50 h-full select-none transition-all duration-300 ease-in-out",
        isExpanded ? "w-64" : "w-[72px]"
      )}
    >
      {/* Header / Home Button */}
      <div 
        className="h-[70px] flex items-center shrink-0 cursor-pointer group px-4"
        onClick={() => onSelectProject(null)}
        title={t('home.welcome')}
      >
        <div className="flex items-center gap-3 w-full">
            <div className={cn(
                "w-10 h-10 bg-gradient-to-br from-zinc-100 to-zinc-400 dark:from-zinc-100 dark:to-zinc-400 rounded-xl flex items-center justify-center shadow-lg shadow-black/5 dark:shadow-white/5 relative z-10 ring-1 ring-black/5 dark:ring-white/20 shrink-0 transition-transform duration-300",
                !currentProject && "scale-110 ring-indigo-500/50 dark:ring-indigo-400/50"
            )}>
                <Terminal className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            
            <div className={cn(
                "flex flex-col overflow-hidden transition-all duration-300",
                isExpanded ? "opacity-100 w-auto translate-x-0" : "opacity-0 w-0 -translate-x-4 pointer-events-none"
            )}>
                <span className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">Software Launcher</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Dev Environment</span>
            </div>
        </div>
      </div>

      <div className={cn("w-full px-4 mb-2 transition-opacity duration-300", isExpanded ? "opacity-100" : "opacity-0 h-0 overflow-hidden")}>
         <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Projects</div>
      </div>
      
      {!isExpanded && <div className="w-8 h-[1px] bg-border mx-auto mb-3" />}

      <TooltipProvider delayDuration={0} disableHoverableContent={isExpanded}>
        <ScrollArea className="flex-1 w-full">
          <div className={cn("flex flex-col gap-2 w-full pb-4", isExpanded ? "px-3" : "items-center px-2")}>
            
            {projects.map((project) => {
              const isActive = currentProject?.id === project.id;
              const isRunning = runningProjects.has(project.id);

              const ButtonContent = (
                <button
                    onClick={() => onSelectProject(project)}
                    className={cn(
                      "flex items-center gap-3 transition-all duration-200 relative group overflow-hidden",
                      isExpanded 
                        ? "w-full px-3 py-2.5 rounded-lg text-sm font-medium" 
                        : "w-10 h-10 rounded-xl justify-center",
                      isActive
                        ? "bg-white dark:bg-zinc-800 text-foreground dark:text-white shadow-sm border border-black/5 dark:border-white/10" 
                        : "text-zinc-500 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-black/5 dark:hover:border-white/5"
                    )}
                >
                    {/* Dynamic Icon */}
                    <DynamicIcon 
                        name={project.icon || 'Box'} 
                        className={cn(
                            "transition-transform duration-300 shrink-0", 
                            isActive ? "scale-110" : "",
                            isExpanded ? "w-4 h-4" : "w-5 h-5"
                        )} 
                    />
                    
                    {/* Text Label (Expanded Only) */}
                    {isExpanded && (
                        <span className="truncate">{project.name}</span>
                    )}

                    {/* Running Dot Indicator */}
                    {isRunning && (
                      <span className={cn(
                          "absolute bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]",
                          isExpanded ? "right-3 w-1.5 h-1.5" : "top-2 right-2 w-1.5 h-1.5"
                      )} />
                    )}
                </button>
              )

              // Only wrap in tooltip if NOT expanded
              if (isExpanded) {
                  return <div key={project.id}>{ButtonContent}</div>
              }

              return (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    {ButtonContent}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{project.name}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}

            <div className={cn("pt-2", isExpanded && "px-0")}>
               {isExpanded ? (
                   <button 
                    onClick={onNewProject}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-foreground hover:border-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 text-xs font-medium group"
                   >
                     <div className="p-1 rounded bg-muted group-hover:bg-background transition-colors">
                        <Plus className="w-3 h-3" />
                     </div>
                     <span>{t('buttons.newProject')}</span>
                   </button>
               ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={onNewProject}
                        className="w-10 h-10 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-foreground hover:border-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300 flex items-center justify-center group"
                      >
                        <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={1.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('buttons.newProject')}</p>
                    </TooltipContent>
                  </Tooltip>
               )}
            </div>

          </div>
        </ScrollArea>
      </TooltipProvider>

      {/* Footer / Toggle */}
      <div className="p-4 border-t border-border mt-auto flex justify-center">
        <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
            {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}

