
-- Loan type enum
CREATE TYPE public.loan_type AS ENUM ('GIVEN', 'RECEIVED');
CREATE TYPE public.loan_status AS ENUM ('PENDING', 'PAID');

-- Loans table
CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  type loan_type NOT NULL,
  status loan_status NOT NULL DEFAULT 'PENDING',
  description TEXT,
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own loans"
  ON public.loans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Daily notes table
CREATE TABLE public.daily_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  note_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes"
  ON public.daily_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_loans_user_status ON public.loans(user_id, status);
CREATE INDEX idx_loans_type ON public.loans(user_id, type);
CREATE INDEX idx_daily_notes_date ON public.daily_notes(user_id, note_date);
