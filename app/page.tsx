"use client"

import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect"
import { Button } from "@/components/ui/button"
import { Logoglitch } from "@/components/ui/logoglitch"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import router from "next/router"

export default function LandingPage() {
  const [glitch, setGlitch] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSecure, setShowSecure] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const router = useRouter();
  const { data: session, status } = useSession()

   const handleGetStarted = () => {
    if (status === 'authenticated') {
      router.push('/tools')
    } else {
      router.push('/login')
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 200);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Reset state when glitch starts
    if (glitch) {
      setProgress(0);
      setShowSecure(false);
      setBarVisible(true);
    }
  }, [glitch]);

  useEffect(() => {
    if (!glitch && progress < 100) {
      const timer = setTimeout(() => {
        setProgress(prev => Math.min(prev + 10, 100));
      }, 100);
      return () => clearTimeout(timer);
    } else if (progress >= 100 && !showSecure) {
      setShowSecure(true);
      const timer = setTimeout(() => setBarVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [progress, glitch, showSecure]);


  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Canvas Reveal Effect Background */}
      <div className="absolute inset-0">
        <CanvasRevealEffect
          animationSpeed={2}
          containerClassName="bg-black"
          colors={[
            [30, 58, 138],   // Navy Blue
            [22, 101, 52],   // Dark Green
            [16, 185, 129],  // Emerald
          ]}
          dotSize={2}
          opacities={[0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 1, 1, 1, 1]}
        />
      </div>

      {/* Glitch Effect Overlay */}
      {glitch && (
        <div className="absolute inset-0 bg-emerald-900/20 pointer-events-none animate-pulse" />
      )}

      {/* Hero Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        {/* logo with Glitch Effect */}
        <div className={`mb-4 sm:mb-6 md:mb-8 w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 transition-all duration-300 ${glitch ? 'translate-x-1' : ''}`}>
          <Logoglitch className={`w-full h-full object-contain text-emerald-500 ${glitch ? 'opacity-80' : 'opacity-100'}`} />
        </div>
        
        {/* Title with Glitch Effect */}
        <h1 className={`mt-2 sm:mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-center mb-2 ${glitch ? 'text-emerald-300' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-500'}`}>
          <span className="relative">
            <span className={`absolute inset-0 bg-emerald-500/30 ${glitch ? 'block' : 'hidden'}`}></span>
            Pusdatin Security Toolkit
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-5 text-lg sm:text-xl text-emerald-100/80 max-w-2xl mx-auto text-center">
          “Built to Hack. Designed to Defend.”
        </p>

        {/* Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4">
             <Button
        size="lg"
        onClick={handleGetStarted}
        className="gradient-btn text-white font-semibold py-3 px-8 rounded-lg text-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-emerald-500/20"
      >
        Get Started
      </Button>

        </div>

        {/* Hacking Animation */}
        <div className="mt-12 text-emerald-300 font-mono text-xs sm:text-sm flex flex-col items-center">
          <div className={`${glitch ? 'text-emerald-500' : ''}`}>
            {glitch 
              ? '>_ Initializing security protocols...' 
              : showSecure 
                ? '>_ System secure' 
                : '>_ Loading security protocols...'}
          </div>
          <div className={`h-1 w-20 bg-emerald-500/50 mt-2 overflow-hidden transition-opacity duration-500 ${barVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div 
              className={`h-full bg-emerald-400 transition-all duration-300 ease-out`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

      </div>
    </div>
  )
}