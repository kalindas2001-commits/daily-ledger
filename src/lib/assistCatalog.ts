// CungaCash Assist – 150 Premium Services Catalog
// Category structure: 15 categories × 10 services = 150 total
export interface AssistService {
  id: string;
  name: string;
  description?: string;
  output?: string; // e.g. PDF Report, Consultation, Dashboard
  sla?: string;    // delivery time
  aiAssist?: 'low' | 'medium' | 'high';
}

export interface AssistCategory {
  id: string;
  name: string;
  icon: string; // lucide icon name
  color: string; // tailwind class token
  services: AssistService[];
}

const mk = (prefix: string, list: [string, string?][]): AssistService[] =>
  list.map(([name, desc], i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    name,
    description: desc,
    output: 'PDF Report + Consultation',
    sla: '3–7 business days',
    aiAssist: 'medium',
  }));

export const ASSIST_CATALOG: AssistCategory[] = [
  {
    id: 'tax', name: 'Tax & Compliance', icon: 'Landmark', color: 'text-emerald-600',
    services: mk('tax', [
      ['Corporate tax advisory'], ['VAT filing assistance'], ['Payroll tax compliance support'],
      ['Tax audit preparation'], ['Tax planning & optimization'], ['Withholding tax advisory'],
      ['Tax dispute resolution support'], ['Tax registration services'],
      ['Cross-border tax advisory'], ['Tax compliance health check'],
    ]),
  },
  {
    id: 'accounting', name: 'Accounting Advisory', icon: 'Calculator', color: 'text-blue-600',
    services: mk('accounting', [
      ['Financial statement review'], ['Bookkeeping cleanup service'], ['IFRS compliance advisory'],
      ['Chart of accounts design'], ['Accounting system setup'], ['Monthly close review'],
      ['Financial reporting optimization'], ['Expense classification audit'],
      ['Revenue recognition advisory'], ['Accounting policy drafting'],
    ]),
  },
  {
    id: 'audit', name: 'Audit & Assurance', icon: 'ShieldCheck', color: 'text-indigo-600',
    services: mk('audit', [
      ['Internal audit preparation'], ['External audit readiness'], ['Risk-based audit review'],
      ['Compliance audit support'], ['Fraud detection review'], ['Operational audit analysis'],
      ['Financial controls assessment'], ['Audit documentation preparation'],
      ['Audit findings remediation'], ['Audit trail reconstruction'],
    ]),
  },
  {
    id: 'assets', name: 'Asset Management', icon: 'Building2', color: 'text-amber-600',
    services: mk('assets', [
      ['Fixed asset register setup'], ['Asset valuation service'], ['Depreciation planning'],
      ['Asset lifecycle tracking'], ['Asset insurance advisory'], ['Asset tagging & coding system'],
      ['Asset verification audit'], ['Asset disposal advisory'],
      ['Asset ROI analysis'], ['Asset maintenance planning'],
    ]),
  },
  {
    id: 'fpa', name: 'Financial Planning & Analysis', icon: 'LineChart', color: 'text-cyan-600',
    services: mk('fpa', [
      ['Cash flow forecasting'], ['Budget preparation service'], ['Financial modeling'],
      ['Profitability analysis'], ['Break-even analysis'], ['Scenario planning'],
      ['Investment feasibility study'], ['Financial KPI design'],
      ['Cost optimization analysis'], ['Revenue forecasting'],
    ]),
  },
  {
    id: 'strategy', name: 'Business Strategy', icon: 'Target', color: 'text-fuchsia-600',
    services: mk('strategy', [
      ['Business feasibility study'], ['Market entry strategy'], ['Expansion advisory'],
      ['Business restructuring'], ['Competitive analysis'], ['Pricing strategy design'],
      ['Business valuation'], ['Growth strategy planning'],
      ['Risk strategy planning'], ['Strategic roadmap design'],
    ]),
  },
  {
    id: 'hr', name: 'HR & Payroll Advisory', icon: 'Users', color: 'text-rose-600',
    services: mk('hr', [
      ['Payroll structuring'], ['Salary benchmarking'], ['HR compliance advisory'],
      ['Employee cost optimization'], ['Recruitment strategy support'], ['Job description design'],
      ['HR policy development'], ['Employee handbook creation'],
      ['Performance appraisal system design'], ['Workforce planning'],
    ]),
  },
  {
    id: 'procurement', name: 'Procurement & Supply Chain', icon: 'Truck', color: 'text-orange-600',
    services: mk('procurement', [
      ['Supplier evaluation'], ['Procurement policy design'], ['Contract negotiation advisory'],
      ['Supplier risk assessment'], ['Purchase process optimization'], ['Cost reduction strategy'],
      ['Inventory procurement planning'], ['Vendor scorecard development'],
      ['Supply chain audit'], ['Logistics optimization'],
    ]),
  },
  {
    id: 'legal', name: 'Legal & Regulatory', icon: 'Scale', color: 'text-slate-600',
    services: mk('legal', [
      ['Business registration advisory'], ['Contract review service'], ['Compliance advisory'],
      ['Licensing support'], ['Corporate governance advisory'], ['Legal risk assessment'],
      ['Policy drafting'], ['Regulatory filing support'],
      ['Partnership agreement review'], ['Intellectual property advisory'],
    ]),
  },
  {
    id: 'erp', name: 'ERP & Digital Transformation', icon: 'Cpu', color: 'text-violet-600',
    services: mk('erp', [
      ['ERP implementation consulting'], ['System migration support'], ['Data migration service'],
      ['Workflow automation design'], ['Software integration advisory'], ['Cloud deployment support'],
      ['Cybersecurity advisory'], ['Digital transformation roadmap'],
      ['Process digitization audit'], ['System optimization review'],
    ]),
  },
  {
    id: 'banking', name: 'Banking & Financial Services', icon: 'Banknote', color: 'text-green-600',
    services: mk('banking', [
      ['Bank reconciliation service'], ['Credit risk analysis'], ['Loan advisory'],
      ['Interest optimization strategy'], ['Banking relationship management'], ['Cash management advisory'],
      ['Payment system setup'], ['Mobile money integration support'],
      ['Treasury management advisory'], ['Financial liquidity planning'],
    ]),
  },
  {
    id: 'sales', name: 'Sales & CRM', icon: 'TrendingUp', color: 'text-pink-600',
    services: mk('sales', [
      ['Sales pipeline optimization'], ['CRM setup service'], ['Customer segmentation analysis'],
      ['Sales forecasting support'], ['Lead generation strategy'], ['Customer retention strategy'],
      ['Pricing funnel optimization'], ['Sales performance analysis'],
      ['Conversion rate optimization'], ['Sales training advisory'],
    ]),
  },
  {
    id: 'inventory', name: 'Inventory & Operations', icon: 'Package', color: 'text-teal-600',
    services: mk('inventory', [
      ['Inventory system setup'], ['Stock optimization advisory'], ['Warehouse layout design'],
      ['Stock valuation service'], ['Demand forecasting'], ['Inventory audit'],
      ['Supply-demand balancing'], ['Stock loss analysis'],
      ['Reorder system design'], ['Operations efficiency review'],
    ]),
  },
  {
    id: 'training', name: 'Training & Capacity Building', icon: 'GraduationCap', color: 'text-yellow-600',
    services: mk('training', [
      ['Accounting training'], ['ERP system training'], ['Tax compliance training'],
      ['Financial literacy training'], ['HR management training'], ['Business management training'],
      ['Sales training program'], ['Inventory management training'],
      ['Audit readiness training'], ['Digital finance training'],
    ]),
  },
  {
    id: 'executive', name: 'Premium Executive & AI', icon: 'Sparkles', color: 'text-primary',
    services: ([
      ['Executive financial dashboard setup'], ['AI financial insights report'],
      ['Risk prediction analysis'], ['Business health scoring'],
      ['Investment readiness evaluation'], ['Fraud detection analysis'],
      ['Profit optimization AI report'], ['Growth forecasting AI service'],
      ['Board-level reporting service'], ['Strategic executive advisory session'],
    ] as [string, string?][]).map(([name], i) => ({
      id: `executive-${String(i + 1).padStart(2, '0')}`,
      name, output: 'AI Report + Dashboard + Consultation',
      sla: '2–5 business days', aiAssist: 'high' as const,
    })),
  },
];

