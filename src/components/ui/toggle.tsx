import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(({ className, pressed, onPressedChange, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={() => onPressedChange?.(!pressed)}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
Toggle.displayName = "Toggle"

export { Toggle }
