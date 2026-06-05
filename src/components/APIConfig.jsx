import { memo } from 'react';
import { Settings2, Info, ArrowRight, Calendar, TestTube, Key } from 'lucide-react';

/**
 * Renders the API configuration panel (Step 3).
 * @param {Object} props
 * @param {Object} props.apiConfig - Current API config object.
 * @param {function} props.onConfigChange - Handler to update configuration.
 * @param {function} props.onNext - Navigate to next stage.
 * @param {function} props.onPrev - Navigate to previous stage.
 */
function APIConfig({
  apiConfig,
  onConfigChange,
  onNext,
  onPrev
}) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onConfigChange({
      ...apiConfig,
      [name]: name === 'delayMs' || name === 'concurrency' ? Number(value) : value
    });
  };

  const isFormValid = apiConfig.baseUrl.trim() && apiConfig.jsonPath.trim();
  const fromDate = apiConfig.fromDate || '';
  const toDate = apiConfig.toDate || '';

  return (
    <div className="glass-card animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Settings2 className="uploader-icon" style={{ color: 'var(--primary)' }} size={24} />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>API Configuration & Fetch</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Configure headers, endpoints, and polling delay settings.
          </p>
        </div>
      </div>

      {/* Token Management Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: 'var(--bg-subtle)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Key size={14} /> Authentication Token
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Key size={12} /> Access Token <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            type="password"
            name="authToken"
            className="input-text"
            placeholder="Paste your PubMatic access token here"
            value={apiConfig.authToken || ''}
            onChange={handleInputChange}
            style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            The token is hidden (password field) and never displayed in logs.
          </span>
        </div>
      </div>

      {/* Demo Mode Toggle */}
      <div
        className={`switch-container ${apiConfig.demoMode ? 'checked' : ''}`}
        onClick={() => onConfigChange({ ...apiConfig, demoMode: !apiConfig.demoMode })}
        style={{ justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-subtle)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
      >
        <div className="switch-control" />
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            <TestTube size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
            Demo Mode
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {apiConfig.demoMode
              ? 'Using fake deal data for testing. No real API calls will be made.'
              : 'Enable to test the full workflow without a live API connection.'}
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Base URL */}
        <div className="form-group">
          <label className="form-label">
            Base URL Endpoint Template <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            type="text"
            name="baseUrl"
            className="input-text"
            placeholder="https://api.platform.com/publishers/{pub_id}/deals"
            value={apiConfig.baseUrl}
            onChange={handleInputChange}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Info size={12} /> Replace publisher ID segment with <code>{"{pub_id}"}</code> (e.g. <code>.../publisher/{"{pub_id}"}?from...</code>)
          </span>
        </div>

        {/* Date Range */}
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} /> From Date
            </label>
            <input
              type="date"
              name="fromDate"
              className="input-text"
              value={fromDate}
              onChange={handleInputChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Start date for the API query range. Replaces <code>{"{from_date}"}</code> in the URL template.
            </span>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} /> To Date
            </label>
            <input
              type="date"
              name="toDate"
              className="input-text"
              value={toDate}
              onChange={handleInputChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              End date for the API query range. Replaces <code>{"{to_date}"}</code> in the URL template.
            </span>
          </div>
        </div>

        <div className="grid-2">
          {/* JSON Path */}
          <div className="form-group">
            <label className="form-label">
              JSON Path to Deals Array <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <input
              type="text"
              name="jsonPath"
              className="input-text"
              placeholder="rows"
              value={apiConfig.jsonPath}
              onChange={handleInputChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Dot-notation path where the deal list is located in the response JSON. Use <code>rows</code> for PubMatic reports.
            </span>
          </div>

          {/* Polling Delay */}
          <div className="form-group">
            <label className="form-label">Delay between requests (ms)</label>
            <input
              type="number"
              name="delayMs"
              className="input-text"
              min="0"
              max="5000"
              value={apiConfig.delayMs}
              onChange={handleInputChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Prevents rate limits. Default is 200ms.
            </span>
          </div>

          {/* Concurrency */}
          <div className="form-group">
            <label className="form-label">Concurrent requests</label>
            <input
              type="number"
              name="concurrency"
              className="input-text"
              min="1"
              max="20"
              value={apiConfig.concurrency}
              onChange={handleInputChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Number of parallel fetches per batch. Default is 5. Increase for speed, decrease if rate-limited.
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <button className="btn btn-secondary" onClick={onPrev}>
          Back to Publishers
        </button>
        <button
          className="btn btn-primary"
          disabled={!isFormValid}
          onClick={onNext}
        >
          Proceed to Fetch <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default memo(APIConfig);
