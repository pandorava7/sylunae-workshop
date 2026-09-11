import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from './ui/alert-dialog'

export function ConfirmDialog({ open, title, description, confirmLabel = '确认', destructive = false, icon, onConfirm, onOpenChange }: {
  open: boolean
  title: ReactNode
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  icon?: ReactNode
  onConfirm: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        {icon && <AlertDialogMedia>{icon}</AlertDialogMedia>}
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onClick={() => void onConfirm()}>{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
