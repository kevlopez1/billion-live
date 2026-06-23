"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Music2,
  Instagram,
  Youtube,
  Globe,
  Target,
  Briefcase,
  Calendar,
  Share2,
  Mail,
  ChevronRight,
  Quote,
} from "lucide-react"
import { toast } from "sonner"

// Public profile data (would come from API in production)
const profileData = {
  name: "Kev López",
  tagline: "De $10 a un Mercedes-AMG Mansory — en público, desde Bolivia",
  bio: "Benjamín Kevin López Mamani, 21, Santa Cruz. Fundador de PRIME (empleados de IA para empresas). El reto: de $10 a un Mercedes-AMG GT 63 Mansory, con el contador alimentado por el revenue real de PRIME. El auto es la carnada; el imperio es la meta.",
  location: "Santa Cruz de la Sierra, Bolivia",
  avatar: "/images/kev.jpg",
  coverGradient: "from-[#3D5A4C] via-[#2A7D4F] to-[#1E5A3A]",
  socials: {
    tiktok: "https://www.tiktok.com/@kev.project.gta",
    instagram: "https://www.instagram.com/kev_project_gta",
    youtube: "https://www.youtube.com/@KevProjectGTA",
    website: "https://primebusiness.live",
  },
  stats: {
    netWorth: 10,
    target: 450_000,
    monthlyGrowth: 0,
    projectsCount: 4,
    yearsActive: 1,
  },
  milestones: [
    { year: "2024", title: "Nace PRIME", amount: "PRIME v1" },
    { year: "2025", title: "El comentario de los 1.300 likes", amount: "Pausa" },
    { year: "2026", title: "El Relanzamiento · Día 1", amount: "$10" },
    { year: "Meta", title: "Mercedes-AMG GT 63 Mansory", amount: "$450K" },
  ],
  featuredProjects: [
    { name: "PRIME", type: "Empleados de IA · El motor de dinero", value: "MRR", change: "Moat: datos + nicho" },
    { name: "KEV Strategy", type: "Inmobiliaria · Reputación", value: "Activos", change: "Largo plazo" },
    { name: "Insightful University", type: "Educación · Masificación", value: "Comunidad", change: "Atención → alumnos" },
  ],
  principles: [
    { title: "Apalancamiento de la Atención", desc: "El auto cuesta $450K una vez; la atención se convierte en 10x/100x/1000x" },
    { title: "Consistencia sobre Talento", desc: "Mi mayor riesgo es abandonar. Todo está diseñado para no fallar en consistencia" },
    { title: "Autenticidad desde la Crisis", desc: "Misión real desde Bolivia, no flex. Cada hito = una Beca PRIME" },
  ],
  quote:
    "No me lo compró mi papá. Empecé desde $10, desde Bolivia, en cámara. El auto es la carnada — el imperio es la meta.",
}

export default function PublicProfile() {
  const [copied, setCopied] = useState(false)
  const progressPercent = (profileData.stats.netWorth / profileData.stats.target) * 100

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profileData.name} - KEV PROJECT GTA`,
          text: profileData.tagline,
          url,
        })
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("¡Link del perfil copiado!")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Hero Section */}
      <div className={`relative bg-gradient-to-br ${profileData.coverGradient} pb-32`}>
        <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-10 bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-sm">Volver al Centro de Mando</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {copied ? "¡Copiado!" : "Compartir"}
            </Button>
          </div>
        </nav>

        {/* Profile Header */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-12">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 p-1 backdrop-blur-sm">
              <Image
                src={profileData.avatar || "/placeholder.svg"}
                alt={profileData.name}
                width={112}
                height={112}
                className="w-full h-full rounded-xl object-cover object-[center_70%]"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold">{profileData.name}</h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <p className="text-xl text-white/70 mb-3">{profileData.tagline}</p>
              <p className="text-white/50 max-w-2xl mb-4 leading-relaxed">{profileData.bio}</p>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-sm text-white/60">
                  <MapPin className="w-4 h-4" />
                  {profileData.location}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={profileData.socials.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Music2 className="w-4 h-4" />
                  </a>
                  <a
                    href={profileData.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                  <a
                    href={profileData.socials.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                  <a
                    href={profileData.socials.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 -mt-20 relative z-20 pb-20">
        {/* Progress Card */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
              <p className="text-white/50 text-sm mb-1">Contador · Revenue PRIME</p>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400">
                ${profileData.stats.netWorth.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-sm mb-1">Meta</p>
              <div className="text-2xl font-semibold text-white/80">$450K · Mansory</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Progreso a la meta</span>
              <span className="text-emerald-400 font-medium">{progressPercent.toFixed(2)}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-white/50 text-xs mb-1">Crecimiento mensual</p>
              <p className="text-lg font-semibold text-emerald-400">+{profileData.stats.monthlyGrowth}%</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-1">Marcas activas</p>
              <p className="text-lg font-semibold">{profileData.stats.projectsCount}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-1">Años del reto</p>
              <p className="text-lg font-semibold">{profileData.stats.yearsActive}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-1">Empezó con</p>
              <p className="text-lg font-semibold">$10</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="md:col-span-2 space-y-8">
            {/* Timeline */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                El Camino
              </h2>
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-white/10" />
                <div className="space-y-6">
                  {profileData.milestones.map((milestone, i) => (
                    <div key={i} className="flex gap-4">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          i === profileData.milestones.length - 1
                            ? "border-emerald-400 bg-emerald-400/20"
                            : "border-white/30 bg-[#111]"
                        }`}
                      >
                        {i === profileData.milestones.length - 1 && (
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/50">{milestone.year}</span>
                          <span className="text-sm font-semibold text-emerald-400">{milestone.amount}</span>
                        </div>
                        <p className="font-medium mt-1">{milestone.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Featured Projects */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                El Ecosistema
              </h2>
              <div className="space-y-4">
                {profileData.featuredProjects.map((project, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <h3 className="font-medium">{project.name}</h3>
                      <p className="text-sm text-white/50">{project.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{project.value}</p>
                      <p className="text-sm text-emerald-400">{project.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Philosophy */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                Filosofía
              </h2>
              <div className="space-y-4">
                {profileData.principles.map((principle, i) => (
                  <div key={i} className="p-4 bg-white/5 rounded-xl">
                    <h3 className="font-medium text-emerald-400 mb-1">{principle.title}</h3>
                    <p className="text-sm text-white/60">{principle.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quote */}
            <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border border-emerald-500/20 rounded-2xl p-6">
              <Quote className="w-8 h-8 text-emerald-400/50 mb-4" />
              <blockquote className="text-lg font-medium leading-relaxed mb-4 text-white/90">
                "{profileData.quote}"
              </blockquote>
              <cite className="text-sm text-emerald-400">— {profileData.name}</cite>
            </div>

            {/* CTA */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 text-center">
              <h3 className="font-semibold mb-2">Seguí el reto</h3>
              <p className="text-sm text-white/50 mb-4">Actualizaciones del camino de $10 al Mansory</p>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                <Mail className="w-4 h-4 mr-2" />
                Seguir el reto
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">2026 KEV PROJECT GTA · PRIME. Hecho en Bolivia.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors">
              Dashboard
            </Link>
            <a href={profileData.socials.tiktok} className="text-sm text-white/40 hover:text-white transition-colors">
              TikTok
            </a>
            <a href={profileData.socials.youtube} className="text-sm text-white/40 hover:text-white transition-colors">
              YouTube
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
