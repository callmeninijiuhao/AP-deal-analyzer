import React, { useState, useMemo } from 'react';
import { Copy, Check, CheckCircle2, HelpCircle } from 'lucide-react';
import { groupGapsByOwner, renderMessage } from '../utils/messageRenderer';

export const DEFAULT_TEMPLATE = `Hi {owner_name},

I'm reaching out regarding Auction Package deal mapping for some of our publishers.

The following deals require mapping updates for eligible publishers:

{deal_list}

Could you please arrange to map these publishers to the respective deals? Let me know if you need any additional information.

Thanks,
[Your Name]`;

/**
 * Outreach email template editor and copy dashboard (Step 5).
 * @param {Object} props
 * @param {Array<Object>} props.gapData - The computed gap data.
 * @param {function} props.onPrev - Previous step navigation.
 */
export default function OutreachMessages({ gapData, onPrev, template: controlledTemplate, onTemplateChange }) {
  const [internalTemplate, setInternalTemplate] = useState(DEFAULT_TEMPLATE);
  const template = controlledTemplate !== undefined ? controlledTemplate : internalTemplate;
  const setTemplate = onTemplateChange || setInternalTemplate;

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Group the gaps by owner only
  const groupedGaps = useMemo(() => {
    return groupGapsByOwner(gapData);
  }, [gapData]);

  // Render all grouped messages
  const renderedMessages = useMemo(() => {
    return groupedGaps.map((group, index) => {
      const messageText = renderMessage(template, group);
      const totalPubCount = group.deals.reduce((acc, d) => acc + d.publishers.length, 0);
      
      return {
        id: `${group.owner}-${index}`,
        recipient: group.owner,
        dealCount: group.deals.length,
        publisherCount: totalPubCount,
        text: messageText
      };
    });
  }, [groupedGaps, template]);

  const handleCopySingle = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = () => {
    const separator = '\n\n---\n\n';
    const allText = renderedMessages
      .map(m => `To: ${m.recipient}\nSubject: Consolidated AP Deal Mapping Update Required\n\n${m.text}`)
      .join(separator);

    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="glass-card animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Generate Outreach Messages</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Consolidated outreach messages. Gaps are grouped by Deal Owner so that each owner receives a single email listing all their missing deals.
          </p>
        </div>
        {renderedMessages.length > 0 && (
          <button 
            className="btn btn-primary" 
            onClick={handleCopyAll}
            style={{ display: 'inline-flex', gap: '0.5rem', background: 'var(--secondary)' }}
          >
            {copiedAll ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {copiedAll ? 'All Copied!' : 'Copy All Messages'}
          </button>
        )}
      </div>

      {/* Split Layout Container */}
      <div className="grid-2" style={{ alignItems: 'start', gap: '2rem' }}>
        
        {/* Left Column: Template Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Outreach Template</label>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.3rem' }}
                onClick={() => setTemplate(DEFAULT_TEMPLATE)}
              >
                Reset to Default
              </button>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: '300px', fontSize: '0.9rem', lineHeight: '1.5' }}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </div>

          {/* Template Help variables cheat-sheet */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              <HelpCircle size={14} /> Available Template Variables
            </span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.4rem 0', fontWeight: 'bold', color: 'var(--primary)', width: '30%' }}><code>{"{owner_name}"}</code></td>
                  <td style={{ padding: '0.4rem 0' }}>Part before email '@', capitalized (e.g. Alice)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.4rem 0', fontWeight: 'bold', color: 'var(--primary)' }}><code>{"{deal_list}"}</code></td>
                  <td style={{ padding: '0.4rem 0' }}>Consolidated list of deals and missing publishers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Rendered Emails list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '580px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Rendered Emails ({renderedMessages.length})
            </span>
          </div>

          {renderedMessages.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '0.75rem' }}>
              No messages generated. Is the gap list empty?
            </div>
          ) : (
            renderedMessages.map((msg) => {
              const isCopied = copiedId === msg.id;
              return (
                <div key={msg.id} className="email-card animated-fade-in">
                  <div className="email-header">
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RECIPIENT</div>
                      <div className="email-recipient">{msg.recipient}</div>
                    </div>

                    <div className="email-badges">
                      <span className="badge badge-info">
                        {msg.dealCount} Deal{msg.dealCount !== 1 ? 's' : ''}
                      </span>
                      <span className="badge badge-warning" style={{ background: 'rgba(245,158,11,0.08)', color: '#fcd34d' }}>
                        {msg.publisherCount} Pub{msg.publisherCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="email-body" style={{ fontSize: '0.9rem' }}>
                    {msg.text}
                  </div>

                  <button
                    className={`btn ${isCopied ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ alignSelf: 'flex-end', padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.35rem', minWidth: '100px' }}
                    onClick={() => handleCopySingle(msg.id, msg.text)}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <button className="btn btn-secondary" onClick={onPrev}>
          Back to Gap Report
        </button>
      </div>
    </div>
  );
}
