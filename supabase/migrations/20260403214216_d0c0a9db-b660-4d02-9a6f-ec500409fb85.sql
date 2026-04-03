
-- Create transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('INCOME', 'EXPENSE');

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type public.transaction_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  quantity INT DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  type public.transaction_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, transaction_date);
CREATE INDEX idx_transactions_type ON public.transactions(type);

-- Daily summary table
CREATE TABLE public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  total_income DECIMAL(14,2) DEFAULT 0,
  total_expense DECIMAL(14,2) DEFAULT 0,
  net_balance DECIMAL(14,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, summary_date)
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own summaries" ON public.daily_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own summaries" ON public.daily_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own summaries" ON public.daily_summaries FOR UPDATE USING (auth.uid() = user_id);

-- Function to recalculate daily summary
CREATE OR REPLACE FUNCTION public.recalculate_daily_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_user UUID;
  v_income DECIMAL(14,2);
  v_expense DECIMAL(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.transaction_date;
    v_user := OLD.user_id;
  ELSE
    v_date := NEW.transaction_date;
    v_user := NEW.user_id;
  END IF;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_income
  FROM public.transactions WHERE user_id = v_user AND transaction_date = v_date AND type = 'INCOME';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_expense
  FROM public.transactions WHERE user_id = v_user AND transaction_date = v_date AND type = 'EXPENSE';

  INSERT INTO public.daily_summaries (user_id, summary_date, total_income, total_expense, net_balance, updated_at)
  VALUES (v_user, v_date, v_income, v_expense, v_income - v_expense, now())
  ON CONFLICT (user_id, summary_date)
  DO UPDATE SET total_income = v_income, total_expense = v_expense, net_balance = v_income - v_expense, updated_at = now();

  -- Also handle old date if transaction date changed
  IF TG_OP = 'UPDATE' AND OLD.transaction_date != NEW.transaction_date THEN
    SELECT COALESCE(SUM(total_amount), 0) INTO v_income
    FROM public.transactions WHERE user_id = OLD.user_id AND transaction_date = OLD.transaction_date AND type = 'INCOME';

    SELECT COALESCE(SUM(total_amount), 0) INTO v_expense
    FROM public.transactions WHERE user_id = OLD.user_id AND transaction_date = OLD.transaction_date AND type = 'EXPENSE';

    INSERT INTO public.daily_summaries (user_id, summary_date, total_income, total_expense, net_balance, updated_at)
    VALUES (OLD.user_id, OLD.transaction_date, v_income, v_expense, v_income - v_expense, now())
    ON CONFLICT (user_id, summary_date)
    DO UPDATE SET total_income = v_income, total_expense = v_expense, net_balance = v_income - v_expense, updated_at = now();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to auto-update daily summary
CREATE TRIGGER trg_recalculate_summary
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.recalculate_daily_summary();

-- Insert default categories function
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type) VALUES
    (NEW.id, 'Drinks', 'INCOME'),
    (NEW.id, 'Food', 'INCOME'),
    (NEW.id, 'Services', 'INCOME'),
    (NEW.id, 'Other Income', 'INCOME'),
    (NEW.id, 'Supplies', 'EXPENSE'),
    (NEW.id, 'Utilities', 'EXPENSE'),
    (NEW.id, 'Rent', 'EXPENSE'),
    (NEW.id, 'Salaries', 'EXPENSE'),
    (NEW.id, 'Transport', 'EXPENSE'),
    (NEW.id, 'Other Expense', 'EXPENSE');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_categories
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();
