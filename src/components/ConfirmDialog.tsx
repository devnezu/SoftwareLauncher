import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmText, cancelText, onConfirm, variant = 'destructive' }: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal">
            <AlertTriangle className={`w-5 h-5 ${variant === 'destructive' ? 'text-destructive' : 'text-primary'}`} strokeWidth={1.5} />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="font-light">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-light">
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm} className="font-light">
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
