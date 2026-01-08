"use client"

import { useState } from "react"
import { Heart, MessageCircle, Send, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

const initialMessages = [
  {
    id: "1",
    name: "Alex M.",
    avatar: "AM",
    message: "Your transparency is inspiring. Following the journey from day one!",
    time: "2h ago",
  },
  {
    id: "2",
    name: "Sarah K.",
    avatar: "SK",
    message: "The Manifesto section changed how I think about business. Thank you.",
    time: "4h ago",
  },
  {
    id: "3",
    name: "David L.",
    avatar: "DL",
    message: "Watching you build in public gives me hope for my own journey. Keep going!",
    time: "6h ago",
  },
  {
    id: "4",
    name: "Maria G.",
    avatar: "MG",
    message: "Real numbers, real insights, no BS. This is what the internet needs.",
    time: "8h ago",
  },
  {
    id: "5",
    name: "James W.",
    avatar: "JW",
    message: "From $2.5K to $225M is insane. The journey view is my favorite section.",
    time: "12h ago",
  },
  {
    id: "6",
    name: "Lisa T.",
    avatar: "LT",
    message: "Just shared this with my entire team. Incredible transparency!",
    time: "1d ago",
  },
]

export function CommunityWall() {
  const [messages, setMessages] = useState(initialMessages)
  const [showDialog, setShowDialog] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [userName, setUserName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [likeCount, setLikeCount] = useState(1200)
  const [hasLiked, setHasLiked] = useState(false)

  const handleSubmitMessage = async () => {
    if (!newMessage.trim() || !userName.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    setIsSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 800))

    const initials = userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    const newMsg = {
      id: Date.now().toString(),
      name: userName,
      avatar: initials,
      message: newMessage,
      time: "Just now",
    }

    setMessages((prev) => [newMsg, ...prev])
    setNewMessage("")
    setUserName("")
    setShowDialog(false)
    setIsSubmitting(false)
    toast.success("Message posted successfully!")
  }

  const handleLike = () => {
    if (hasLiked) {
      setLikeCount((prev) => prev - 1)
      setHasLiked(false)
    } else {
      setLikeCount((prev) => prev + 1)
      setHasLiked(true)
      toast.success("Thanks for the support!")
    }
  }

  const formatLikes = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Community Support</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Messages from the community</p>
        </div>
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
            hasLiked ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          }`}
        >
          <Heart className={`w-4 h-4 ${hasLiked ? "fill-current" : ""}`} />
          <span className="font-medium">{formatLikes(likeCount)}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {messages.slice(0, 6).map((msg) => (
          <div
            key={msg.id}
            className="p-4 rounded-xl bg-secondary/30 border border-border/50 hover:border-kev-primary/30 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kev-primary/60 to-kev-primary-light/60 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-medium text-white">{msg.avatar}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{msg.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{msg.time}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{msg.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4 pt-4 border-t border-border/50 text-center">
        <button
          onClick={() => setShowDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-kev-primary hover:bg-kev-primary/10 rounded-lg transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Leave a message
        </button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-kev-primary" />
              Leave a Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Message</label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Share your thoughts..."
                rows={4}
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
              />
            </div>
            <button
              onClick={handleSubmitMessage}
              disabled={isSubmitting || !newMessage.trim() || !userName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSubmitting ? "Posting..." : "Post Message"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