export const findService = (categoryId: string, serviceId: string) => {
  const cat = ASSIST_CATALOG.find(c => c.id === categoryId);
  const svc = cat?.services.find(s => s.id === serviceId);
  return { category: cat, service: svc };
};

// ============ Service Input Schema =============
export type AssistInputField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'email' | 'tel';
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

const BASE_INPUTS: AssistInputField[] = [
  { key: 'contact_name',   label: 'Contact name',        type: 'text',  required: true },
  { key: 'contact_phone',  label: 'Phone / WhatsApp',    type: 'tel',   required: true },
  { key: 'contact_email',  label: 'Email',               type: 'email', required: true },
  { key: 'business_size',  label: 'Business size',       type: 'select', options: ['micro','small','medium','large'] },
];

const CATEGORY_EXTRAS: Record<string, AssistInputField[]> = {
  tax: [
    { key: 'tin_number',     label: 'TIN / tax number',     type: 'text' },
    { key: 'fiscal_year',    label: 'Fiscal year',          type: 'text', placeholder: 'e.g. 2024' },
    { key: 'annual_revenue', label: 'Annual revenue (RWF)', type: 'number' },
  ],
  accounting: [
    { key: 'accounting_system', label: 'Accounting system', type: 'text', placeholder: 'e.g. QuickBooks' },
    { key: 'reporting_period',  label: 'Reporting period',  type: 'text', placeholder: 'e.g. Q3 2024' },
  ],
  audit: [
    { key: 'audit_type',   label: 'Audit type',   type: 'select', options: ['internal','external','compliance','forensic'] },
    { key: 'period_start', label: 'Period start', type: 'date' },
    { key: 'period_end',   label: 'Period end',   type: 'date' },
  ],
  assets: [
    { key: 'asset_class', label: 'Asset class',           type: 'text' },
    { key: 'asset_value', label: 'Estimated value (RWF)', type: 'number' },
  ],
  fpa: [
    { key: 'horizon_months', label: 'Planning horizon (months)', type: 'number' },
    { key: 'target_kpi',     label: 'Target KPI',                type: 'text' },
  ],
  strategy: [
    { key: 'industry',     label: 'Industry / sector', type: 'text' },
    { key: 'market_scope', label: 'Market scope',      type: 'select', options: ['local','national','regional','international'] },
  ],
  hr: [
    { key: 'headcount',  label: 'Employee headcount', type: 'number' },
    { key: 'department', label: 'Department focus',   type: 'text' },
  ],
  procurement: [
    { key: 'category_scope', label: 'Procurement category', type: 'text' },
    { key: 'annual_spend',   label: 'Annual spend (RWF)',   type: 'number' },
  ],
  legal: [
    { key: 'matter_type',    label: 'Matter type',        type: 'text' },
    { key: 'urgency_reason', label: 'Reason for urgency', type: 'textarea' },
  ],
  erp: [
    { key: 'current_system', label: 'Current system',  type: 'text' },
    { key: 'user_count',     label: 'Number of users', type: 'number' },
  ],
  banking: [
    { key: 'bank_name',     label: 'Primary bank',  type: 'text' },
    { key: 'facility_type', label: 'Facility / need', type: 'text' },
  ],
  sales: [
    { key: 'crm_in_use',    label: 'CRM in use',   type: 'text' },
    { key: 'monthly_leads', label: 'Monthly leads', type: 'number' },
  ],
  inventory: [
    { key: 'sku_count',       label: 'SKU count',   type: 'number' },
    { key: 'warehouse_count', label: 'Warehouses',  type: 'number' },
  ],
  training: [
    { key: 'audience_size', label: 'Audience size', type: 'number' },
    { key: 'topic_focus',   label: 'Topic focus',   type: 'text' },
  ],
  executive: [
    { key: 'strategic_goal', label: 'Strategic goal', type: 'textarea', required: true },
    { key: 'board_deadline', label: 'Board deadline', type: 'date' },
  ],
};

export function getServiceInputs(categoryId: string, _serviceId: string): AssistInputField[] {
  return [
    ...BASE_INPUTS,
    ...(CATEGORY_EXTRAS[categoryId] ?? []),
    { key: 'preferred_contact', label: 'Preferred contact', type: 'select', options: ['email','phone','whatsapp'] },
  ];
}

