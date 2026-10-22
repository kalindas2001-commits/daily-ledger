CREATE TABLE public.capture_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tenant_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('sms','document','statement')), enabled boolean NOT NULL DEFAULT true, consent_version text NOT NULL DEFAULT '2026-10-22', consented_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,kind));
GRANT SELECT ON public.capture_sources TO authenticated; GRANT ALL ON public.capture_sources TO service_role;
ALTER TABLE public.capture_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_sources_owner ON public.capture_sources FOR SELECT TO authenticated USING(user_id=auth.uid() AND tenant_id=public.get_my_tenant());
CREATE TABLE public.capture_import_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tenant_id uuid NOT NULL, source_id uuid NOT NULL REFERENCES public.capture_sources(id), file_name text NOT NULL, input_hash text NOT NULL, parser_version text NOT NULL, status text NOT NULL DEFAULT 'review', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,source_id,input_hash));
GRANT SELECT ON public.capture_import_jobs TO authenticated; GRANT ALL ON public.capture_import_jobs TO service_role;
ALTER TABLE public.capture_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_jobs_owner ON public.capture_import_jobs FOR SELECT TO authenticated USING(user_id=auth.uid() AND tenant_id=public.get_my_tenant());
CREATE TABLE public.capture_evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.capture_import_jobs(id), user_id uuid NOT NULL, tenant_id uuid NOT NULL, raw_text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.capture_evidence TO authenticated; GRANT ALL ON public.capture_evidence TO service_role;
ALTER TABLE public.capture_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_evidence_owner ON public.capture_evidence FOR SELECT TO authenticated USING(user_id=auth.uid() AND tenant_id=public.get_my_tenant());
CREATE TABLE public.capture_candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.capture_import_jobs(id), evidence_id uuid NOT NULL REFERENCES public.capture_evidence(id), user_id uuid NOT NULL, tenant_id uuid NOT NULL, account_id uuid, amount_minor bigint, currency text NOT NULL DEFAULT 'RWF', direction text, treatment text NOT NULL DEFAULT 'unknown', occurred_on date, occurred_time time, provider text NOT NULL DEFAULT 'Unknown', reference text, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '', evidence_excerpt text NOT NULL DEFAULT '', findings jsonb NOT NULL DEFAULT '[]', field_confidence jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'needs_review' CHECK(status IN ('needs_review','posted','duplicate_linked','rejected','deferred')), version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), posted_at timestamptz);
GRANT SELECT ON public.capture_candidates TO authenticated; GRANT ALL ON public.capture_candidates TO service_role;
ALTER TABLE public.capture_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_candidates_owner ON public.capture_candidates FOR SELECT TO authenticated USING(user_id=auth.uid() AND tenant_id=public.get_my_tenant());
CREATE TABLE public.capture_posting_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tenant_id uuid NOT NULL, candidate_id uuid NOT NULL UNIQUE REFERENCES public.capture_candidates(id), transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL, account_id uuid NOT NULL, provider text NOT NULL, reference text, treatment text NOT NULL, amount_minor bigint NOT NULL, direction text NOT NULL, balance_applied boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX capture_reference_identity ON public.capture_posting_links(user_id,account_id,provider,reference,treatment) WHERE reference IS NOT NULL AND reference<>'';
GRANT SELECT ON public.capture_posting_links TO authenticated; GRANT ALL ON public.capture_posting_links TO service_role;
ALTER TABLE public.capture_posting_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_links_owner ON public.capture_posting_links FOR SELECT TO authenticated USING(user_id=auth.uid() AND tenant_id=public.get_my_tenant());
CREATE TABLE public.capture_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tenant_id uuid NOT NULL, candidate_id uuid, job_id uuid, event text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.capture_audit_events TO authenticated; GRANT ALL ON public.capture_audit_events TO service_role;
ALTER TABLE public.capture_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_audit_owner ON public.capture_audit_events FOR SELECT TO authenticated USING(user_id=auth.uid() AND tenant_id=public.get_my_tenant());
CREATE FUNCTION public.capture_set_consent(_kind text, _enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid:=public.get_my_tenant();
BEGIN
 IF uid IS NULL OR tid IS NULL OR _kind NOT IN ('sms','document','statement') THEN RAISE EXCEPTION 'Invalid source or session'; END IF;
 INSERT INTO public.capture_sources(user_id,tenant_id,kind,enabled) VALUES(uid,tid,_kind,_enabled) ON CONFLICT(user_id,kind) DO UPDATE SET enabled=_enabled,consented_at=now();
 INSERT INTO public.capture_audit_events(user_id,tenant_id,event,details) VALUES(uid,tid,CASE WHEN _enabled THEN 'consent_granted' ELSE 'consent_revoked' END,jsonb_build_object('source',_kind));
END $$;
CREATE FUNCTION public.capture_register_import(_kind text,_file_name text,_raw_text text,_account_id uuid,_records jsonb,_parser_version text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid:=public.get_my_tenant(); sid uuid; jid uuid; eid uuid; rec jsonb; hash text;
BEGIN
 IF uid IS NULL OR tid IS NULL THEN RAISE EXCEPTION 'Sign in to import'; END IF;
 SELECT id INTO sid FROM capture_sources WHERE user_id=uid AND tenant_id=tid AND kind=_kind AND enabled FOR UPDATE;
 IF sid IS NULL THEN RAISE EXCEPTION 'Source consent is required'; END IF;
 IF length(_raw_text)=0 OR octet_length(_raw_text)>1000000 OR length(_file_name)>255 OR jsonb_typeof(_records)<>'array' OR jsonb_array_length(_records)>200 OR jsonb_array_length(_records)=0 THEN RAISE EXCEPTION 'Import must contain 1–200 records and at most 1 MB of text'; END IF;
 IF NOT EXISTS(SELECT 1 FROM accounts WHERE id=_account_id AND user_id=uid AND NOT is_archived AND currency='RWF') THEN RAISE EXCEPTION 'Select your active RWF account'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(uid::text||sid::text));
 hash:=encode(sha256(convert_to(_account_id::text||trim(_raw_text),'UTF8')),'hex');
 SELECT id INTO jid FROM capture_import_jobs WHERE user_id=uid AND source_id=sid AND input_hash=hash;
 IF jid IS NOT NULL THEN RETURN jid; END IF;
 INSERT INTO capture_import_jobs(user_id,tenant_id,source_id,file_name,input_hash,parser_version) VALUES(uid,tid,sid,_file_name,hash,left(_parser_version,100)) RETURNING id INTO jid;
 INSERT INTO capture_evidence(job_id,user_id,tenant_id,raw_text) VALUES(jid,uid,tid,_raw_text) RETURNING id INTO eid;
 FOR rec IN SELECT value FROM jsonb_array_elements(_records) LOOP
 INSERT INTO capture_candidates(job_id,evidence_id,user_id,tenant_id,account_id,amount_minor,currency,direction,treatment,occurred_on,occurred_time,provider,reference,description,category,evidence_excerpt,findings,field_confidence)
 VALUES(jid,eid,uid,tid,_account_id,nullif(rec->>'amount_minor','')::bigint,coalesce(rec->>'currency','RWF'),rec->>'direction',coalesce(rec->>'treatment','unknown'),nullif(rec->>'occurred_on','')::date,nullif(rec->>'occurred_time','')::time,left(coalesce(rec->>'provider','Unknown'),50),nullif(left(rec->>'reference',100),''),left(coalesce(rec->>'description',''),1000),left(coalesce(rec->>'category',''),100),left(coalesce(rec->>'evidence_excerpt',''),4000),coalesce(rec->'findings','[]'),coalesce(rec->'field_confidence','{}'));
 END LOOP;
 INSERT INTO capture_audit_events(user_id,tenant_id,job_id,event,details) VALUES(uid,tid,jid,'import_registered',jsonb_build_object('records',jsonb_array_length(_records),'parser',_parser_version));
 RETURN jid;
END $$;
CREATE FUNCTION public.capture_resolve(_id uuid,_version integer,_action text,_fields jsonb DEFAULT '{}',_match_id uuid DEFAULT NULL,_separate boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid:=public.get_my_tenant(); c public.capture_candidates%ROWTYPE; aid uuid; amt bigint; d text; dat date; tim time; cat text; descr text; pay text; txid uuid; conflict_id uuid;
BEGIN
 SELECT * INTO c FROM capture_candidates WHERE id=_id AND user_id=uid AND tenant_id=tid FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Record not available'; END IF;
 IF c.status IN ('posted','duplicate_linked') THEN SELECT transaction_id INTO txid FROM capture_posting_links WHERE candidate_id=c.id; RETURN txid; END IF;
 IF c.version<>_version THEN RAISE EXCEPTION 'Record changed. Refresh before confirming'; END IF;
 IF _action IN ('reject','defer') THEN
 UPDATE capture_candidates SET status=CASE WHEN _action='reject' THEN 'rejected' ELSE 'deferred' END,version=version+1 WHERE id=c.id;
 INSERT INTO capture_audit_events(user_id,tenant_id,candidate_id,job_id,event,details) VALUES(uid,tid,c.id,c.job_id,_action,jsonb_build_object('reason',left(coalesce(_fields->>'reason',''),500))); RETURN NULL;
 END IF;
 IF _action NOT IN ('post','match') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 aid:=coalesce(nullif(_fields->>'account_id','')::uuid,c.account_id);
 PERFORM 1 FROM accounts WHERE id=aid AND user_id=uid AND NOT is_archived AND currency='RWF' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select your active RWF account'; END IF;
 amt:=coalesce(nullif(_fields->>'amount_minor','')::bigint,c.amount_minor); d:=coalesce(_fields->>'direction',c.direction); dat:=coalesce(nullif(_fields->>'occurred_on','')::date,c.occurred_on); tim:=coalesce(nullif(_fields->>'occurred_time','')::time,c.occurred_time,'12:00'::time); cat:=trim(coalesce(_fields->>'category',c.category)); descr:=left(coalesce(_fields->>'description',c.description),1000); pay:=_fields->>'payment_method';
 IF amt IS NULL OR amt<=0 OR amt>1000000000000 OR d NOT IN ('INCOME','EXPENSE') OR d IS NULL OR dat IS NULL OR dat>current_date OR dat<'2000-01-01' OR c.currency<>'RWF' THEN RAISE EXCEPTION 'Check amount, RWF currency, direction and transaction date'; END IF;
 IF _action='match' THEN
 SELECT id INTO txid FROM transactions WHERE id=_match_id AND user_id=uid AND account_id=aid AND currency='RWF' AND type::text=d AND total_amount=amt AND transaction_date BETWEEN dat-1 AND dat+1;
 IF txid IS NULL THEN RAISE EXCEPTION 'Match must be your transaction with the same account, amount, direction, currency and compatible date'; END IF;
 ELSE
 IF c.treatment NOT IN ('payment','fee','unknown') THEN RAISE EXCEPTION 'Transfers, withdrawals, loans, unpaid invoices, failed payments and reversals cannot be posted here'; END IF;
 IF cat='' OR pay NOT IN ('MTN MOMO','AIRTEL MONEY','VISA','MASTERCARD','PAYPAL','BANK CHEQUE') OR pay IS NULL OR coalesce((_fields->>'payment_confirmed')::boolean,false)=false THEN RAISE EXCEPTION 'Confirm completed payment, category and payment method'; END IF;
 IF c.reference IS NOT NULL THEN SELECT transaction_id INTO conflict_id FROM capture_posting_links WHERE user_id=uid AND account_id=aid AND provider=c.provider AND reference=c.reference AND treatment=c.treatment; IF FOUND THEN RAISE EXCEPTION 'This provider reference is already linked. Match the existing record'; END IF; END IF;
 IF NOT _separate AND EXISTS(SELECT 1 FROM transactions WHERE user_id=uid AND account_id=aid AND currency='RWF' AND type::text=d AND total_amount=amt AND transaction_date=dat) THEN RAISE EXCEPTION 'Possible duplicate. Match the existing record or explicitly confirm a separate payment'; END IF;
 INSERT INTO transactions(user_id,tenant_id,account_id,transaction_date,transaction_time,category,description,quantity,unit_price,total_amount,final_amount,currency,type,payment_method,status,notes)
 VALUES(uid,tid,aid,dat,tim,cat,descr,1,amt,amt,amt,'RWF',d::public.transaction_type,pay,'COMPLETED','Confirmed through Money Capture') RETURNING id INTO txid;
 END IF;
 INSERT INTO capture_posting_links(user_id,tenant_id,candidate_id,transaction_id,account_id,provider,reference,treatment,amount_minor,direction,balance_applied) VALUES(uid,tid,c.id,txid,aid,c.provider,c.reference,c.treatment,amt,d,_action='post');
 IF _action='post' THEN UPDATE accounts SET current_balance=current_balance+CASE WHEN d='INCOME' THEN amt ELSE -amt END WHERE id=aid AND user_id=uid; END IF;
 UPDATE capture_candidates SET account_id=aid,amount_minor=amt,direction=d,occurred_on=dat,occurred_time=tim,category=cat,description=descr,status=CASE WHEN _action='post' THEN 'posted' ELSE 'duplicate_linked' END,version=version+1,posted_at=now() WHERE id=c.id;
 INSERT INTO capture_audit_events(user_id,tenant_id,candidate_id,job_id,event,details) VALUES(uid,tid,c.id,c.job_id,CASE WHEN _action='post' THEN 'confirmed_and_posted' ELSE 'matched_existing' END,jsonb_build_object('transaction_id',txid,'original_amount',c.amount_minor,'confirmed_amount',amt,'separate',_separate));
 RETURN txid;
END $$;
CREATE FUNCTION public.capture_maintain_balance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE delta numeric; a uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM capture_posting_links WHERE transaction_id=OLD.id AND balance_applied) THEN
 IF TG_OP='UPDATE' AND (NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.currency IS DISTINCT FROM OLD.currency) THEN RAISE EXCEPTION 'Captured account ownership and currency cannot be changed'; END IF;
 a:=OLD.account_id; delta:=CASE WHEN OLD.type='INCOME' THEN -OLD.total_amount ELSE OLD.total_amount END;
 IF TG_OP='UPDATE' THEN delta:=delta+CASE WHEN NEW.type='INCOME' THEN NEW.total_amount ELSE -NEW.total_amount END; END IF;
 UPDATE accounts SET current_balance=current_balance+delta WHERE id=a AND user_id=OLD.user_id;
 INSERT INTO capture_audit_events(user_id,tenant_id,event,details) VALUES(OLD.user_id,OLD.tenant_id,CASE WHEN TG_OP='DELETE' THEN 'ledger_deleted_balance_reversed' ELSE 'ledger_updated_balance_adjusted' END,jsonb_build_object('transaction_id',OLD.id,'balance_delta',delta));
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER capture_balance_changes BEFORE UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.capture_maintain_balance();
REVOKE ALL ON FUNCTION public.capture_set_consent(text,boolean),public.capture_register_import(text,text,text,uuid,jsonb,text),public.capture_resolve(uuid,integer,text,jsonb,uuid,boolean),public.capture_maintain_balance() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_set_consent(text,boolean),public.capture_register_import(text,text,text,uuid,jsonb,text),public.capture_resolve(uuid,integer,text,jsonb,uuid,boolean) TO authenticated;