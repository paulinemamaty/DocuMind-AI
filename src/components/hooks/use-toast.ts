import { useState, useEffect } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  duration?: number
  variant?: 'default' | 'destructive'
}

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (props: Omit<Toast, 'id'>) => {
    const id = String(++toastId)
    const newToast: Toast = { ...props, id }
    
    setToasts((prev) => [...prev, newToast])
    
    if (props.duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, props.duration || 5000)
    }
    
    return id
  }

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return {
    toasts,
    toast,
    dismiss,
  }
}