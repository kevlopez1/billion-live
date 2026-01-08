"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Twitter,
  Linkedin,
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
  name: "Kevin Strategy",
  tagline: "Building to $1 Billion in Public",
  bio: "Serial entrepreneur, investor, and strategist. Documenting the journey from $0 to $1B with radical transparency. Focused on asymmetric bets, scalable systems, and legacy over ego.",
  location: "Dubai, UAE",
  avatar: "/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg",
  coverGradient: "from-[#3D5A4C] via-[#2A7D4F] to-[#1E5A3A]",
  socials: {
    twitter: "https://twitter.com/kevstrategy",
    linkedin: "https://linkedin.com/in/kevstrategy",
    youtube: "https://youtube.com/@kevstrategy",
    website: "https://kevstrategy.com",
  },
  stats: {
    netWorth: 225_234_891,
    target: 1_000_000_000,
    monthlyGrowth: 12.4,
    projectsCount: 7,
    yearsActive: 9,
  },
  milestones: [
    { year: "2015", title: "Started Journey", amount: "$2,500" },
    { year: "2018", title: "First Million", amount: "$1.2M" },
    { year: "2020", title: "Pandemic Pivot", amount: "$24M" },
    { year: "2024", title: "Current Chapter", amount: "$225M" },
  ],
  featuredProjects: [
    { name: "Apex Ventures", type: "Venture Capital", value: "$42.8M", change: "+18.2%" },
    { name: "Neural Labs", type: "AI/ML Startup", value: "$8.2M", change: "+24.5%" },
    { name: "Titan Real Estate", type: "Real Estate", value: "$156M", change: "+2.1%" },
  ],
  principles: [
    { title: "Asymmetric Risk", desc: "Invest where loss is limited but gains are unlimited" },
    { title: "Radical Scalability", desc: "Build businesses that work without trading time for money" },
    { title: "Legacy Over Ego", desc: "Build for the next decades, not the next month" },
  ],
  quote:
    "The goal isn't to be a billionaire. The goal is to become the kind of person capable of building a billion-dollar empire.",
}

export default function PublicProfile() {
  const [copied, setCopied] = useState(false)
  const progressPercent = (profileData.stats.netWorth / profileData.stats.target) * 100

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profileData.name} - The Billion Live`,
          text: profileData.tagline,
          url,
        })
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Profile link copied!")
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
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Share"}
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
                className="w-full h-full rounded-xl object-cover"
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
                    href={profileData.socials.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                  <a
                    href={profileData.socials.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
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
              <p className="text-white/50 text-sm mb-1">Current Net Worth</p>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400">
                ${(profileData.stats.netWorth / 1_000_000).toFixed(1)}M
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-sm mb-1">Target</p>
              <div className="text-2xl font-semibold text-white/80">$1 Billion</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Progress to Goal</span>
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
              <p className="text-white/50 text-xs mb-1">Monthly Growth</p>
              <p className="text-lg font-semibold text-emerald-400">+{profileData.stats.monthlyGrowth}%</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-1">Active Projects</p>
              <p className="text-lg font-semibold">{profileData.stats.projectsCount}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-1">Years Active</p>
              <p className="text-lg font-semibold">{profileData.stats.yearsActive}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-1">Started With</p>
              <p className="text-lg font-semibold">$2,500</p>
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
                The Journey
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
                Featured Projects
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
                Philosophy
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
              <h3 className="font-semibold mb-2">Follow the Journey</h3>
              <p className="text-sm text-white/50 mb-4">Get weekly updates on progress and insights</p>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                <Mail className="w-4 h-4 mr-2" />
                Subscribe to Updates
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">2024 Kev Strategy. The Billion Live.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors">
              Dashboard
            </Link>
            <a href={profileData.socials.twitter} className="text-sm text-white/40 hover:text-white transition-colors">
              Twitter
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
