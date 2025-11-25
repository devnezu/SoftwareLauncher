import { Plus, LayoutDashboard, Terminal } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { useTranslation } from '../i18n/LanguageContext'
import { Project } from '../types'
import { cn } from '../lib/utils'
import { DynamicIcon } from './IconManager' 

interface SidebarProps {
  projects: Project[];
  currentProject: Project | null;
  runningProjects: Set<string>;
  onSelectProject: (project: Project | null) => void;
  onNewProject: () => void;
}

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
  <div className="group/tooltip relative flex items-center justify-center">
    {children}
    <span className="absolute left-14 opacity-0 -translate-x-2 transition-all duration-200 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-x-0 z-50 whitespace-nowrap bg-zinc-900 border border-white/10 text-zinc-200 text-[10px] font-medium px-2.5 py-1 rounded-md shadow-xl backdrop-blur-sm pointer-events-none">
      {text}
      <span className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900/90 border-l-0"></span>
    </span>
  </div>
)

export function Sidebar({ projects, currentProject, runningProjects, onSelectProject, onNewProject }: SidebarProps) {
  const { t } = useTranslation()

  return (
    <aside className="w-[72px] flex flex-col items-center bg-[#020202] border-r border-white/5 z-50 h-full select-none">
      
      <div className="h-[70px] flex items-center justify-center shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-zinc-100 to-zinc-400 rounded-xl flex items-center justify-center shadow-lg shadow-white/5 relative z-10 ring-1 ring-white/20">
             <Terminal className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
      </div>

      <div className="flex flex-col items-center w-full gap-4 pb-4">
        <Tooltip text={t('home.welcome')}>
          <button 
            onClick={() => onSelectProject(null)}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group",
              !currentProject 
                ? "bg-zinc-100 text-black shadow-[0_0_15px_rgba(255,255,255,0.15)]" 
                : "text-zinc-500 hover:text-zinc-100 hover:bg-white/10"
            )}
          >
            <LayoutDashboard className="w-5 h-5" strokeWidth={!currentProject ? 2.5 : 2} />
          </button>
        </Tooltip>

        <div className="w-8 h-[1px] bg-white/10" />
      </div>

      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col gap-3 items-center w-full px-2 pb-4">
          
          {projects.map((project) => {
            const isActive = currentProject?.id === project.id;
            const isRunning = runningProjects.has(project.id);

            return (
              <Tooltip key={project.id} text={project.name}>
                <button
                    onClick={() => onSelectProject(project)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group overflow-hidden",
                      isActive
                        ? "bg-zinc-800 text-white shadow-md border border-white/10" 
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5 border border-transparent hover:border-white/5"
                    )}
                >
                    {/* Dynamic Icon */}
                    <DynamicIcon 
                        name={project.icon || 'Box'} 
                        className={cn("w-5 h-5 transition-transform duration-300", isActive ? "scale-110" : "")} 
                    />
                    
                    {/* Running Dot Indicator (Minimal) */}
                    {isRunning && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    )}
                </button>
              </Tooltip>
            )
          })}

          <div className="pt-2">
            <Tooltip text={t('buttons.newProject')}>
              <button 
                onClick={onNewProject}
                className="w-10 h-10 rounded-xl border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-100 hover:border-zinc-400 hover:bg-white/5 transition-all duration-300 flex items-center justify-center group"
              >
                <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={1.5} />
              </button>
            </Tooltip>
          </div>

        </div>
      </ScrollArea>
    </aside>
  )
}