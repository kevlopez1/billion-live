import { createClient } from '@supabase/supabase-js'

// --- TUS CREDENCIALES ---
const supabaseUrl = "https://llhvnzlbnmoufilxgshv.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHZuemxibm1vdWZpbHhnc2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTQ1OTUsImV4cCI6MjA4MzQ3MDU5NX0.rdIM39PWW6U90JfeRix6B8xdybX-wCFjEnzngsIYrrQ"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- TIPOS ---
export interface GlobalMetrics {
  id: string; net_worth: number; monthly_growth: number; roi: number;
  target_revenue: number; active_projects: number; ytd_return: number;
  created_at: string; updated_at: string;
}

export interface DailyPulse {
  id: string; content: string; category: 'business' | 'networking' | 'personal';
  timestamp: string; has_image: boolean; image_url: string | null;
  created_at: string; mood?: string; revenue?: number; profit?: number; note?: string;
}

export interface Project {
  id: string; name: string; status: string;
  revenue: number; valuation: number; roi: number; created_at: string;
}

// --- LECTURA ---
export const getGlobalMetrics = async (): Promise<GlobalMetrics | null> => {
  const { data } = await supabase.from('global_metrics').select('*').limit(1).single()
  return data
}

export const getProjects = async (): Promise<Project[]> => {
  const { data } = await supabase.from('projects').select('*')
  return data || []
}

export const getDailyPulseEntries = async (): Promise<DailyPulse[]> => {
  const { data } = await supabase.from('daily_pulse').select('*').order('created_at', { ascending: false }).limit(20)
  return data || []
}

// --- ESCRITURA ---
export const updateGlobalMetrics = async (metrics: any) => {
  const existing = await getGlobalMetrics();
  if (!existing) {
    const { data } = await supabase.from('global_metrics').insert([metrics]).select().single()
    return data
  }
  const { data } = await supabase.from('global_metrics').update(metrics).eq('id', existing.id).select().single()
  return data
}

export const addDailyPulseEntry = async (entry: any) => {
  const { data } = await supabase.from('daily_pulse').insert([entry]).select().single()
  return data
}

export const deleteDailyPulseEntry = async (id: string) => {
  const { error } = await supabase.from('daily_pulse').delete().eq('id', id)
  return !error
}

// --- REALTIME (LA PARTE CORREGIDA ✅) ---
// Ahora devolvemos una función () => {} que es lo que React espera para limpiar.

export const subscribeToGlobalMetrics = (cb: any) => {
  const channel = supabase.channel('metrics_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'global_metrics' }, 
    (payload) => cb(payload.new))
    .subscribe()
    
  return () => { supabase.removeChannel(channel) }
}

export const subscribeToProjects = (cb: any) => {
  const channel = supabase.channel('projects_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, 
    (payload) => cb(payload.new, payload.eventType))
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export const subscribeToDailyPulse = (cb: any) => {
  const channel = supabase.channel('pulse_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_pulse' }, 
    (payload) => cb(payload.new, payload.eventType))
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}