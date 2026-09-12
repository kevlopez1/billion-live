"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

// ──────────────────────────────────────────────────────────────
// CUENTAS DEL RETO
//
// La identidad la maneja Supabase Auth. Acá NO se toca una contraseña: el
// hash, la verificación del correo y el reseteo los hace Supabase.
//
// Lo anterior era un usuario y una contraseña escritos a mano en el código,
// que viajaban dentro del bundle público: cualquiera que abriera las
// herramientas del navegador las leía. Eso se eliminó por completo.
// ──────────────────────────────────────────────────────────────

export type Perfil = {
  id: string
  email: string
  nombre: string
  novedades: boolean
}

type AuthContextType = {
  perfil: Perfil | null
  cargando: boolean
  /** true mientras el correo no esté verificado. */
  faltaVerificar: boolean
  registrar: (d: { email: string; password: string; nombre: string; novedades: boolean }) => Promise<Resultado>
  entrar: (email: string, password: string) => Promise<Resultado>
  salir: () => Promise<void>
  recuperar: (email: string) => Promise<Resultado>
  cambiarNovedades: (quiere: boolean) => Promise<Resultado>
}

export type Resultado = { ok: true; aviso?: string } | { ok: false; error: string }

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Supabase devuelve los errores en inglés y con jerga. La gente que entra acá
// merece leer qué pasó, no "Invalid login credentials".
function traducir(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos."
  if (m.includes("email not confirmed")) return "Te falta confirmar el correo. Revisá tu bandeja."
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Ese correo ya tiene cuenta. Probá entrar."
  if (m.includes("password should be at least")) return "La contraseña necesita al menos 8 caracteres."
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Ese correo no parece válido."
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Esperá un momento."
  if (m.includes("failed to fetch") || m.includes("network")) return "No hay conexión. Probá de nuevo."
  return "No se pudo completar. Probá de nuevo en un momento."
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  // Trae el perfil propio. RLS garantiza que solo devuelve el de uno mismo.
  const traerPerfil = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setPerfil(null)
      return
    }
    const { data } = await supabase
      .from("perfiles")
      .select("id, email, nombre, novedades")
      .eq("id", s.user.id)
      .maybeSingle()

    // Si el perfil todavía no existe (el trigger corre un instante después del
    // alta), no dejamos la sesión sin datos: mostramos lo que ya sabemos.
    setPerfil(
      data ?? {
        id: s.user.id,
        email: s.user.email ?? "",
        nombre: (s.user.user_metadata?.nombre as string) ?? "",
        novedades: Boolean(s.user.user_metadata?.novedades),
      },
    )
  }, [])

  useEffect(() => {
    let vivo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSession(data.session)
      traerPerfil(data.session).finally(() => vivo && setCargando(false))
    })

    // Mantiene la sesión al día entre pestañas y cuando el token se renueva.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (!vivo) return
      setSession(s)
      traerPerfil(s)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [traerPerfil])

  const registrar: AuthContextType["registrar"] = useCallback(async ({ email, password, nombre, novedades }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // El trigger de la base lee esto para armar el perfil.
        data: { nombre: nombre.trim(), novedades },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/cuenta` : undefined,
      },
    })
    if (error) return { ok: false, error: traducir(error.message) }
    if (data.user && !data.session) {
      return { ok: true, aviso: "Te mandamos un correo para confirmar la cuenta. Revisá tu bandeja (y el spam)." }
    }
    return { ok: true }
  }, [])

  const entrar: AuthContextType["entrar"] = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, error: traducir(error.message) }
    return { ok: true }
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null)
  }, [])

  const recuperar: AuthContextType["recuperar"] = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/cuenta` : undefined,
    })
    // A propósito no decimos si el correo existe o no: eso permitiría averiguar
    // quién tiene cuenta probando correos uno por uno.
    if (error) return { ok: false, error: traducir(error.message) }
    return { ok: true, aviso: "Si ese correo tiene cuenta, te llega un enlace para cambiar la contraseña." }
  }, [])

  const cambiarNovedades: AuthContextType["cambiarNovedades"] = useCallback(
    async (quiere) => {
      if (!perfil) return { ok: false, error: "Entrá a tu cuenta primero." }
      const { error } = await supabase
        .from("perfiles")
        .update({ novedades: quiere, novedades_desde: quiere ? new Date().toISOString() : null })
        .eq("id", perfil.id)
      if (error) return { ok: false, error: traducir(error.message) }
      setPerfil({ ...perfil, novedades: quiere })
      return { ok: true }
    },
    [perfil],
  )

  return (
    <AuthContext.Provider
      value={{
        perfil,
        cargando,
        faltaVerificar: Boolean(session?.user && !session.user.email_confirmed_at),
        registrar,
        entrar,
        salir,
        recuperar,
        cambiarNovedades,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth necesita estar dentro de AuthProvider")
  return ctx
}
