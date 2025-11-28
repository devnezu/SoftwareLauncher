import { useState, useEffect } from 'react'
import { Check, ChevronRight, Moon, Sun, Monitor, Terminal, ArrowRight } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from './ThemeProvider'
import { cn } from '../lib/utils'
import { DynamicIcon } from './IconManager'

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1)
  const { theme, setTheme } = useTheme()
  const [animating, setAnimating] = useState(false)

  const handleNext = () => {
    setAnimating(true)
    setTimeout(() => {
        setStep(prev => prev + 1)
        setAnimating(false)
    }, 300)
  }

  const handleFinish = () => {
      localStorage.setItem('setup_completed', 'true')
      onComplete()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-foreground select-none">
        {/* Background Ambient Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative w-full max-w-2xl bg-card/50 dark:bg-zinc-900/50 border border-border backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
            
            {/* Header / Progress */}
            <div className="h-16 border-b border-border flex items-center justify-between px-8 bg-muted/20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Terminal className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                    <span className="font-semibold tracking-tight text-lg">Software Launcher Setup</span>
                </div>
                
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={cn(
                            "h-1.5 rounded-full transition-all duration-500",
                            step >= i ? "w-8 bg-indigo-500" : "w-2 bg-zinc-300 dark:bg-zinc-800"
                        )} />
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative overflow-hidden p-10 flex flex-col items-center justify-center text-center">
                
                {/* Step 1: Welcome */}
                <div className={cn("absolute inset-0 p-10 flex flex-col items-center justify-center transition-all duration-500 ease-out", 
                    step === 1 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full pointer-events-none"
                )}>
                    <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-8 shadow-xl animate-in zoom-in duration-700">
                        <DynamicIcon name="Box" className="w-12 h-12 text-indigo-500" />
                    </div>
                    <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">Welcome to your new workspace.</h1>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                        Organize, launch, and monitor your development projects from a single, beautiful command center.
                    </p>
                </div>

                {/* Step 2: Theme */}
                <div className={cn("absolute inset-0 p-10 flex flex-col items-center justify-center transition-all duration-500 ease-out", 
                    step === 2 ? "opacity-100 translate-x-0" : step < 2 ? "opacity-0 translate-x-full pointer-events-none" : "opacity-0 -translate-x-full pointer-events-none"
                )}>
                    <h2 className="text-3xl font-bold mb-8">Choose your aesthetic</h2>
                    
                    <div className="grid grid-cols-3 gap-6 w-full max-w-xl">
                        <button 
                            onClick={() => setTheme('light')}
                            className={cn(
                                "flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200",
                                theme === 'light' ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10" : "border-border hover:border-zinc-300 dark:hover:border-zinc-700 bg-card"
                            )}
                        >
                            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                                <Sun className="w-6 h-6 text-orange-500" />
                            </div>
                            <span className="font-medium">Light</span>
                        </button>

                        <button 
                            onClick={() => setTheme('dark')}
                            className={cn(
                                "flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200",
                                theme === 'dark' ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10" : "border-border hover:border-zinc-300 dark:hover:border-zinc-700 bg-card"
                            )}
                        >
                            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                                <Moon className="w-6 h-6 text-indigo-500" />
                            </div>
                            <span className="font-medium">Dark</span>
                        </button>

                        <button 
                            onClick={() => setTheme('system')}
                            className={cn(
                                "flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200",
                                theme === 'system' ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10" : "border-border hover:border-zinc-300 dark:hover:border-zinc-700 bg-card"
                            )}
                        >
                            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                <Monitor className="w-6 h-6 text-zinc-500" />
                            </div>
                            <span className="font-medium">System</span>
                        </button>
                    </div>
                </div>

                {/* Step 3: Finish */}
                <div className={cn("absolute inset-0 p-10 flex flex-col items-center justify-center transition-all duration-500 ease-out", 
                    step === 3 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full pointer-events-none"
                )}>
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 text-emerald-500 animate-in zoom-in duration-500">
                        <Check className="w-10 h-10" strokeWidth={3} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">You're all set!</h2>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                        The setup is complete. You can now start adding your projects and managing your tasks.
                    </p>
                    <Button onClick={handleFinish} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-lg rounded-xl shadow-xl shadow-indigo-500/20 hover:scale-105 transition-all">
                        Launch Dashboard
                    </Button>
                </div>

            </div>

            {/* Footer */}
            {step < 3 && (
                <div className="h-20 border-t border-border bg-muted/20 flex items-center justify-end px-8">
                    <Button onClick={handleNext} className="gap-2 px-6 h-11 text-base">
                        Next Step <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    </div>
  )
}
