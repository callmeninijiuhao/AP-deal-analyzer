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
 * @returns {{dealIdCol: string, dealNameCol: string, ownerCol: string, pubIdCol: string, revenueCol: string}}
 */
export function autoDetectMappings(headers) {
  const mappings = {
    dealIdCol: '',
    dealNameCol: '',
    ownerCol: '',
    pubIdCol: '',
    revenueCol: ''
  };

  const idPatterns = [/deal\s*id/i, /^id$/i, /ap\s*id/i, /package\s*id/i, /deal_meta_?id/i];
  const namePatterns = [/deal\s*name/i, /^name$/i, /ap\s*name/i, /package\s*name/i];
  // Prioritize human-readable owner names over numeric owner IDs
  const ownerPatterns = [/metadata.*owner/i, /deal\s*owner\s*name/i, /deal\s*owner/i, /owner\s*name/i, /owner/i, /account\s*manager/i, /^am$/i, /contact/i, /email/i];
  const pubIdPatterns = [/pub\s*id/i, /publisher\s*id/i, /publisher/i, /^pub$/i];
  const revenuePatterns = [/revenue/i, /^rev$/i, /deal\s*revenue/i, /amount/i, /value/i, /spend/i, /budget/i];

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
  mappings.ownerCol = findMatch(ownerPatterns) || headers[2] || '';
  mappings.pubIdCol = findMatch(pubIdPatterns) || '';
  mappings.revenueCol = findMatch(revenuePatterns) || '';

  return mappings;
}

/**
 * Maps raw rows into standardized deal objects using the mappings.
 * @param {Object[]} rows - The raw parsed rows.
 * @param {{dealIdCol: string, dealNameCol: string, ownerCol: string, pubIdCol: string, revenueCol: string}} mappings
 * @returns {Array<{id: string, name: string, owner: string, pubId: string, revenue: number}>}
 */
export function mapParsedData(rows, mappings) {
  return rows.map((row, index) => {
    const rawId = row[mappings.dealIdCol];
    const id = rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
    
    const rawName = row[mappings.dealNameCol];
    const name = rawName !== undefined && rawName !== null ? String(rawName).trim() : `Deal ${id || index + 1}`;
    
    const rawOwner = row[mappings.ownerCol];
    const owner = rawOwner !== undefined && rawOwner !== null ? String(rawOwner).trim() : 'Unknown Owner';
    
    const rawPubId = mappings.pubIdCol ? row[mappings.pubIdCol] : '';
    const pubId = rawPubId !== undefined && rawPubId !== null ? String(rawPubId).trim() : '';

    const rawRevenue = mappings.revenueCol ? row[mappings.revenueCol] : '';
    // Clean currency string (e.g. "$1,200.50" -> 1200.5)
    let revenue = 0;
    if (rawRevenue !== undefined && rawRevenue !== null) {
      const cleaned = String(rawRevenue).replace(/[^0-9.]/g, '');
      revenue = parseFloat(cleaned) || 0;
    }

    return { id, name, owner, pubId, revenue };
  }).filter(deal => deal.id); // Filter out rows with no Deal ID
}
