"use client"

import { useState, useRef, useEffect } from "react"
import { useApp } from "@/context/app-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  Target,
  Lightbulb,
  BarChart3,
  Loader2,
  User,
  Maximize2,
  Minimize2,
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

// AI response generator based on context
function generateAIResponse(
  query: string,
  context: {
    netWorth: number
    monthlyGrowth: number
    projects: { name: string; value: number; change: number; status: string }[]
    goals: { name: string; targetValue: number; currentValue: number; deadline: string }[]
  },
  locale: string,
): string {
  const q = query.toLowerCase()
  const isSpanish = locale === "es"

  // Portfolio analysis
  if (
    q.includes("portfolio") ||
    q.includes("investment") ||
    q.includes("portafolio") ||
    q.includes("inversión") ||
    q.includes("inversion")
  ) {
    const totalValue = context.projects.reduce((sum, p) => sum + p.value, 0)
    const bestProject = context.projects.reduce((best, p) => (p.change > best.change ? p : best))
    const worstProject = context.projects.reduce((worst, p) => (p.change < worst.change ? p : worst))

    if (isSpanish) {
      return `Basado en tu análisis de portafolio actual:

**Valor Total del Portafolio:** $${(totalValue / 1_000_000).toFixed(1)}M en ${context.projects.length} inversiones

**Mejor Rendimiento:** ${bestProject.name} con +${bestProject.change}% de crecimiento
**Necesita Atención:** ${worstProject.name} en ${worstProject.change}%

**Recomendaciones:**
1. Considera aumentar la asignación a ${bestProject.name} dado su fuerte impulso
2. Revisa los fundamentos de ${worstProject.name} - ¿la tesis sigue siendo válida?
3. Con ${context.monthlyGrowth}% de crecimiento mensual, estás en camino de ganancias significativas

Tu diversificación se ve saludable. ¿Te gustaría que analice alguna inversión específica en detalle?`
    }

    return `Based on your current portfolio analysis:

**Total Portfolio Value:** $${(totalValue / 1_000_000).toFixed(1)}M across ${context.projects.length} investments

**Top Performer:** ${bestProject.name} with +${bestProject.change}% growth
**Needs Attention:** ${worstProject.name} at ${worstProject.change}% 

**Recommendations:**
1. Consider increasing allocation to ${bestProject.name} given its strong momentum
2. Review ${worstProject.name}'s fundamentals - is the thesis still valid?
3. With ${context.monthlyGrowth}% monthly growth, you're on track for significant gains

Your diversification looks healthy. Would you like me to analyze any specific investment in detail?`
  }

  // Goal tracking
  if (
    q.includes("goal") ||
    q.includes("meta") ||
    q.includes("billion") ||
    q.includes("target") ||
    q.includes("billón") ||
    q.includes("objetivo")
  ) {
    const progressPercent = ((context.netWorth / 1_000_000_000) * 100).toFixed(2)
    const monthsToGoal = Math.log(1_000_000_000 / context.netWorth) / Math.log(1 + context.monthlyGrowth / 100)
    const yearsToGoal = (monthsToGoal / 12).toFixed(1)

    if (isSpanish) {
      return `**Tu Camino a $1 Billón:**

Patrimonio Neto Actual: **$${(context.netWorth / 1_000_000).toFixed(1)}M** (${progressPercent}% de la meta)

A tu tasa actual de ${context.monthlyGrowth}% de crecimiento mensual:
- Alcanzarás **$500M** en aproximadamente ${((monthsToGoal * 0.5) / 12).toFixed(1)} años
- Alcanzarás **$1B** en aproximadamente ${yearsToGoal} años

**Para acelerar tu línea de tiempo:**
1. Aumenta el crecimiento mensual al 15% = alcanzar $1B en ${(Math.log(1_000_000_000 / context.netWorth) / Math.log(1.15) / 12).toFixed(1)} años
2. Enfócate en apuestas de alta asimetría (siguiendo el primer pilar de tu manifiesto)
3. Compón agresivamente - evita distribuciones tempranas

Tienes ${context.goals.length} metas activas para construir riqueza sistemática. Mantente disciplinado.`
    }

    return `**Your Path to $1 Billion:**

Current Net Worth: **$${(context.netWorth / 1_000_000).toFixed(1)}M** (${progressPercent}% of goal)

At your current ${context.monthlyGrowth}% monthly growth rate:
- You'll reach **$500M** in approximately ${((monthsToGoal * 0.5) / 12).toFixed(1)} years
- You'll reach **$1B** in approximately ${yearsToGoal} years

**To accelerate your timeline:**
1. Increase monthly growth to 15% = reach $1B in ${(Math.log(1_000_000_000 / context.netWorth) / Math.log(1.15) / 12).toFixed(1)} years
2. Focus on high-asymmetry bets (following your manifesto's first pillar)
3. Compound aggressively - avoid early distributions

You have ${context.goals.length} active goals for building systematic wealth. Stay disciplined.`
  }

  // Strategy advice
  if (q.includes("strategy") || q.includes("estrategia") || q.includes("advice") || q.includes("consejo")) {
    if (isSpanish) {
      return `**Análisis Estratégico para Kev Strategy:**

Dada tu posición actual en $${(context.netWorth / 1_000_000).toFixed(0)}M, aquí está mi evaluación:

**Fortalezas:**
- Fuerte tasa de composición mensual del ${context.monthlyGrowth}%
- Diversificado en ${context.projects.length} inversiones
- Enfoque de gestión activa funcionando bien

**Oportunidades:**
1. **Escala ganadores agresivamente** - Tus mejores performers merecen más capital
2. **Apuestas asimétricas** - Asigna 10-15% a jugadas de alto riesgo/alta recompensa
3. **Expansión geográfica** - Considera mercados emergentes para alpha

**Riesgos a Monitorear:**
- Riesgo de concentración en cualquier inversión >30%
- Correlación de mercado - asegura diversificación verdadera
- Restricciones de liquidez para pivotes rápidos

**Próximas Acciones:**
1. Revisa activos con bajo rendimiento trimestralmente
2. Establece stop-losses estrictos en posiciones especulativas
3. Construye una pista de 6 meses en activos líquidos

¿Te gustaría profundizar en alguna de estas áreas?`
    }

    return `**Strategic Analysis for Kev Strategy:**

Given your current position at $${(context.netWorth / 1_000_000).toFixed(0)}M, here's my assessment:

**Strengths:**
- Strong ${context.monthlyGrowth}% monthly compound rate
- Diversified across ${context.projects.length} investments
- Active management approach working well

**Opportunities:**
1. **Scale winners aggressively** - Your top performers deserve more capital
2. **Asymmetric bets** - Allocate 10-15% to high-risk/high-reward plays
3. **Geographic expansion** - Consider emerging markets for alpha

**Risks to Monitor:**
- Concentration risk in any single investment >30%
- Market correlation - ensure true diversification
- Liquidity constraints for quick pivots

**Next Actions:**
1. Review underperforming assets quarterly
2. Set strict stop-losses on speculative positions
3. Build a 6-month runway in liquid assets

Want me to dive deeper into any of these areas?`
  }

  // Market/opportunity
  if (q.includes("market") || q.includes("mercado") || q.includes("opportunity") || q.includes("oportunidad")) {
    if (isSpanish) {
      return `**Oportunidades de Mercado Actuales (Análisis IA):**

Basado en tendencias macro y tu perfil de inversión:

**Sectores de Alta Convicción:**
1. **Infraestructura IA** - Demanda de cómputo creciendo 50%+ anualmente
2. **Activos Reales** - Cobertura de inflación con flujo de caja
3. **Tech en Mercados Emergentes** - LATAM y MENA subvaluados

**Jugadas Tácticas:**
- Private equity en mercado secundario (descuentos 30-40%)
- Bienes raíces comerciales en dificultades
- Empresas SaaS nativas de IA

**Evitar:**
- Trades sobrepoblados (meme stocks, crypto obvio)
- Startups de alto burn sin camino a rentabilidad
- Mercados con incertidumbre regulatoria

**Para Tu Portafolio de $${(context.netWorth / 1_000_000).toFixed(0)}M:**
Asignación sugerida: 60% holdings core, 25% crecimiento, 15% apuestas asimétricas

¿Debo elaborar sobre alguna oportunidad específica?`
    }

    return `**Current Market Opportunities (AI Analysis):**

Based on macro trends and your investment profile:

**High Conviction Sectors:**
1. **AI Infrastructure** - Compute demand growing 50%+ annually
2. **Real Assets** - Inflation hedge with cash flow
3. **Emerging Market Tech** - LATAM and MENA undervalued

**Tactical Plays:**
- Secondary market private equity (30-40% discounts)
- Distressed commercial real estate
- AI-native SaaS companies

**Avoid:**
- Overcrowded trades (meme stocks, obvious crypto)
- High-burn startups without path to profitability
- Markets with regulatory uncertainty

**For Your $${(context.netWorth / 1_000_000).toFixed(0)}M Portfolio:**
Suggested allocation: 60% core holdings, 25% growth, 15% asymmetric bets

Should I elaborate on any specific opportunity?`
  }

  // Performance review
  if (
    q.includes("performance") ||
    q.includes("rendimiento") ||
    q.includes("how am i doing") ||
    q.includes("progress") ||
    q.includes("cómo voy") ||
    q.includes("como voy")
  ) {
    const avgReturn = context.projects.reduce((sum, p) => sum + p.change, 0) / context.projects.length

    if (isSpanish) {
      return `**Revisión de Rendimiento:**

**Evaluación General: Excelente** 

Tus métricas:
- Patrimonio Neto: $${(context.netWorth / 1_000_000).toFixed(1)}M
- Crecimiento Mensual: ${context.monthlyGrowth}% (sobre benchmark del 10%)
- Retorno Promedio por Proyecto: ${avgReturn.toFixed(1)}%
- Proyectos Activos: ${context.projects.length}

**Comparación con Constructores de Riqueza:**
- Estás creciendo más rápido que el 95% de portafolios a esta escala
- Tu tasa de composición supera retornos típicos de PE (15-20%)
- Puntaje de diversificación: Bueno

**Áreas de Excelencia:**
✓ Trayectoria de crecimiento consistente
✓ Múltiples fuentes de ingresos
✓ Gestión activa del portafolio

**Sigue haciendo:** Apuestas concentradas de alta convicción en ganadores
**Empieza a hacer:** Documentar la tesis de inversión para cada posición
**Deja de hacer:** Revisar el portafolio diariamente (revisiones mensuales son suficientes)

Estás en un camino excepcional. Mantén el enfoque.`
    }

    return `**Performance Review:**

**Overall Assessment: Excellent** 

Your metrics:
- Net Worth: $${(context.netWorth / 1_000_000).toFixed(1)}M
- Monthly Growth: ${context.monthlyGrowth}% (above 10% benchmark)
- Average Project Return: ${avgReturn.toFixed(1)}%
- Active Projects: ${context.projects.length}

**Comparison to Wealth Builders:**
- You're growing faster than 95% of portfolios at this scale
- Your compound rate beats typical PE returns (15-20%)
- Diversification score: Good

**Areas of Excellence:**
✓ Consistent growth trajectory
✓ Multiple revenue streams
✓ Active portfolio management

**Keep doing:** High-conviction concentrated bets in winners
**Start doing:** Document investment thesis for each position
**Stop doing:** Checking portfolio daily (monthly reviews suffice)

You're on an exceptional path. Stay focused.`
  }

  // Default helpful response
  if (isSpanish) {
    return `Soy tu Asesor de Estrategia IA. Tengo acceso a los datos de tu portafolio en tiempo real:

**Estado Actual:**
- Patrimonio Neto: $${(context.netWorth / 1_000_000).toFixed(1)}M
- Tasa de Crecimiento: ${context.monthlyGrowth}% mensual
- Inversiones Activas: ${context.projects.length}

**Puedo ayudarte con:**
1. **Análisis de Portafolio** - "Analiza el rendimiento de mi portafolio"
2. **Seguimiento de Metas** - "¿Cuánto falta para llegar al billón?"
3. **Consejos de Estrategia** - "¿Cuál es mi mejor movimiento estratégico?"
4. **Oportunidades de Mercado** - "¿Qué oportunidades debo explorar?"
5. **Revisión de Rendimiento** - "¿Cómo voy en general?"

¿Qué te gustaría explorar?`
  }

  return `I'm your AI Strategy Advisor. I have access to your real-time portfolio data:

**Current Status:**
- Net Worth: $${(context.netWorth / 1_000_000).toFixed(1)}M
- Growth Rate: ${context.monthlyGrowth}% monthly
- Active Investments: ${context.projects.length}

**I can help you with:**
1. **Portfolio Analysis** - "Analyze my portfolio performance"
2. **Goal Tracking** - "How long until I reach $1 billion?"
3. **Strategy Advice** - "What's my best strategic move?"
4. **Market Opportunities** - "What opportunities should I explore?"
5. **Performance Review** - "How am I doing overall?"

What would you like to explore?`
}

