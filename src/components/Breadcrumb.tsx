import { ChevronRight } from 'lucide-react'

interface BreadcrumbProps {
  items: string[]
  onNavigate?: (index: number) => void
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground px-6 py-3 border-b border-border bg-card/30">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isClickable = !isLast && onNavigate

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="w-4 h-4" strokeWidth={1.5} />}
            {isClickable ? (
              <button
                onClick={() => onNavigate(index)}
                className="hover:text-foreground transition-colors font-light hover:underline"
              >
                {item}
              </button>
            ) : (
              <span className={isLast ? 'text-foreground font-normal' : 'font-light'}>
                {item}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
