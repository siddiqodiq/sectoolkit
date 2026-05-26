import type { Metadata } from "next"
import '../../app/globals.css'

export const metadata: Metadata = {
  title: "Register - Pusdatin Security Toolkit",
  description: "Register to Pusdatin Security Toolkit",
  icons: {
    icon: "logo.ico",
    shortcut: "logo.ico",
    apple: "/apple-touch-icon.png",
  },
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="register-container">
      {children}
    </div>
  )
}