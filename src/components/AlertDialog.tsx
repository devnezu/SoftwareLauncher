import { Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  buttonText?: string
}

export function AlertDialog({ open, onOpenChange, title, description, buttonText = 'OK' }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal">
            <Info className="w-5 h-5 text-primary" strokeWidth={1.5} />
            {title}
          </DialogTitle>
        </DialogHeader>

        {description && (
          <div className="text-sm text-muted-foreground font-light py-2">
            {description}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="font-light">
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
