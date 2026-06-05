import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, FileSpreadsheet, Trash2, ArrowRight } from 'lucide-react';
import { parseFile, autoDetectMappings, mapParsedData } from '../utils/csvParser';

/**
 * CSV Uploader and Column Mapper component (Step 1).
 * @param {Object} props
 * @param {function} props.onUploadComplete - Callback when mapped data is ready.
 * @param {Object} props.savedState - Previously uploaded state for recovery.
 */
export default function WantedListUploader({ onUploadComplete, savedState }) {
  const [file, setFile] = useState(savedState?.file || null);
  const [headers, setHeaders] = useState(savedState?.headers || []);
  const [rawRows, setRawRows] = useState(savedState?.rawRows || []);
  // Initialize mappings: use saved state if present, but re-run auto-detect
  // to fill any gaps (so new regex patterns apply to old uploads)
  const [mappings, setMappings] = useState(() => {
    const base = savedState?.mappings || {
      dealIdCol: '', dealNameCol: '', ownerCol: '', ownerMetaCol: '', pubIdCol: '', revenueCol: ''
    };
    if (savedState?.headers?.length > 0) {
      const fresh = autoDetectMappings(savedState.headers);
      return {
        dealIdCol: base.dealIdCol || fresh.dealIdCol || '',
        dealNameCol: base.dealNameCol || fresh.dealNameCol || '',
        ownerCol: base.ownerCol || fresh.ownerCol || '',
        ownerMetaCol: base.ownerMetaCol || fresh.ownerMetaCol || '',
        pubIdCol: base.pubIdCol || fresh.pubIdCol || '',
        revenueCol: base.revenueCol || fresh.revenueCol || ''
      };
    }
    return base;
  });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);

  const processFile = async (selectedFile) => {
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setError('Only CSV and Excel (.xlsx, .xls) files are supported.');
      return;
    }
    setError('');
    setFile(selectedFile);

    try {
      const { headers: parsedHeaders, rows: parsedRows } = await parseFile(selectedFile);
      if (parsedHeaders.length === 0 || parsedRows.length === 0) {
        setError('The uploaded file appears to be empty.');
        return;
      }
      setHeaders(parsedHeaders);
      setRawRows(parsedRows);
      
      // Auto-detect columns
      const autoMappings = autoDetectMappings(parsedHeaders);
      setMappings(autoMappings);
    } catch (err) {
      setError(`Failed to parse file: ${err.message}`);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const resetUploader = () => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setError('');
    setMappings({
      dealIdCol: '',
      dealNameCol: '',
      ownerCol: '',
      pubIdCol: '',
      revenueCol: ''
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Generate mapped data preview (all rows)
  const mappedData = mapParsedData(rawRows, mappings);
  const previewRows = mappedData;

  const handleConfirm = () => {
    if (!mappings.dealIdCol) {
      setError('Deal ID mapping is required.');
      return;
    }

    if (mappedData.length === 0) {
      setError('No valid deal rows could be parsed with the selected mappings.');
      return;
    }

    // Warn if no primary owner column was mapped
    if (!mappings.ownerCol) {
      const proceed = window.confirm(
        'No Deal Owner column was detected or selected.\n\n' +
        'Primary owner information is needed to send personalized outreach. ' +
        'If you proceed, primary owner will be left empty and outreach may group deals by metadata owner or show "Unknown Owner".\n\n' +
        'Do you still want to proceed?'
      );
      if (!proceed) return;
    }

    // Extract auto-detected publishers from the pub_id column
    let detectedPublishers = [];
    if (mappings.pubIdCol) {
      detectedPublishers = [...new Set(mappedData
        .map(d => d.pubId)
        .filter(Boolean)
      )];
    }

    onUploadComplete({
      wantedDeals: mappedData,
      detectedPublishers,
      rawState: {
        file,
        headers,
        rawRows,
        mappings
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* File Upload Area */}
      {!file ? (
        <div
          className={`uploader-area ${dragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv, .xlsx, .xls"
            style={{ display: 'none' }}
          />
          <UploadCloud size={48} className="uploader-icon" />
          <div>
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
              Drag and drop your Wanted List (CSV/Excel) here
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Or click to browse files
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            File columns should ideally contain: deal ID, deal name, owner, and optionally publisher IDs.
          </span>
        </div>
      ) : (
        <div className="glass-card animated-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileSpreadsheet style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontWeight: 600, fontSize: '1.05rem' }}>{file.name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {(file.size / 1024).toFixed(1)} KB · {rawRows.length} rows loaded
                </span>
              </div>
            </div>
            <button className="btn btn-secondary btn-danger" onClick={resetUploader} style={{ padding: '0.5rem 0.75rem' }}>
              <Trash2 size={16} />
            </button>
          </div>

          {/* Mapping Preview */}
          {mappings.dealIdCol && mappedData.length > 0 && (
            <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '0.625rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Preview
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={14} /> Mapped {mappedData.length} deals successfully
                </span>
              </div>

              <div className="table-container" style={{ maxHeight: '55vh', minHeight: '320px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Deal ID</th>
                      <th>Deal Name</th>
                      <th>Deal Owner</th>
                      <th>Metadata Owner</th>
                      <th>Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx}>
                        <td><code>{row.id}</code></td>
                        <td>{row.name}</td>
                        <td style={{ color: row.owner ? 'inherit' : 'var(--text-muted)', fontStyle: row.owner ? 'inherit' : 'italic' }}>
                          {row.owner || '—'}
                        </td>
                        <td style={{ color: row.ownerMeta ? 'inherit' : 'var(--text-muted)' }}>
                          {row.ownerMeta || '—'}
                        </td>
                        <td>
                          {row.revenue > 0 ? `$${row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--error-subtle)', border: '1px solid #fecaca', borderRadius: '0.625rem', padding: '1rem', color: 'var(--error)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {file && (
        <button
          className="btn btn-primary"
          style={{ alignSelf: 'flex-end' }}
          onClick={handleConfirm}
          disabled={!mappings.dealIdCol || mappedData.length === 0}
        >
          Confirm Wanted List <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
