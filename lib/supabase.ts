import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// TypeScript types for database tables
export interface GlobalMetrics {
  id: string
  net_worth: number
  monthly_growth: number
  roi: number
  target_revenue: number
  active_projects: number
  ytd_return: number
  created_at: string
  updated_at: string
}

export interface DailyPulse {
  id: string
  content: string
  category: 'business' | 'networking' | 'personal'
  timestamp: string
  has_image: boolean
  image_url: string | null
  created_at: string
}

// Database helper functions
export const getGlobalMetrics = async (): Promise<GlobalMetrics | null> => {
  const { data, error } = await supabase
    .from('global_metrics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching global metrics:', error)
    return null
  }

  return data
}

export const getDailyPulseEntries = async (): Promise<DailyPulse[]> => {
  const { data, error } = await supabase
    .from('daily_pulse')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching daily pulse entries:', error)
    return []
  }

  return data || []
}

export const updateGlobalMetrics = async (
  metrics: Partial<Omit<GlobalMetrics, 'id' | 'created_at' | 'updated_at'>>
): Promise<GlobalMetrics | null> => {
  // Get the first (latest) record
  const { data: existing } = await supabase
    .from('global_metrics')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!existing) {
    // If no record exists, insert a new one
    const { data, error } = await supabase
      .from('global_metrics')
      .insert([metrics])
      .select()
      .single()

    if (error) {
      console.error('Error inserting global metrics:', error)
      return null
    }

    return data
  }

  // Update existing record
  const { data, error } = await supabase
    .from('global_metrics')
    .update(metrics)
    .eq('id', existing.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating global metrics:', error)
    return null
  }

  return data
}

export const addDailyPulseEntry = async (
  entry: Omit<DailyPulse, 'id' | 'created_at' | 'timestamp'>
): Promise<DailyPulse | null> => {
  const { data, error } = await supabase
    .from('daily_pulse')
    .insert([
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('Error adding daily pulse entry:', error)
    return null
  }

  return data
}

export const deleteDailyPulseEntry = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('daily_pulse').delete().eq('id', id)

  if (error) {
    console.error('Error deleting daily pulse entry:', error)
    return false
  }

  return true
}

// Real-time subscription helpers
export const subscribeToGlobalMetrics = (
  callback: (metrics: GlobalMetrics) => void
) => {
  const channel = supabase
    .channel('global_metrics_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'global_metrics',
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as GlobalMetrics)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export const subscribeToDailyPulse = (
  callback: (pulse: DailyPulse, event: 'INSERT' | 'UPDATE' | 'DELETE') => void
) => {
  const channel = supabase
    .channel('daily_pulse_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_pulse',
      },
      (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          callback(payload.new as DailyPulse, 'INSERT')
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          callback(payload.new as DailyPulse, 'UPDATE')
        } else if (payload.eventType === 'DELETE' && payload.old) {
          callback(payload.old as DailyPulse, 'DELETE')
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
