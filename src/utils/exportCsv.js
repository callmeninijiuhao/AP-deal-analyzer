/**
 * Escapes a field for safe CSV output.
 * If the field contains commas, double quotes, or newlines, it wraps the field
 * in double quotes and escapes existing double quotes as "".
 * @param {any} field - The value to escape.
 * @returns {string} The escaped CSV string field.
 */
function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  const str = String(field);
  // Check if character escaping is required
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates and downloads a CSV file containing the gap analysis details.
 * @param {Array<{
 *   pubId: string,
 *   missingDeals: Array<{id: string, name: string, owner: string}>,
 *   failed: boolean
 * }>} gapData - The computed gap data.
 */
export function exportGapsToCsv(gapData) {
  // Define headers
  const headers = ['Publisher ID', 'Deal ID', 'Deal Name', 'Deal Owner', 'Deal Revenue'];
  
  // Construct rows
  const rows = [];
  
  gapData.forEach(pubRecord => {
    if (pubRecord.failed) {
      rows.push([
        pubRecord.pubId,
        'ERROR',
        pubRecord.errorMsg ? String(pubRecord.errorMsg).replace(/^✗ Failed:\s*/, '') : 'Failed to fetch live deals',
        '—',
        '—'
      ]);
      return;
    }
    
    if (pubRecord.missingDeals.length === 0) {
      // Publisher is 100% mapped, can skip or show as all mapped
      // Usually we just want to export the gaps, but let's only output actual gaps.
      return;
    }
    
    pubRecord.missingDeals.forEach(deal => {
      rows.push([
        pubRecord.pubId,
        deal.id,
        deal.name,
        deal.owner,
        deal.revenue !== undefined ? deal.revenue : 0
      ]);
    });
  });

  // Convert array to CSV string
  const csvContent = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\r\n');

  // Trigger file download in browser
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  // Format current date for file name
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `ap_gap_report_${dateStr}.csv`);
  
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
