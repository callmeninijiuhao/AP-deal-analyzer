import React from 'react';
import { Settings2, Info, ArrowRight, Calendar, TestTube, Key, Shield, Save } from 'lucide-react';
import { getDaysUntilExpiry, isTokenExpired } from '../utils/apiFetcher';

/**
 * Renders the API configuration panel (Step 3).
 * @param {Object} props
 * @param {Object} props.apiConfig - Current API config object.
 * @param {function} props.onConfigChange - Handler to update configuration.
 * @param {function} props.onNext - Navigate to next stage.
 * @param {function} props.onPrev - Navigate to previous stage.
 */
export default function APIConfig({
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

  const handleSaveTokenToggle = () => {
    const next = !apiConfig.saveToken;
    onConfigChange({ ...apiConfig, saveToken: next });
    if (next) {
      try {
        localStorage.setItem('ap_gap_auth_token', apiConfig.authToken || '');
        localStorage.setItem('ap_gap_refresh_token', apiConfig.refreshToken || '');
        localStorage.setItem('ap_gap_token_expiry', apiConfig.tokenExpiry || '');
      } catch { /* ignore */ }
    } else {
      try {
        localStorage.removeItem('ap_gap_auth_token');
        localStorage.removeItem('ap_gap_refresh_token');
        localStorage.removeItem('ap_gap_token_expiry');
      } catch { /* ignore */ }
    }
  };

  const daysLeft = getDaysUntilExpiry(apiConfig.tokenExpiry);
  const expired = isTokenExpired(apiConfig.tokenExpiry);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Key size={14} /> Authentication Token
        </div>

        {/* Token Status */}
        {apiConfig.authToken && daysLeft !== null && (
          <div style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.4rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: expired ? 'rgba(239,68,68,0.1)' : daysLeft <= 7 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            color: expired ? '#fca5a5' : daysLeft <= 7 ? '#fcd34d' : '#34d399',
            border: `1px solid ${expired ? 'rgba(239,68,68,0.2)' : daysLeft <= 7 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
          }}>
            <Shield size={14} />
            {expired ? 'Token has expired — please update' : `Token expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          </div>
        )}

        <div className="grid-2">
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

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Key size={12} /> Refresh Token <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="password"
              name="refreshToken"
              className="input-text"
              placeholder="Optional refresh token for auto-rotation"
              value={apiConfig.refreshToken || ''}
              onChange={handleInputChange}
              style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Optional. Used to obtain a new access token when the current one expires.
            </span>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={12} /> Token Expiry Date
            </label>
            <input
              type="date"
              name="tokenExpiry"
              className="input-text"
              value={apiConfig.tokenExpiry || ''}
              onChange={handleInputChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Used to show a countdown warning. PubMatic tokens typically expire in 60 days.
            </span>
          </div>

          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <div
              className={`switch-container ${apiConfig.saveToken ? 'checked' : ''}`}
              onClick={handleSaveTokenToggle}
              style={{ marginTop: '1.5rem', gap: '0.75rem' }}
            >
              <div className="switch-control" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                <Save size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }} />
                Save token to this browser
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Toggle */}
      <div
        className={`switch-container ${apiConfig.demoMode ? 'checked' : ''}`}
        onClick={() => onConfigChange({ ...apiConfig, demoMode: !apiConfig.demoMode })}
        style={{ justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
      >
        <div className="switch-control" />
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            <TestTube size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
            Demo Mode
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
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
