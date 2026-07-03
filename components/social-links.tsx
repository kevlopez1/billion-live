import { Music2, Youtube, Instagram, Facebook, MessageCircle } from "lucide-react"

// Link de la comunidad de WhatsApp (grupo público del reto).
export const WHATSAPP_COMMUNITY = "https://chat.whatsapp.com/Kbul1qE1td0F1T1a0kBO3K"

export const SOCIAL_LINKS = [
  { name: "TikTok", icon: Music2, url: "https://www.tiktok.com/@kev.project.gta" },
  { name: "YouTube", icon: Youtube, url: "https://www.youtube.com/@KevProjectGTA" },
  { name: "Instagram", icon: Instagram, url: "https://www.instagram.com/kev_project_gta" },
  { name: "Facebook", icon: Facebook, url: "https://www.facebook.com/people/Kev-Project-GTA/" },
  { name: "Comunidad de WhatsApp", icon: MessageCircle, url: WHATSAPP_COMMUNITY },
]

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.name}
          title={s.name}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors press-effect"
        >
          <s.icon className="w-4 h-4" strokeWidth={1.5} />
        </a>
      ))}
    </div>
  )
}
