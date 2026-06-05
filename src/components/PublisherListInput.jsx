import { useState, useEffect, useRef } from 'react';
import { Users, Info } from 'lucide-react';
import PublisherUploader from './PublisherUploader';

/**
 * Textarea input and bulk file uploader for publisher IDs (Step 2).
 * @param {Object} props
 * @param {string[]} props.initialPublishers - Array of publisher IDs parsed from CSV.
 * @param {string} props.text - Controlled textarea value (optional).
 * @param {function} props.onTextChange - Callback when textarea text changes (optional).
 * @param {function} props.onChange - Handler returning clean array of publisher IDs.
 * @param {function} props.onNext - Navigate to next stage.
 * @param {function} props.onPrev - Navigate to previous stage.
 */
export default function PublisherListInput({ 
  initialPublishers = [], 
  text: controlledText,
  onTextChange,
  onChange,
  onNext,
  onPrev
}) {
  const [internalText, setInternalText] = useState(() => (initialPublishers || []).join('\n'));
  const text = controlledText !== undefined ? controlledText : internalText;
  const setText = onTextChange || setInternalText;

  const updateList = (newText) => {
    setText(newText);
    const parsed = newText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    onChange(parsed);
  };

  // Sync with initialPublishers on mount when no controlled text is provided
  const hasSynced = useRef(false);
  useEffect(() => {
    if (controlledText === undefined && !hasSynced.current && initialPublishers.length > 0) {
      setInternalText(initialPublishers.join('\n'));
      hasSynced.current = true;
    }
  }, [initialPublishers, controlledText]);

  const handleChange = (e) => {
    updateList(e.target.value);
  };

  const handleImport = (importedList) => {
    const currentList = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    
    // Merge lists uniquely
    const merged = [...new Set([...currentList, ...importedList])];
    updateList(merged.join('\n'));
  };

  const lineCount = text.split('\n').filter(line => line.trim().length > 0).length;

  return (
    <div className="glass-card animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Users className="uploader-icon" style={{ color: 'var(--primary)' }} size={24} />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Configure Target Publishers</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Specify the publisher IDs you wish to run the gap analysis on.
          </p>
        </div>
      </div>

      {initialPublishers && initialPublishers.length > 0 && (
        <div style={{ background: 'var(--success-subtle)', border: '1px solid #bbf7d0', borderRadius: '0.625rem', padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--success)' }}>
          ✓ We auto-detected <strong>{initialPublishers.length} publisher ID(s)</strong> from your Wanted List. You can review, add, or edit them below.
        </div>
      )}

      {/* Grid: Left is manual edit, Right is uploader */}
      <div className="grid-2" style={{ alignItems: 'start', gap: '2.5rem' }}>
        
        {/* Left: Textarea */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label className="form-label">Publisher IDs (One per line)</label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {lineCount} Active Publisher{lineCount !== 1 ? 's' : ''}
            </span>
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: '180px', fontFamily: 'monospace', fontSize: '0.9rem' }}
            placeholder="PUB_001&#10;PUB_002&#10;PUB_003"
            value={text}
            onChange={handleChange}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
            <Info size={12} /> Enter unique alphanumeric IDs corresponding to the platform publisher resources.
          </span>
        </div>

        {/* Right: Excel/CSV Uploader */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.25rem' }}>Bulk Import from File</label>
          <PublisherUploader onImport={handleImport} />
        </div>

      </div>

      {/* Footer Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <button className="btn btn-secondary" onClick={onPrev}>
          Back
        </button>
        <button 
          className="btn btn-primary" 
          onClick={onNext}
          disabled={lineCount === 0}
        >
          Confirm & Configure API
        </button>
      </div>

    </div>
  );
}
