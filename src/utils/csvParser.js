import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Parses a file (CSV or Excel) and returns headers and rows.
 * @param {File} file - The file object to parse.
 * @returns {Promise<{headers: string[], rows: Object[]}>}
 */
export function parseFile(file) {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.csv')) {
    return parseCsv(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcel(file);
  } else {
    return Promise.reject(new Error('Unsupported file format. Please upload a CSV or Excel (.xlsx, .xls) file.'));
  }
}

/**
 * Parses an Excel (.xlsx or .xls) file.
 * @param {File} file - The file to parse.
 * @returns {Promise<{headers: string[], rows: Object[]}>}
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to a 2D array (rows of cells)
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rawData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // Extract headers from first row
        const headers = rawData[0].map(h => 
          h !== undefined && h !== null ? String(h).trim() : ''
        ).filter(Boolean);

        // Map the remaining rows to objects keyed by headers
        const rows = rawData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined && row[index] !== null ? row[index] : '';
          });
          return obj;
        });

        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses a CSV file or string using PapaParse.
 * @param {File|string} target - The file object or string content to parse.
 * @returns {Promise<{headers: string[], rows: Object[]}>}
 */
export function parseCsv(target) {
  return new Promise((resolve, reject) => {
    const config = {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = results.meta.fields || [];
        resolve({
          headers,
          rows: results.data
        });
      },
      error: (error) => {
        reject(error);
      }
    };

    if (target instanceof File) {
      Papa.parse(target, config);
    } else {
      Papa.parse(target, config);
    }
  });
}

/**
 * Automatically detects column mappings from headers using common patterns.
 * @param {string[]} headers - The list of column headers from the CSV.
 * @returns {{dealIdCol: string, dealNameCol: string, ownerCol: string, ownerMetaCol: string, pubIdCol: string, revenueCol: string}}
 */
export function autoDetectMappings(headers) {
  const mappings = {
    dealIdCol: '',
    dealNameCol: '',
    ownerCol: '',
    ownerMetaCol: '',
    pubIdCol: '',
    revenueCol: ''
  };

  // Specific patterns for the user's fixed column naming convention
  const idPatterns = [
    /deal\s*meta\s*id/i,              // "Deal Meta ID" — specific, check first
    /deal\s*id/i,                     // "Deal ID"
    /^id$/i,
    /ap\s*id/i,
    /package\s*id/i
  ];
  const namePatterns = [/deal\s*name/i, /^name$/i, /ap\s*name/i, /package\s*name/i];
  // Primary owner: must NOT be "Deal Owner Id" (that's a numeric ID column)
  // and must NOT be a metadata-owner column (e.g. "Deal Metadata Deal Owner").
  // Tolerant regex catches common misspellings like "Deal Onwer".
  const ownerPatterns = [
    /^(?!.*metadata).*deal\s*o[wn][nw]er(?!\s*id)(?:\s*name)?$/i, // "Deal Owner" / "Deal Onwer" / "Deal Owner Name"
    /^owner$/i,                                                    // exact "Owner"
    /^onwer$/i,                                                    // exact "Onwer" (common typo)
    /account\s*manager/i,                                          // "Account Manager"
    /^am$/i,
    /contact/i,
    /email/i
  ];
  // Metadata owner
  const ownerMetaPatterns = [
    /deal\s*metadata\s*deal\s*owner/i, // exact: "Deal Metadata Deal Owner"
    /deal\s*metadata.*owner/i,
    /metadata.*owner/i
  ];
  const pubIdPatterns = [/pub\s*id/i, /publisher\s*id/i, /publisher/i, /^pub$/i];
  // Spend / Revenue: "Deal Spend", "Deal Spend 30 days", "Deal Spend 7 days"
  const revenuePatterns = [
    /deal\s*spend/i,                  // "Deal Spend..." catches 30d / 7d variants
    /revenue/i,
    /^rev$/i,
    /amount/i,
    /value/i,
    /budget/i,
    /income/i,
    /earnings/i
  ];

  // Helper to find matching header
  const findMatch = (patterns) => {
    for (const pattern of patterns) {
      const match = headers.find(h => pattern.test(h.trim()));
      if (match) return match;
    }
    return '';
  };

  mappings.dealIdCol = findMatch(idPatterns) || headers[0] || '';
  mappings.dealNameCol = findMatch(namePatterns) || headers[1] || '';
  mappings.ownerCol = findMatch(ownerPatterns) || '';
  mappings.ownerMetaCol = findMatch(ownerMetaPatterns) || '';
  mappings.pubIdCol = findMatch(pubIdPatterns) || '';
  mappings.revenueCol = findMatch(revenuePatterns) || '';

  return mappings;
}

/**
 * Maps raw rows into standardized deal objects using the mappings.
 * @param {Object[]} rows - The raw parsed rows.
 * @param {{dealIdCol: string, dealNameCol: string, ownerCol: string, ownerMetaCol: string, pubIdCol: string, revenueCol: string}} mappings
 * @returns {Array<{id: string, name: string, owner: string, ownerMeta: string, pubId: string, revenue: number}>}
 */
export function mapParsedData(rows, mappings) {
  return rows.map((row, index) => {
    const rawId = row[mappings.dealIdCol];
    const id = rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
    
    const rawName = row[mappings.dealNameCol];
    const name = rawName !== undefined && rawName !== null ? String(rawName).trim() : `Deal ${id || index + 1}`;
    
    // Keep primary owner and metadata owner strictly separate
    const rawOwner = row[mappings.ownerCol];
    const rawOwnerMeta = mappings.ownerMetaCol ? row[mappings.ownerMetaCol] : '';
    const owner = rawOwner !== undefined && rawOwner !== null ? String(rawOwner).trim() : '';
    const ownerMeta = rawOwnerMeta !== undefined && rawOwnerMeta !== null ? String(rawOwnerMeta).trim() : '';
    
    const rawPubId = mappings.pubIdCol ? row[mappings.pubIdCol] : '';
    const pubId = rawPubId !== undefined && rawPubId !== null ? String(rawPubId).trim() : '';

    const rawRevenue = mappings.revenueCol ? row[mappings.revenueCol] : '';
    // Clean currency string (e.g. "$1,200.50" -> 1200.5)
    let revenue = 0;
    if (rawRevenue !== undefined && rawRevenue !== null) {
      const cleaned = String(rawRevenue).replace(/[^0-9.]/g, '');
      revenue = parseFloat(cleaned) || 0;
    }

    return { id, name, owner, ownerMeta, pubId, revenue };
  }).filter(deal => deal.id); // Filter out rows with no Deal ID
}

/**
 * Resolves the effective owner for display/grouping, preferring primary owner.
 * Returns metadata owner as fallback, with a flag indicating the source.
 * @param {{owner: string, ownerMeta: string}} deal
 * @returns {{value: string, isMetadataFallback: boolean, isMissing: boolean}}
 */
export function resolveOwner(deal) {
  if (deal.owner) {
    return { value: deal.owner, isMetadataFallback: false, isMissing: false };
  }
  if (deal.ownerMeta) {
    return { value: deal.ownerMeta, isMetadataFallback: true, isMissing: false };
  }
  return { value: 'Unknown Owner', isMetadataFallback: false, isMissing: true };
}
