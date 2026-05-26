"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const modalVariants = cva("fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-20", {
  variants: {
    variant: {
      default: "",
      blur: "backdrop-blur-sm",
    },
  },
  defaultVariants: {
    variant: "blur",
  },
})

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof modalVariants> {
  open?: boolean
  onClose: () => void
  closeOnOutsideClick?: boolean
}

export function Modal({
  className,
  children,
  variant,
  open,
  onClose,
  closeOnOutsideClick = true,
  ...props
}: ModalProps) {
  const [isOpen, setIsOpen] = React.useState(open)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    setIsOpen(open)
  }, [open])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "auto"
    }
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className={cn(modalVariants({ variant }), className)} {...props}>
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeOnOutsideClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className="z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-gray-800 bg-black/90 shadow-xl glass-effect"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
