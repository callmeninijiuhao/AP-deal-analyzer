import React, { useState } from 'react';
import { Download, Mail, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Search } from 'lucide-react';
import { exportGapsToCsv } from '../utils/exportCsv';

/**
 * Renders the Gap Analysis report (Step 3).
 * @param {Object} props
 * @param {Object} props.stats - Summary statistics.
 * @param {Array<Object>} props.gapData - Array of per-publisher gap results.
 * @param {function} props.onProceed - Next step handler.
 * @param {function} props.onPrev - Previous step handler.
 */
export default function GapAnalysis({
  stats,
  gapData,
  onProceed,
  onPrev
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGapsOnly, setFilterGapsOnly] = useState(false);

  // Filter gap records based on search and checkbox
  const filteredData = gapData.filter(record => {
    const matchesSearch = record.pubId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.missingDeals.some(d => d.id.toLowerCase().includes(searchTerm.toLowerCase()) || d.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      record.missingDeals.some(d => d.owner.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesGapsFilter = !filterGapsOnly || record.failed || record.missingDeals.length > 0;

    return matchesSearch && matchesGapsFilter;
  });

  const handleExport = () => {
    exportGapsToCsv(gapData);
  };

  // Determine coverage text & color variables
  const getCoverageColor = (coverage) => {
    if (coverage === 100) return 'var(--success)';
    if (coverage >= 70) return 'var(--info)';
    if (coverage >= 40) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="glass-card animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Gap Analysis Report</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Comparison of wanted deal mappings against live monetizing deals.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <Download size={16} /> Export Gaps CSV
        </button>
      </div>

      {/* Metrics Widgets */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-title">Publishers Checked</span>
          <span className="metric-value">{stats.totalPublishers}</span>
        </div>
        
        <div className="metric-card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <span className="metric-title">Publishers with Gaps</span>
          <span className="metric-value" style={{ color: stats.publishersWithGaps > 0 ? '#fcd34d' : 'var(--text-primary)' }}>
            {stats.publishersWithGaps}
          </span>
        </div>

        <div className="metric-card" style={{ borderLeft: stats.totalGaps > 0 ? '3px solid var(--error)' : '3px solid var(--success)' }}>
          <span className="metric-title">Total Missing Mappings</span>
          <span className="metric-value" style={{ color: stats.totalGaps > 0 ? '#fca5a5' : '#34d399' }}>
            {stats.totalGaps}
          </span>
        </div>

        <div className="metric-card" style={{ borderLeft: stats.totalMissingRevenue > 0 ? '3px solid var(--accent, #a855f7)' : '3px solid var(--success)' }}>
          <span className="metric-title">Missed Revenue Opportunity</span>
          <span className="metric-value" style={{ color: stats.totalMissingRevenue > 0 ? '#d8b4fe' : '#34d399' }}>
            {stats.totalMissingRevenue > 0 
              ? `$${stats.totalMissingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
              : '$0.00'}
          </span>
        </div>
      </div>

      {/* Table Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
          <input
            type="text"
            className="input-text"
            placeholder="Search publisher ID, deal, or owner..."
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={filterGapsOnly}
            onChange={(e) => setFilterGapsOnly(e.target.checked)}
            style={{ accentColor: 'var(--primary)' }}
          />
          Show only publishers with gaps or errors
        </label>
      </div>

      {/* Gap Report Table */}
      <div className="table-container">
        {filteredData.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No publisher records match your search filters.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Publisher ID</th>
                <th style={{ width: '15%' }}>Coverage</th>
                <th style={{ width: '35%' }}>Missing AP Deals</th>
                <th style={{ width: '15%' }}>Missed Revenue</th>
                <th style={{ width: '20%' }}>Deal Owner(s)</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((record) => {
                // Render Failed fetch state
                if (record.failed) {
                  return (
                    <tr key={record.pubId}>
                      <td><code>{record.pubId}</code></td>
                      <td>
                        <span className="badge badge-error" style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          <XCircle size={12} /> Fetch Failed
                        </span>
                      </td>
                      <td style={{ color: '#fca5a5', fontStyle: 'italic', fontSize: '0.85rem' }} title={record.errorMsg}>
                        {record.errorMsg ? String(record.errorMsg).replace(/^✗ Failed:\s*/, '') : 'API failed to respond for this publisher.'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>—</td>
                      <td style={{ color: 'var(--text-muted)' }}>—</td>
                    </tr>
                  );
                }

                // Render 100% complete state
                if (record.missingDeals.length === 0) {
                  return (
                    <tr key={record.pubId}>
                      <td><code>{record.pubId}</code></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--success)' }}>100%</span>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ width: '100%', height: '100%', background: 'var(--success)' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={15} /> All deals mapped
                        </span>
                      </td>
                      <td>$0.00</td>
                      <td style={{ color: 'var(--text-muted)' }}>—</td>
                    </tr>
                  );
                }

                // Render Gaps State
                // Consolidate deal owners
                const owners = [...new Set(record.missingDeals.map(d => d.owner).filter(Boolean))];

                return (
                  <tr key={record.pubId}>
                    <td><code>{record.pubId}</code></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, color: getCoverageColor(record.coverage) }}>{record.coverage}%</span>
                        <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ width: `${record.coverage}%`, height: '100%', background: getCoverageColor(record.coverage) }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {record.missingDeals.map(deal => (
                          <span 
                            key={deal.id} 
                            className="badge badge-warning" 
                            style={{ 
                              background: 'rgba(245, 158, 11, 0.08)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              color: '#fcd34d',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem'
                            }}
                            title={deal.name}
                          >
                            <strong>{deal.id}</strong> · {deal.name} {deal.revenue > 0 ? `($${deal.revenue.toLocaleString()})` : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: record.missingRevenue > 0 ? '#d8b4fe' : 'var(--text-primary)' }}>
                        {record.missingRevenue > 0 
                          ? `$${record.missingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                          : '$0.00'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.85rem' }}>
                        {owners.map((owner, idx) => (
                          <span key={idx} style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }} title={owner}>
                            {owner}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {stats.totalGaps === 0 && (
        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '0.5rem', padding: '1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
          <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
          <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>No Gaps Found</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            All publishers are 100% mapped to the wanted Auction Packages. No outreach is required.
          </p>
        </div>
      )}

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <button className="btn btn-secondary" onClick={onPrev}>
          Back to API Config
        </button>

        {stats.totalGaps > 0 && (
          <button className="btn btn-primary" onClick={onProceed}>
            Generate Outreach <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