interface AIAssistantProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AIAssistant({ open, onOpenChange }: AIAssistantProps) {
  const { metrics, projects, goals, t, locale } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const welcomeContent =
      locale === "es"
        ? `¡Bienvenido de nuevo, Kevin! Soy tu Asesor de Estrategia IA.

Estoy conectado a los datos de tu portafolio en vivo mostrando **$${(metrics.netWorth / 1_000_000).toFixed(1)}M** de patrimonio neto con **${metrics.monthlyGrowth}%** de crecimiento mensual.

¿Cómo puedo ayudarte hoy? Intenta preguntar sobre tu portafolio, metas o estrategia.`
        : `Welcome back, Kevin! I'm your AI Strategy Advisor. 

I'm connected to your live portfolio data showing **$${(metrics.netWorth / 1_000_000).toFixed(1)}M** net worth with **${metrics.monthlyGrowth}%** monthly growth.

How can I help you today? Try asking about your portfolio, goals, or strategy.`

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: welcomeContent,
        timestamp: new Date(),
      },
    ])
  }, [locale, metrics.netWorth, metrics.monthlyGrowth])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Simulate AI thinking
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1500))

    const aiResponse = generateAIResponse(
      input,
      {
        netWorth: metrics.netWorth,
        monthlyGrowth: metrics.monthlyGrowth,
        projects: projects.map((p) => ({
          name: p.name,
          value: p.value,
          change: p.change,
          status: p.status,
        })),
        goals: goals.map((g) => ({
          name: g.name,
          targetValue: g.targetValue,
          currentValue: g.currentValue,
          deadline: g.deadline,
        })),
      },
      locale,
    )

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsTyping(false)
  }

  const quickPrompts =
    locale === "es"
      ? [
          { icon: BarChart3, label: "Análisis Portafolio", prompt: "Analiza el rendimiento de mi portafolio" },
          { icon: Target, label: "Camino al Billón", prompt: "¿Cuánto falta para llegar al billón?" },
          { icon: Lightbulb, label: "Estrategia", prompt: "¿Cuál es mi mejor movimiento estratégico ahora?" },
          { icon: TrendingUp, label: "Oportunidades", prompt: "¿Qué oportunidades de mercado debo explorar?" },
        ]
      : [
          { icon: BarChart3, label: "Portfolio Analysis", prompt: "Analyze my portfolio performance" },
          { icon: Target, label: "Billion Path", prompt: "How long until I reach $1 billion?" },
          { icon: Lightbulb, label: "Strategy", prompt: "What's my best strategic move right now?" },
          { icon: TrendingUp, label: "Opportunities", prompt: "What market opportunities should I explore?" },
        ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isExpanded ? "max-w-4xl h-[90vh]" : "max-w-2xl h-[600px]"} flex flex-col p-0 gap-0 transition-all duration-300`}
      >
        <DialogHeader className="px-4 py-3 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  {t.ai.title}
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-kev-primary/10 text-kev-primary rounded-full">
                    {t.ai.beta}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">{t.ai.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""} animate-fade-in-up`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    message.role === "assistant"
                      ? "bg-gradient-to-br from-kev-primary to-kev-primary-light"
                      : "bg-secondary"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <Sparkles className="w-4 h-4 text-white" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}>
                  <div
                    className={`inline-block max-w-[85%] p-3 rounded-xl text-sm ${
                      message.role === "assistant"
                        ? "bg-secondary/50 text-foreground text-left"
                        : "bg-kev-primary text-white"
                    }`}
                  >
                    <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                      {message.content.split("\n").map((line, i) => {
                        // Bold text
                        const boldParsed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: boldParsed }} />
                      })}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 px-1">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 animate-fade-in-up">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-kev-primary" />
                  <span className="text-sm text-muted-foreground">{t.ai.analyzing}</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick prompts */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-border/50">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(prompt.prompt)
                    setTimeout(() => handleSend(), 100)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary/50 hover:bg-secondary rounded-lg transition-colors press-effect"
                >
                  <prompt.icon className="w-3.5 h-3.5 text-kev-primary" />
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border/50 flex-shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={t.ai.placeholder}
              className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-kev-primary/50 transition-colors"
              disabled={isTyping}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-kev-primary hover:bg-kev-primary-light text-white rounded-xl px-4"
            >
              {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Floating button component for easy access
export function AIAssistantButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-kev-primary to-kev-primary-light shadow-lg shadow-kev-primary/25 flex items-center justify-center hover:scale-110 transition-transform press-effect group"
      >
        <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-kev-success rounded-full flex items-center justify-center">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </span>
      </button>
      <AIAssistant open={open} onOpenChange={setOpen} />
    </>
  )
}
