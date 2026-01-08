"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/context/app-context"

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
  opacity: number
}

export function ParticlesBackground() {
  const [particles, setParticles] = useState<Particle[]>([])
  const { theme } = useApp()

  useEffect(() => {
    const generateParticles = () => {
      const newParticles: Particle[] = []
      for (let i = 0; i < 30; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 1,
          duration: Math.random() * 20 + 15,
          delay: Math.random() * 10,
          opacity: Math.random() * 0.5 + 0.2,
        })
      }
      setParticles(newParticles)
    }

    generateParticles()
  }, [])

  const particleColor = theme === "dark" ? `oklch(0.5 0.12 160` : `oklch(0.4 0.1 160`

  const orbColor = theme === "dark" ? "oklch(0.4 0.08 160 / 0.08)" : "oklch(0.4 0.08 160 / 0.04)"

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial" />

      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-50" />

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            bottom: "-10px",
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: `${particleColor} / ${particle.opacity})`,
            boxShadow: `0 0 ${particle.size * 4}px ${particleColor} / ${particle.opacity * 0.8})`,
            animation: `float-particle ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      {/* Larger ambient glow orbs */}
      <div
        className="absolute w-96 h-96 rounded-full animate-pulse-glow"
        style={{
          left: "10%",
          top: "20%",
          background: `radial-gradient(circle, ${orbColor} 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full animate-pulse-glow"
        style={{
          right: "15%",
          bottom: "30%",
          background: `radial-gradient(circle, ${orbColor} 0%, transparent 70%)`,
          filter: "blur(60px)",
          animationDelay: "1.5s",
        }}
      />
    </div>
  )
}
