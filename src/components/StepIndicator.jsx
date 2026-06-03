import React from 'react';
import { FileText, Users, Settings, Activity, Mail } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Wanted List', icon: FileText },
  { id: 2, label: 'Target Publishers', icon: Users },
  { id: 3, label: 'API Config & Fetch', icon: Settings },
  { id: 4, label: 'Gap Analysis', icon: Activity },
  { id: 5, label: 'Outreach Messages', icon: Mail },
];

/**
 * Renders the top progress bar step indicators.
 * @param {Object} props
 * @param {number} props.currentStep - The current active step (1-5).
 * @param {function} props.onStepClick - Callback when a step node is clicked.
 * @param {boolean} props.hasUploaded - True if Wanted List is uploaded.
 * @param {boolean} props.hasPublishers - True if publisher IDs are configured.
 * @param {boolean} props.hasFetched - True if API fetch process was run.
 */
export default function StepIndicator({
  currentStep,
  onStepClick,
  hasUploaded,
  hasPublishers,
  hasFetched
}) {
  // Determine progress line width (4 intervals for 5 steps)
  const lineWidth = `${((currentStep - 1) / 4) * 100}%`;

  const isStepSelectable = (stepId) => {
    if (stepId === 1) return true;
    if (stepId === 2) return hasUploaded;
    if (stepId === 3) return hasUploaded && hasPublishers;
    if (stepId === 4) return hasUploaded && hasPublishers && hasFetched;
    if (stepId === 5) return hasUploaded && hasPublishers && hasFetched;
    return false;
  };

  return (
    <div className="glass-card" style={{ padding: '1.25rem 2rem', marginBottom: '1rem' }}>
      <div className="step-container">
        <div className="step-line" />
        <div className="step-line-active" style={{ width: lineWidth }} />

        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const selectable = isStepSelectable(step.id);

          return (
            <div
              key={step.id}
              className={`step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              style={{ cursor: selectable ? 'pointer' : 'not-allowed', opacity: selectable ? 1 : 0.4 }}
              onClick={() => selectable && onStepClick(step.id)}
            >
              <div className="step-circle">
                <Icon size={18} />
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
