"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { useApp } from "@/context/app-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Eye, EyeOff, Loader2, Lock } from "lucide-react"

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const { login, isLoading } = useAuth()
  const { t } = useApp()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError(t.login.fillAllFields)
      return
    }

    const success = await login(email, password)
    if (success) {
      onOpenChange(false)
      onSuccess?.()
      setEmail("")
      setPassword("")
    } else {
      setError(t.login.invalidCredentials)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-kev-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-kev-primary" />
            </div>
            <div>
              <span className="block">{t.login.adminAccess}</span>
              <span className="text-xs font-normal text-muted-foreground">{t.login.enterCredentials}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.login.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@kevstrategy.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary/50"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t.login.password}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full bg-kev-primary hover:bg-kev-primary-light gap-2" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.login.authenticating}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {t.login.signIn}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">{t.login.protectedArea}</p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
