"use client"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  Trophy,
  Medal,
  Star,
  Flame,
  Crown,
  Target,
  Rocket,
  TrendingUp,
  Zap,
  Lock,
  Check,
  Gift,
  Award,
  Sparkles,
} from "lucide-react"

interface Achievement {
  id: string
  titleKey: string
  descKey: string
  icon: typeof Trophy
  category: "milestone" | "streak" | "action" | "special"
  unlocked: boolean
  unlockedAt?: string
  progress?: number
  maxProgress?: number
  xpReward: number
  rarity: "common" | "rare" | "epic" | "legendary"
}

interface DailyStreak {
  current: number
  longest: number
  lastUpdate: string
}

const rarityColors = {
  common: { bg: "bg-zinc-500/10", border: "border-zinc-500/20", text: "text-zinc-400", glow: "" },
  rare: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", glow: "shadow-blue-500/20" },
  epic: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    glow: "shadow-purple-500/20",
  },
  legendary: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    glow: "shadow-amber-500/30 shadow-lg",
  },
}

const categoryIcons = {
  milestone: Target,
  streak: Flame,
  action: Zap,
  special: Crown,
}

const Briefcase = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

export function AchievementsView() {
  const { metrics, projects, pulseEntries, goals, t } = useApp()
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [streak] = useState<DailyStreak>({ current: 7, longest: 15, lastUpdate: new Date().toISOString() })
  const [level] = useState(12)
  const [xp] = useState(2450)
  const [xpToNextLevel] = useState(3000)

  const getRarityName = (rarity: string) => {
    return t.achievements[rarity as keyof typeof t.achievements] || rarity
  }

  // Calculate achievements based on app data
  const achievements: Achievement[] = [
    // Milestone Achievements
    {
      id: "first-million",
      titleKey: "firstMillion",
      descKey: "firstMillionDesc",
      icon: Star,
      category: "milestone",
      unlocked: metrics.netWorth >= 1_000_000,
      progress: Math.min(metrics.netWorth, 1_000_000),
      maxProgress: 1_000_000,
      xpReward: 500,
      rarity: "rare",
    },
    {
      id: "ten-million",
      titleKey: "eightFigure",
      descKey: "eightFigureDesc",
      icon: Medal,
      category: "milestone",
      unlocked: metrics.netWorth >= 10_000_000,
      progress: Math.min(metrics.netWorth, 10_000_000),
      maxProgress: 10_000_000,
      xpReward: 1000,
      rarity: "epic",
    },
    {
      id: "hundred-million",
      titleKey: "centimillionaire",
      descKey: "centimillionaireDesc",
      icon: Trophy,
      category: "milestone",
      unlocked: metrics.netWorth >= 100_000_000,
      progress: Math.min(metrics.netWorth, 100_000_000),
      maxProgress: 100_000_000,
      xpReward: 2500,
      rarity: "legendary",
    },
    {
      id: "billion",
      titleKey: "theBillion",
      descKey: "theBillionDesc",
      icon: Crown,
      category: "milestone",
      unlocked: metrics.netWorth >= 1_000_000_000,
      progress: metrics.netWorth,
      maxProgress: 1_000_000_000,
      xpReward: 10000,
      rarity: "legendary",
    },
    // Streak Achievements
    {
      id: "streak-7",
      titleKey: "weekWarrior",
      descKey: "weekWarriorDesc",
      icon: Flame,
      category: "streak",
      unlocked: streak.current >= 7,
      progress: streak.current,
      maxProgress: 7,
      xpReward: 100,
      rarity: "common",
    },
    {
      id: "streak-30",
      titleKey: "monthlyMaster",
      descKey: "monthlyMasterDesc",
      icon: Flame,
      category: "streak",
      unlocked: streak.current >= 30,
      progress: streak.current,
      maxProgress: 30,
      xpReward: 300,
      rarity: "rare",
    },
    {
      id: "streak-100",
      titleKey: "centuryStreak",
      descKey: "centuryStreakDesc",
      icon: Flame,
      category: "streak",
      unlocked: streak.longest >= 100,
      progress: streak.longest,
      maxProgress: 100,
      xpReward: 1000,
      rarity: "epic",
    },
    // Action Achievements
    {
      id: "first-project",
      titleKey: "portfolioPioneer",
      descKey: "portfolioPioneerDesc",
      icon: Briefcase,
      category: "action",
      unlocked: projects.length >= 1,
      xpReward: 50,
      rarity: "common",
    },
    {
      id: "five-projects",
      titleKey: "diversified",
      descKey: "diversifiedDesc",
      icon: Briefcase,
      category: "action",
      unlocked: projects.length >= 5,
      progress: projects.length,
      maxProgress: 5,
      xpReward: 200,
      rarity: "rare",
    },
    {
      id: "first-pulse",
      titleKey: "voiceHeard",
      descKey: "voiceHeardDesc",
      icon: Zap,
      category: "action",
      unlocked: pulseEntries.length >= 1,
      xpReward: 25,
      rarity: "common",
    },
    {
      id: "goal-setter",
      titleKey: "goalSetter",
      descKey: "goalSetterDesc",
      icon: Target,
      category: "action",
      unlocked: goals.length >= 5,
      progress: goals.length,
      maxProgress: 5,
      xpReward: 150,
      rarity: "common",
    },
    {
      id: "goal-crusher",
      titleKey: "goalCrusher",
      descKey: "goalCrusherDesc",
      icon: Check,
      category: "action",
      unlocked: goals.filter((g) => g.currentValue >= g.targetValue).length >= 3,
      progress: goals.filter((g) => g.currentValue >= g.targetValue).length,
      maxProgress: 3,
      xpReward: 500,
      rarity: "epic",
    },
    // Special Achievements
    {
      id: "double-growth",
      titleKey: "doubleDigits",
      descKey: "doubleDigitsDesc",
      icon: TrendingUp,
      category: "special",
      unlocked: metrics.monthlyGrowth >= 10,
      xpReward: 200,
      rarity: "rare",
    },
    {
      id: "roi-master",
      titleKey: "roiMaster",
      descKey: "roiMasterDesc",
      icon: Rocket,
      category: "special",
      unlocked: metrics.roi >= 30,
      xpReward: 400,
      rarity: "epic",
    },
    {
      id: "early-adopter",
      titleKey: "earlyAdopter",
      descKey: "earlyAdopterDesc",
      icon: Gift,
      category: "special",
      unlocked: true,
      unlockedAt: "2024-01-01",
      xpReward: 100,
      rarity: "rare",
    },
  ]

  const getAchievementTitle = (key: string) => t.achievements[key as keyof typeof t.achievements] || key
  const getAchievementDesc = (key: string) => t.achievements[key as keyof typeof t.achievements] || key

  const getCategoryName = (category: string) => {
    const categoryNames: Record<string, string> = {
      milestone: t.achievements.milestoneAchievements,
      streak: t.achievements.streakAchievements,
      action: t.achievements.actionAchievements,
      special: t.achievements.specialAchievements,
    }
    return categoryNames[category] || category
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalXp = achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.xpReward, 0)

  const handleClaimReward = (achievement: Achievement) => {
    if (achievement.unlocked) {
      toast.success(`+${achievement.xpReward} ${t.achievements.xpClaimed}`)
      setSelectedAchievement(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t.achievements.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.achievements.subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t.achievements.unlocked}</div>
            <div className="text-lg font-semibold">
              {unlockedCount}/{achievements.length}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t.achievements.totalXp}</div>
            <div className="text-lg font-semibold text-kev-primary">{totalXp.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Level and XP Progress */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{level}</span>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t.achievements.level}</div>
              <div className="text-xl font-semibold">{t.achievements.empireBuilder}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">
              {t.achievements.xpToNextLevel} {level + 1}
            </div>
            <div className="text-sm font-medium">
              {xp.toLocaleString()} / {xpToNextLevel.toLocaleString()}
            </div>
          </div>
        </div>
        <Progress value={(xp / xpToNextLevel) * 100} className="h-3 bg-secondary" />
      </div>

      {/* Daily Streak */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t.achievements.currentStreak}</div>
              <div className="text-2xl font-bold">
                {streak.current} {t.achievements.days}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{t.achievements.longestStreak}</div>
            <div className="text-lg font-semibold text-amber-400">
              {streak.longest} {t.achievements.days}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full ${i < (streak.current % 7 || 7) ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-secondary"}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {7 - (streak.current % 7 || 7)} {t.achievements.daysUntilBonus}
        </p>
      </div>

      {/* Achievements Grid by Category */}
      {(["milestone", "streak", "action", "special"] as const).map((category) => {
        const categoryAchievements = achievements.filter((a) => a.category === category)
        const CategoryIcon = categoryIcons[category]

        return (
          <div key={category} className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-2">
              <CategoryIcon className="w-4 h-4" />
              {getCategoryName(category)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryAchievements.map((achievement) => {
                const rarity = rarityColors[achievement.rarity]
                const Icon = achievement.icon

                return (
                  <button
                    key={achievement.id}
                    onClick={() => setSelectedAchievement(achievement)}
                    className={`glass-card p-4 text-left transition-all hover:scale-[1.02] ${
                      achievement.unlocked ? `${rarity.glow}` : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${rarity.bg} ${rarity.border} border`}
                      >
                        {achievement.unlocked ? (
                          <Icon className={`w-6 h-6 ${rarity.text}`} />
                        ) : (
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-medium truncate ${!achievement.unlocked && "text-muted-foreground"}`}>
                            {getAchievementTitle(achievement.titleKey)}
                          </h3>
                          {achievement.unlocked && <Check className="w-4 h-4 text-kev-success flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {getAchievementDesc(achievement.descKey)}
                        </p>
                        {achievement.progress !== undefined && achievement.maxProgress && (
                          <div className="mt-2">
                            <Progress
                              value={(achievement.progress / achievement.maxProgress) * 100}
                              className="h-1.5"
                            />
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {achievement.progress.toLocaleString()} / {achievement.maxProgress.toLocaleString()}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${rarity.bg} ${rarity.text}`}>
                            {getRarityName(achievement.rarity)}
                          </span>
                          <span className="text-[10px] text-kev-primary">+{achievement.xpReward} XP</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Achievement Detail Dialog */}
      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="max-w-md">
          {selectedAchievement && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${rarityColors[selectedAchievement.rarity].bg} ${rarityColors[selectedAchievement.rarity].border} border`}
                  >
                    <selectedAchievement.icon className={`w-6 h-6 ${rarityColors[selectedAchievement.rarity].text}`} />
                  </div>
                  <div>
                    <div className="text-lg">{getAchievementTitle(selectedAchievement.titleKey)}</div>
                    <div className={`text-xs ${rarityColors[selectedAchievement.rarity].text} font-normal`}>
                      {getRarityName(selectedAchievement.rarity)}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <p className="text-muted-foreground">{getAchievementDesc(selectedAchievement.descKey)}</p>

                {selectedAchievement.progress !== undefined && selectedAchievement.maxProgress && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t.goals.progress}</span>
                      <span className="font-medium">
                        {((selectedAchievement.progress / selectedAchievement.maxProgress) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={(selectedAchievement.progress / selectedAchievement.maxProgress) * 100} />
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedAchievement.progress.toLocaleString()} /{" "}
                      {selectedAchievement.maxProgress.toLocaleString()}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t.achievements.xpReward}</span>
                  <span className="text-lg font-semibold text-kev-primary flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    {selectedAchievement.xpReward} XP
                  </span>
                </div>

                {selectedAchievement.unlocked ? (
                  <div className="flex items-center justify-center gap-2 p-4 bg-kev-success/10 rounded-lg border border-kev-success/20">
                    <Award className="w-5 h-5 text-kev-success" />
                    <span className="text-kev-success font-medium">{t.achievements.achievementUnlocked}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-4 bg-secondary/30 rounded-lg">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.achievements.keepGoing}</span>
                  </div>
                )}
              </div>
              {selectedAchievement.unlocked && (
                <Button onClick={() => handleClaimReward(selectedAchievement)} className="w-full bg-kev-primary">
                  <Gift className="w-4 h-4 mr-2" />
                  {t.achievements.claimReward}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
