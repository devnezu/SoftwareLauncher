import { ChevronRight } from 'lucide-react'

export function Breadcrumb({ items }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground px-6 py-2 border-b border-border">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          <span className={index === items.length - 1 ? 'text-foreground font-medium' : ''}>
            {item}
          </span>
        </div>
      ))}
    </div>
  )
}
