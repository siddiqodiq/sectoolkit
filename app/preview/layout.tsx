// app/layout.tsx
import "app/globals.css" // atau sesuai path kamu

export const metadata = { /* ... */ }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
