// components/ui/logo.tsx
import { FC, useEffect, useState } from "react"

interface LogoProps {
  className?: string
}

export const Logoglitch: FC<LogoProps> = ({ className = "" }) => {
  const [glitch, setGlitch] = useState(false)
  const [glitchColor, setGlitchColor] = useState("rgb(0, 255, 0)") // Default green

  useEffect(() => {
    const interval = setInterval(() => {
      // Random RGB color for glitch effect
      const r = Math.floor(Math.random() * 255)
      const g = Math.floor(Math.random() * 255)
      const b = Math.floor(Math.random() * 255)
      setGlitchColor(`rgb(${r}, ${g}, ${b})`)
      
      setGlitch(true)
      setTimeout(() => setGlitch(false), 200)
    }, 3000 + Math.random() * 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative">
      {/* Glitch Effect Layers */}
      {glitch && (
        <>
          <img
            src="/logo.svg"
            alt=""
            className={`absolute inset-0 ${className} opacity-60 translate-x-1`}
            style={{ filter: `drop-shadow(2px 0 0 ${glitchColor})` }}
          />
          <img
            src="/logo.svg"
            alt=""
            className={`absolute inset-0 ${className} opacity-40 -translate-x-1`}
            style={{ filter: `drop-shadow(-2px 0 0 ${glitchColor === "rgb(0, 255, 0)" ? "rgb(255, 0, 0)" : glitchColor})` }}
          />
        </>
      )}
      
      {/* Main Logo */}
      <img
        src="/logo.svg"
        alt="Logo"
        className={`${className} transition-all duration-300 ${glitch ? 'opacity-80' : 'opacity-100'}`}
      />
    </div>
  )
}
