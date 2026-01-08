"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/context/app-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  Bell,
  Target,
  Briefcase,
  User,
  Trash2,
  Edit,
  Check,
} from "lucide-react"

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  type: "meeting" | "deadline" | "reminder" | "goal" | "personal"
  description?: string
  completed: boolean
}

const initialEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Q1 Portfolio Review",
    date: "2025-01-15",
    time: "10:00",
    type: "meeting",
    description: "Review all investments performance",
    completed: false,
  },
  {
    id: "2",
    title: "Neural Labs Board Meeting",
    date: "2025-01-20",
    time: "14:00",
    type: "meeting",
    description: "Monthly board sync",
    completed: false,
  },
  {
    id: "3",
    title: "Tax Documents Deadline",
    date: "2025-01-31",
    type: "deadline",
    description: "Submit all tax documents",
    completed: false,
  },
  {
    id: "4",
    title: "Podcast Launch",
    date: "2025-03-31",
    type: "goal",
    description: "Launch The Billion Live podcast",
    completed: false,
  },
  {
    id: "5",
    title: "Morning Routine Check",
    date: "2025-01-07",
    time: "05:00",
    type: "reminder",
    description: "5AM wake up, cold plunge, deep work",
    completed: true,
  },
]

const eventTypeConfig = {
  meeting: { icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  deadline: { icon: Clock, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  reminder: { icon: Bell, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  goal: { icon: Target, color: "text-kev-primary", bg: "bg-kev-primary/10", border: "border-kev-primary/20" },
  personal: { icon: User, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
}

export function CalendarView() {
  const { t, goals, locale } = useApp()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)

  // Form state
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    type: "meeting" as CalendarEvent["type"],
    description: "",
  })

  // Get calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days: Date[] = []
    const current = new Date(startDate)
    while (days.length < 42) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return { year, month, firstDay, lastDay, days }
  }, [currentDate])

  // Combine events with goals
  const allEvents = useMemo(() => {
    const goalEvents: CalendarEvent[] = goals.map((g) => ({
      id: `goal-${g.id}`,
      title: g.name,
      date: g.deadline,
      type: "goal" as const,
      description: `${t.goals.targetValue}: $${g.targetValue.toLocaleString()}`,
      completed: g.currentValue >= g.targetValue,
    }))
    return [...events, ...goalEvents]
  }, [events, goals, t])

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return allEvents.filter((e) => e.date === dateStr)
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) {
      toast.error(t.calendar.fillRequired)
      return
    }

    const event: CalendarEvent = {
      id: Date.now().toString(),
      ...newEvent,
      completed: false,
    }

    setEvents((prev) => [...prev, event])
    setAddEventOpen(false)
    setNewEvent({ title: "", date: "", time: "", type: "meeting", description: "" })
    toast.success(t.calendar.eventAdded)
  }

  const handleUpdateEvent = () => {
    if (!editEvent) return

    setEvents((prev) => prev.map((e) => (e.id === editEvent.id ? editEvent : e)))
    setEditEvent(null)
    toast.success(t.calendar.eventUpdated)
  }

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    toast.success(t.calendar.eventDeleted)
  }

  const handleToggleComplete = (id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)))
  }

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  // Upcoming events
  const upcomingEvents = allEvents
    .filter((e) => e.date >= todayStr && !e.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const monthNames = t.calendar.monthNames
  const dayNames = t.calendar.dayNames

  const eventTypeNames: Record<string, string> = {
    meeting: t.calendar.meeting,
    deadline: t.calendar.deadline,
    reminder: t.calendar.reminder,
    goal: t.calendar.goal,
    personal: t.calendar.personalEvent,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t.calendar.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.calendar.subtitle}</p>
        </div>
        <Button onClick={() => setAddEventOpen(true)} className="bg-kev-primary hover:bg-kev-primary-light gap-2">
          <Plus className="w-4 h-4" />
          {t.calendar.addEvent}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 glass-card p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {monthNames[calendarData.month]} {calendarData.year}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs px-3">
                {t.calendar.today}
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarData.days.map((date, i) => {
              const isCurrentMonth = date.getMonth() === calendarData.month
              const isToday = date.toISOString().split("T")[0] === todayStr
              const dateEvents = getEventsForDate(date)
              const dateStr = date.toISOString().split("T")[0]

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[80px] p-1.5 rounded-lg border transition-all text-left ${
                    isCurrentMonth ? "bg-secondary/30" : "bg-secondary/10 opacity-50"
                  } ${isToday ? "border-kev-primary ring-1 ring-kev-primary/20" : "border-border/30"} ${
                    selectedDate === dateStr ? "ring-2 ring-kev-primary" : ""
                  } hover:border-kev-primary/50`}
                >
                  <div
                    className={`text-xs font-medium mb-1 ${
                      isToday ? "text-kev-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dateEvents.slice(0, 2).map((event) => {
                      const config = eventTypeConfig[event.type]
                      return (
                        <div
                          key={event.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate ${config.bg} ${config.color} ${event.completed ? "line-through opacity-60" : ""}`}
                        >
                          {event.title}
                        </div>
                      )
                    })}
                    {dateEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dateEvents.length - 2} {t.calendar.more}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-kev-primary" />
              {t.calendar.upcoming}
            </h3>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t.calendar.noEvents}</p>
              ) : (
                upcomingEvents.map((event) => {
                  const config = eventTypeConfig[event.type]
                  const Icon = config.icon
                  const daysUntil = Math.ceil(
                    (new Date(event.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                  )

                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 ${config.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{event.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.date).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {event.time && <span className="text-xs text-muted-foreground">{event.time}</span>}
                          </div>
                          <div className={`text-xs mt-1 ${daysUntil <= 3 ? "text-red-500" : "text-muted-foreground"}`}>
                            {daysUntil === 0
                              ? t.calendar.today
                              : daysUntil === 1
                                ? t.calendar.tomorrow
                                : `${daysUntil} ${t.calendar.daysLeft}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Event Types Legend */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">{t.calendar.eventTypes}</h3>
            <div className="space-y-2">
              {Object.entries(eventTypeConfig).map(([type, config]) => {
                const Icon = config.icon
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${config.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">{eventTypeNames[type]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Date Events Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate &&
                new Date(selectedDate).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {selectedDate && getEventsForDate(new Date(selectedDate)).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t.calendar.noEventsThisDay}</p>
            ) : (
              selectedDate &&
              getEventsForDate(new Date(selectedDate)).map((event) => {
                const config = eventTypeConfig[event.type]
                const Icon = config.icon
                const isGoalEvent = event.id.startsWith("goal-")

                return (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border ${config.border} ${event.completed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div>
                          <div className={`font-medium ${event.completed ? "line-through text-muted-foreground" : ""}`}>
                            {event.title}
                          </div>
                          {event.time && <div className="text-xs text-muted-foreground mt-0.5">{event.time}</div>}
                          {event.description && (
                            <div className="text-sm text-muted-foreground mt-1">{event.description}</div>
                          )}
                          <div
                            className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${config.bg} ${config.color}`}
                          >
                            {eventTypeNames[event.type]}
                          </div>
                        </div>
                      </div>
                      {!isGoalEvent && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleComplete(event.id)}
                            className={`p-1.5 rounded-md transition-colors ${
                              event.completed ? "bg-kev-success/10 text-kev-success" : "hover:bg-secondary"
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditEvent(event)}
                            className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setNewEvent((prev) => ({ ...prev, date: selectedDate || "" }))
                setSelectedDate(null)
                setAddEventOpen(true)
              }}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t.calendar.addEventOnDay}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.calendar.addEvent}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t.calendar.eventTitle} *</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t.calendar.eventTitle}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">{t.calendar.eventDate} *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">{t.calendar.eventTime}</Label>
                <Input
                  id="time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t.calendar.eventType}</Label>
              <Select
                value={newEvent.type}
                onValueChange={(value: CalendarEvent["type"]) => setNewEvent((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">{t.calendar.meeting}</SelectItem>
                  <SelectItem value="deadline">{t.calendar.deadline}</SelectItem>
                  <SelectItem value="reminder">{t.calendar.reminder}</SelectItem>
                  <SelectItem value="goal">{t.calendar.goal}</SelectItem>
                  <SelectItem value="personal">{t.calendar.personalEvent}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t.calendar.eventDescription}</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t.calendar.eventDescription}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEventOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAddEvent} className="bg-kev-primary">
              {t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editEvent} onOpenChange={() => setEditEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.calendar.editEvent}</DialogTitle>
          </DialogHeader>
          {editEvent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t.calendar.eventTitle} *</Label>
                <Input
                  id="edit-title"
                  value={editEvent.title}
                  onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">{t.calendar.eventDate} *</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editEvent.date}
                    onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-time">{t.calendar.eventTime}</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editEvent.time || ""}
                    onChange={(e) => setEditEvent({ ...editEvent, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">{t.calendar.eventType}</Label>
                <Select
                  value={editEvent.type}
                  onValueChange={(value: CalendarEvent["type"]) => setEditEvent({ ...editEvent, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">{t.calendar.meeting}</SelectItem>
                    <SelectItem value="deadline">{t.calendar.deadline}</SelectItem>
                    <SelectItem value="reminder">{t.calendar.reminder}</SelectItem>
                    <SelectItem value="goal">{t.calendar.goal}</SelectItem>
                    <SelectItem value="personal">{t.calendar.personalEvent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">{t.calendar.eventDescription}</Label>
                <Textarea
                  id="edit-description"
                  value={editEvent.description || ""}
                  onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleUpdateEvent} className="bg-kev-primary">
              {t.common.update}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
