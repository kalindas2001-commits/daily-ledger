-- Fix loan status enum casting in apply_loan_tx trigger
CREATE OR REPLACE FUNCTION public.apply_loan_tx() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_loan RECORD;
BEGIN
  SELECT * INTO v_loan FROM public.loans WHERE id = NEW.loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;

  IF NEW.action = 'ADD' THEN
    UPDATE public.loans
      SET amount = amount + NEW.amount,
          original_amount = COALESCE(original_amount,0) + NEW.amount,
          status = 'PENDING'::loan_status,
          paid_date = NULL,
          updated_at = now()
      WHERE id = NEW.loan_id;
  ELSIF NEW.action = 'FULL_REPAY' THEN
    UPDATE public.loans
      SET amount = 0, status = 'PAID'::loan_status, paid_date = CURRENT_DATE, updated_at = now()
      WHERE id = NEW.loan_id;
  ELSIF NEW.action = 'PARTIAL' THEN
    UPDATE public.loans
      SET amount = GREATEST(0, amount - NEW.amount),
          status = CASE WHEN amount - NEW.amount <= 0 THEN 'PAID'::loan_status ELSE 'PENDING'::loan_status END,
          paid_date = CASE WHEN amount - NEW.amount <= 0 THEN CURRENT_DATE ELSE NULL END,
          updated_at = now()
      WHERE id = NEW.loan_id;
  END IF;
  RETURN NEW;
END $$;
