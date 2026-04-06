
CREATE OR REPLACE FUNCTION public.create_default_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type) VALUES
    (NEW.id, 'Business Income', 'INCOME'),
    (NEW.id, 'Personal Income', 'INCOME'),
    (NEW.id, 'Loans Received', 'INCOME'),
    (NEW.id, 'Other Income', 'INCOME'),
    (NEW.id, 'Business Expenses', 'EXPENSE'),
    (NEW.id, 'Personal Expenses', 'EXPENSE'),
    (NEW.id, 'Person 1', 'EXPENSE'),
    (NEW.id, 'Person 2', 'EXPENSE'),
    (NEW.id, 'Loans Given', 'EXPENSE'),
    (NEW.id, 'Other Expense', 'EXPENSE');
  RETURN NEW;
END;
$$;
