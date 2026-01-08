-- ====================================
-- SUPABASE DATABASE SETUP
-- Billion Live Dashboard
-- ====================================

-- ====================================
-- 1. CREATE TABLES
-- ====================================

-- Global Metrics Table
-- Stores the main portfolio metrics (Net Worth, Growth, ROI, etc.)
CREATE TABLE IF NOT EXISTS public.global_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    net_worth BIGINT NOT NULL DEFAULT 0,
    monthly_growth DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    roi DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    target_revenue BIGINT NOT NULL DEFAULT 1000000000,
    active_projects INTEGER NOT NULL DEFAULT 0,
    ytd_return DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Daily Pulse Table
-- Stores daily updates and activity feed
CREATE TABLE IF NOT EXISTS public.daily_pulse (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('business', 'networking', 'personal')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    has_image BOOLEAN DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================
-- 2. CREATE INDEXES
-- ====================================

-- Index for faster queries on daily_pulse by timestamp
CREATE INDEX IF NOT EXISTS idx_daily_pulse_timestamp ON public.daily_pulse(timestamp DESC);

-- Index for faster queries on daily_pulse by category
CREATE INDEX IF NOT EXISTS idx_daily_pulse_category ON public.daily_pulse(category);

-- ====================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ====================================

ALTER TABLE public.global_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pulse ENABLE ROW LEVEL SECURITY;

-- ====================================
-- 4. CREATE POLICIES
-- ====================================

-- Allow public read access to global_metrics
DROP POLICY IF EXISTS "Allow public read access to global_metrics" ON public.global_metrics;
CREATE POLICY "Allow public read access to global_metrics"
ON public.global_metrics FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update global_metrics
DROP POLICY IF EXISTS "Allow authenticated users to update global_metrics" ON public.global_metrics;
CREATE POLICY "Allow authenticated users to update global_metrics"
ON public.global_metrics FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert global_metrics
DROP POLICY IF EXISTS "Allow authenticated users to insert global_metrics" ON public.global_metrics;
CREATE POLICY "Allow authenticated users to insert global_metrics"
ON public.global_metrics FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow public read access to daily_pulse
DROP POLICY IF EXISTS "Allow public read access to daily_pulse" ON public.daily_pulse;
CREATE POLICY "Allow public read access to daily_pulse"
ON public.daily_pulse FOR SELECT
TO public
USING (true);

-- Allow authenticated users to insert daily_pulse
DROP POLICY IF EXISTS "Allow authenticated users to insert daily_pulse" ON public.daily_pulse;
CREATE POLICY "Allow authenticated users to insert daily_pulse"
ON public.daily_pulse FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete daily_pulse
DROP POLICY IF EXISTS "Allow authenticated users to delete daily_pulse" ON public.daily_pulse;
CREATE POLICY "Allow authenticated users to delete daily_pulse"
ON public.daily_pulse FOR DELETE
TO authenticated
USING (true);

-- ====================================
-- 5. CREATE FUNCTION FOR UPDATED_AT
-- ====================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================================
-- 6. CREATE TRIGGERS
-- ====================================

-- Trigger to update updated_at on global_metrics
DROP TRIGGER IF EXISTS update_global_metrics_updated_at ON public.global_metrics;
CREATE TRIGGER update_global_metrics_updated_at
    BEFORE UPDATE ON public.global_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================
-- 7. INSERT SEED DATA
-- ====================================

-- Insert initial global metrics
INSERT INTO public.global_metrics (
    net_worth,
    monthly_growth,
    roi,
    target_revenue,
    active_projects,
    ytd_return
) VALUES (
    225234891,      -- $225.2M Net Worth
    12.4,           -- 12.4% Monthly Growth
    34.2,           -- 34.2% ROI
    1000000000,     -- $1B Target
    7,              -- 7 Active Projects
    34.2            -- 34.2% YTD Return
)
ON CONFLICT DO NOTHING;

-- Insert sample daily pulse entries
INSERT INTO public.daily_pulse (content, category, timestamp, has_image, image_url) VALUES
(
    'Just closed a $12M real estate deal in Downtown Dubai. The team executed flawlessly. This is what happens when preparation meets opportunity.',
    'business',
    timezone('utc'::text, now() - interval '2 hours'),
    false,
    null
),
(
    'Coffee meeting with a founder building AI infrastructure. The next wave is here and we''re positioning early.',
    'networking',
    timezone('utc'::text, now() - interval '5 hours'),
    false,
    null
),
(
    'Morning routine complete: 5am wake up, cold plunge, 2 hours of deep work before the world wakes up. Non-negotiables.',
    'personal',
    timezone('utc'::text, now() - interval '9 hours'),
    false,
    null
),
(
    'Apex Ventures Series B closed at $42.8M valuation. 18.2% growth in Q4. The VC portfolio is performing beyond expectations.',
    'business',
    timezone('utc'::text, now() - interval '1 day'),
    false,
    null
),
(
    'Dinner with three unicorn founders tonight. The conversations at this level are completely different. Everyone is building for decades, not quarters.',
    'networking',
    timezone('utc'::text, now() - interval '1 day 6 hours'),
    false,
    null
),
(
    'Started reading "The Psychology of Money" again. Some books deserve to be read annually. Mindset determines everything.',
    'personal',
    timezone('utc'::text, now() - interval '2 days'),
    false,
    null
),
(
    'Neural Labs just hit $8.2M valuation with 24.5% growth. AI/ML investments are the future. Doubled down on this position.',
    'business',
    timezone('utc'::text, now() - interval '3 days'),
    false,
    null
),
(
    'Dubai Tech Summit keynote delivered. Shared our journey from $0 to $225M. The room was silent. That''s when you know the message landed.',
    'networking',
    timezone('utc'::text, now() - interval '4 days'),
    false,
    null
)
ON CONFLICT DO NOTHING;

-- ====================================
-- 8. ENABLE REALTIME
-- ====================================

-- Enable realtime for global_metrics table
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_metrics;

-- Enable realtime for daily_pulse table
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_pulse;

-- ====================================
-- SETUP COMPLETE
-- ====================================

-- Verify the setup
SELECT 'Setup complete! Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('global_metrics', 'daily_pulse');

SELECT 'Total records in global_metrics:' as info, COUNT(*) as count FROM public.global_metrics;
SELECT 'Total records in daily_pulse:' as info, COUNT(*) as count FROM public.daily_pulse;
