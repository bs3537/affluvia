/**
 * Utility functions for formatting text display
 */

/**
 * Capitalizes the first letter of each word and handles common abbreviations
 */
export function formatDisplayText(text: string | undefined | null): string {
  if (!text) return '';
  
  // Common financial abbreviations that should be uppercase
  const abbreviations = ['ira', 'cd', '401k', '403b', '457', 'hsa', 'fsa', 'etf', 'roth', 'sep'];
  
  // Split by spaces and process each word
  return text
    .toLowerCase()
    .split(/[\s_-]+/) // Split by spaces, underscores, or hyphens
    .map(word => {
      // Check if it's a known abbreviation
      if (abbreviations.includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      
      // Check for 401(k), 403(b), etc.
      if (/^\d{3}[a-z]?$/.test(word)) {
        return word.toUpperCase();
      }
      
      // Capitalize first letter of regular words
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Formats account type for professional display
 */
export function formatAccountType(type: string | undefined | null): string {
  if (!type) return '';
  
  const typeMap: Record<string, string> = {
    'depository': 'Depository',
    'investment': 'Investment',
    'loan': 'Loan',
    'credit': 'Credit',
    'brokerage': 'Brokerage',
    'mortgage': 'Mortgage',
    'other': 'Other'
  };
  
  return typeMap[type.toLowerCase()] || formatDisplayText(type);
}

/**
 * Formats account subtype for professional display
 */
export function formatAccountSubtype(subtype: string | undefined | null): string {
  if (!subtype) return '';
  
  const subtypeMap: Record<string, string> = {
    'checking': 'Checking',
    'savings': 'Savings',
    'cd': 'CD',
    'money_market': 'Money Market',
    'paypal': 'PayPal',
    'prepaid': 'Prepaid',
    'cash_management': 'Cash Management',
    'ebt': 'EBT',
    'credit_card': 'Credit Card',
    'auto': 'Auto Loan',
    'business': 'Business',
    'commercial': 'Commercial',
    'construction': 'Construction',
    'consumer': 'Consumer',
    'home_equity': 'Home Equity',
    'line_of_credit': 'Line of Credit',
    'loan': 'Loan',
    'mortgage': 'Mortgage',
    'overdraft': 'Overdraft',
    'student': 'Student Loan',
    '401a': '401(a)',
    '401k': '401(k)',
    '403b': '403(b)',
    '457': '457',
    '457b': '457(b)',
    '529': '529',
    'brokerage': 'Brokerage',
    'cash_isa': 'Cash ISA',
    'education_savings_account': 'Education Savings Account',
    'fixed_annuity': 'Fixed Annuity',
    'gic': 'GIC',
    'health_reimbursement_arrangement': 'Health Reimbursement',
    'hsa': 'HSA',
    'isa': 'ISA',
    'ira': 'IRA',
    'lif': 'LIF',
    'lira': 'LIRA',
    'lrif': 'LRIF',
    'lrsp': 'LRSP',
    'mutual_fund': 'Mutual Fund',
    'non_taxable_brokerage_account': 'Non-Taxable Brokerage',
    'pension': 'Pension',
    'plan': 'Plan',
    'prif': 'PRIF',
    'profit_sharing_plan': 'Profit Sharing Plan',
    'rdsp': 'RDSP',
    'resp': 'RESP',
    'retirement': 'Retirement',
    'rlif': 'RLIF',
    'roth': 'Roth IRA',
    'roth_401k': 'Roth 401(k)',
    'rrif': 'RRIF',
    'rrsp': 'RRSP',
    'sarsep': 'SARSEP',
    'sep_ira': 'SEP IRA',
    'simple_ira': 'SIMPLE IRA',
    'sipp': 'SIPP',
    'stock_plan': 'Stock Plan',
    'tfsa': 'TFSA',
    'trust': 'Trust',
    'ugma': 'UGMA',
    'utma': 'UTMA',
    'variable_annuity': 'Variable Annuity'
  };
  
  // Replace underscores with spaces for lookup
  const normalizedSubtype = subtype.toLowerCase().replace(/-/g, '_');
  return subtypeMap[normalizedSubtype] || formatDisplayText(subtype);
}

/**
 * Formats institution name for professional display
 */
export function formatInstitutionName(name: string | undefined | null): string {
  if (!name) return '';
  
  // Special cases for common institutions
  const institutionMap: Record<string, string> = {
    'chase': 'Chase',
    'bank of america': 'Bank of America',
    'wells fargo': 'Wells Fargo',
    'citibank': 'Citibank',
    'capital one': 'Capital One',
    'pnc': 'PNC',
    'us bank': 'US Bank',
    'td bank': 'TD Bank',
    'bb&t': 'BB&T',
    'suntrust': 'SunTrust',
    'american express': 'American Express',
    'discover': 'Discover',
    'charles schwab': 'Charles Schwab',
    'fidelity': 'Fidelity',
    'vanguard': 'Vanguard',
    'e*trade': 'E*TRADE',
    'td ameritrade': 'TD Ameritrade',
    'robinhood': 'Robinhood',
    'paypal': 'PayPal',
    'venmo': 'Venmo'
  };
  
  const normalized = name.toLowerCase();
  return institutionMap[normalized] || formatDisplayText(name);
}

/**
 * Formats owner names (first names) for professional display
 */
export function formatOwnerName(name: string | undefined | null): string {
  if (!name) return '';
  
  // Capitalize first letter of each name
  return name
    .split(',')
    .map(n => n.trim())
    .map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
    .join(', ');
}

/**
 * Formats currency amount for display
 */
export function formatCurrency(amount: number | string | undefined | null, currency: string = 'USD'): string {
  if (amount === undefined || amount === null) return '—';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '—';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
}