import { CHALLENGE_START } from "@/context/app-context"

// El golpe emocional: el comentario villano vs la respuesta. Declaración editorial.
export function ChallengeStatement() {
  return (
    <section className="glass-card relative overflow-hidden p-8 md:p-14">
      <div className="accent-glow accent-glow-violet -right-20 -top-20" />
      <div className="relative z-10">
        <div className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-kev-danger" />
          El villano · 1.300 likes
        </div>

        <blockquote className="font-serif-display italic text-3xl md:text-5xl text-muted-foreground leading-snug max-w-2xl">
          “me lo compró mi papá”
        </blockquote>

        <h2 className="font-display font-extrabold uppercase tracking-tighter leading-[0.82] text-8xl md:text-[11rem] mt-6 text-accent-gradient">
          No.
        </h2>

        <p className="text-xl md:text-3xl font-semibold leading-snug mt-6 max-w-3xl text-balance">
          Empecé desde <span className="text-accent-gradient">${CHALLENGE_START}</span>. Desde Bolivia. En cámara.
        </p>
        <p className="text-base md:text-lg text-muted-foreground font-light mt-4 max-w-2xl text-pretty">
          El auto es la carnada — el imperio es la meta. Cada peso del contador es revenue real de PRIME.
        </p>
      </div>
    </section>
  )
}
