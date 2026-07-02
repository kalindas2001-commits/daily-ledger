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
