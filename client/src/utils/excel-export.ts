// Excel export utility for financial data
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  // Create CSV content for Excel compatibility
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  let csvContent = headers.join(',') + '\n';
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Handle different data types
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value;
    });
    csvContent += values.join(',') + '\n';
  });

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export account balance projections for retirement planning
export function exportAccountBalances(
  data: any[],
  planType: 'baseline' | 'optimized',
  filename?: string
) {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Transform data for Excel export
  const exportData = data.map(year => ({
    'Year': year.year,
    'Age': year.age,
    'Spouse Age': year.spouseAge || 'N/A',
    'Taxable Balance': Math.round(year.taxableBalance),
    'Tax-Deferred Balance': Math.round(year.taxDeferredBalance),
    'Tax-Free Balance': Math.round(year.taxFreeBalance),
    'HSA Balance': Math.round(year.hsaBalance || 0),
    'Total Balance (Median)': Math.round(year.portfolioBalance?.p50 || year.totalBalance || 0),
    'P10 Balance': Math.round(year.portfolioBalance?.p10 || 0),
    'P25 Balance': Math.round(year.portfolioBalance?.p25 || 0),
    'P75 Balance': Math.round(year.portfolioBalance?.p75 || 0),
    'P90 Balance': Math.round(year.portfolioBalance?.p90 || 0),
    'Success Probability (%)': year.successProbability?.toFixed(1) || '0.0',
    'Monthly Expenses': Math.round(year.monthlyExpenses),
    'Total Income': Math.round(year.totalIncome),
    'Total Withdrawals': Math.round(year.totalWithdrawals),
    'Withdrawal Tax': Math.round(year.withdrawalTax),
    'Net Income': Math.round(year.netIncome)
  }));

  const defaultFilename = `retirement_projections_${planType}_${new Date().toISOString().split('T')[0]}`;
  exportToExcel(exportData, filename || defaultFilename, `${planType} Plan`);
}

// Export net worth projections
export function exportNetWorthProjections(
  data: any[],
  planType: 'current' | 'optimized',
  filename?: string
) {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Transform data for Excel export
  const exportData = data.map(year => ({
    'Year': year.year,
    'Age': year.age,
    'Spouse Age': year.spouseAge || 'N/A',
    'Savings & Investments': Math.round(year.savings),
    'Real Estate': Math.round(year.realEstate),
    'Other Assets': Math.round(year.otherAssets),
    'Total Debt': Math.round(year.debt),
    'Total Net Worth': Math.round(year.totalNetWorth)
  }));

  const defaultFilename = `net_worth_projections_${planType}_${new Date().toISOString().split('T')[0]}`;
  exportToExcel(exportData, filename || defaultFilename, `${planType} Net Worth`);
}