
-- ============ EXTEND TRANSACTIONS ============
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RWF',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,6) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS transaction_fee NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS merchant_name TEXT,
  ADD COLUMN IF NOT EXISTS merchant_phone TEXT,
  ADD COLUMN IF NOT EXISTS merchant_location TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS place_type TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS income_source TEXT,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS life_event TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============ ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'CASH', -- CASH, BANK, MOBILE_MONEY, CREDIT_CARD, DEBIT_CARD, SAVINGS, INVESTMENT, CRYPTO, DIGITAL
  account_number TEXT,
  currency TEXT NOT NULL DEFAULT 'RWF',
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRANSACTION ATTACHMENTS ============
CREATE TABLE IF NOT EXISTS public.transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  kind TEXT DEFAULT 'receipt', -- receipt, invoice, photo, voice, document
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_attachments TO authenticated;
GRANT ALL ON public.transaction_attachments TO service_role;
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments" ON public.transaction_attachments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tx_att_tx ON public.transaction_attachments(transaction_id);

-- ============ FINANCIAL GOALS ============
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,
  name TEXT NOT NULL,
  category TEXT, -- car, house, wedding, vacation, emergency, education, business, other
  target_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_date DATE,
  icon TEXT,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goals TO authenticated;
GRANT ALL ON public.financial_goals TO service_role;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.financial_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ GOAL CONTRIBUTIONS ============
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  contributed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_contributions TO authenticated;
GRANT ALL ON public.goal_contributions TO service_role;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goal contrib" ON public.goal_contributions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep financial_goals.current_amount in sync
CREATE OR REPLACE FUNCTION public.apply_goal_contribution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.financial_goals
      SET current_amount = current_amount + NEW.amount,
          status = CASE WHEN current_amount + NEW.amount >= target_amount THEN 'completed' ELSE status END,
          updated_at = now()
      WHERE id = NEW.goal_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.financial_goals
      SET current_amount = GREATEST(0, current_amount - OLD.amount), updated_at = now()
      WHERE id = OLD.goal_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_goal_contribution
AFTER INSERT OR DELETE ON public.goal_contributions
FOR EACH ROW EXECUTE FUNCTION public.apply_goal_contribution();

-- ============ SPENDING CHALLENGES ============
CREATE TABLE IF NOT EXISTS public.spending_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  challenge_type TEXT NOT NULL DEFAULT 'no_spend', -- no_spend, save_amount, category_limit
  target_amount NUMERIC(14,2),
  category TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, succeeded, failed, cancelled
  progress NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spending_challenges TO authenticated;
GRANT ALL ON public.spending_challenges TO service_role;
ALTER TABLE public.spending_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges" ON public.spending_challenges FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_challenges_updated BEFORE UPDATE ON public.spending_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ACHIEVEMENT BADGES ============
CREATE TABLE IF NOT EXISTS public.achievement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL, -- budget_master, saver_bronze, debt_free, first_goal, ...
  title TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievement_badges TO authenticated;
GRANT ALL ON public.achievement_badges TO service_role;
ALTER TABLE public.achievement_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badges" ON public.achievement_badges FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ STORAGE RLS on transaction-attachments bucket ============
CREATE POLICY "tx_att read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'transaction-attachments' AND (auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "tx_att insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'transaction-attachments' AND (auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "tx_att update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'transaction-attachments' AND (auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "tx_att delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'transaction-attachments' AND (auth.uid()::text = (storage.foldername(name))[1]));
