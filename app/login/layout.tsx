import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login - Pusdatin Security Toolkit",
  description: "Login to Pusdatin Security Toolkit",
  icons: {
    icon: "logo.ico",
    shortcut: "logo.ico",
    apple: "/apple-touch-icon.png",
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {children}
    </div>
  );
}