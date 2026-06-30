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

import { motion, AnimatePresence } from "framer-motion"

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

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className={cn(modalVariants({ variant }), className)} 
          {...props}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeOnOutsideClick ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            className="z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-gray-800 bg-black/90 shadow-xl glass-effect"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
