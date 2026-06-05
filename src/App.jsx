import { useState, useRef } from 'react';
import { ArrowRight, Activity } from 'lucide-react';
import StepIndicator from './components/StepIndicator';
import WantedListUploader from './components/WantedListUploader';
import PublisherListInput from './components/PublisherListInput';
import APIConfig from './components/APIConfig';
import FetchProgress from './components/FetchProgress';
import GapAnalysis from './components/GapAnalysis';
import OutreachMessages, { DEFAULT_TEMPLATE } from './components/OutreachMessages';

import { fetchAllPublishers, fetchPublisherDeals } from './utils/apiFetcher';
import { calculateGaps } from './utils/gapCalculator';

// Dynamic default date range: last 7 days
const today = new Date();
const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(today.getDate() - 7);
const formatDateLocal = (d) => d.toISOString().split('T')[0];

const DEFAULT_PUBMATIC_URL = 'https://api.pubmatic.com/v1/analytics/data/publisher/{pub_id}?fromDate={from_date}T00:00&toDate={to_date}T23:59&dimensions=dealMetaId,date&metrics=revenue,paidImpressions,ecpm';

export default function App() {
  const [step, setStep] = useState(1);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Step 1 Data
  const [wantedDeals, setWantedDeals] = useState([]);
  const [uploaderSavedState, setUploaderSavedState] = useState(null);

  // Step 2 Data
  const [publishers, setPublishers] = useState([]);
  const [publisherText, setPublisherText] = useState('');

  // Step 3 Data (API Configuration)
  const [apiConfig, setApiConfig] = useState({
    baseUrl: DEFAULT_PUBMATIC_URL,
    authToken: '',
    jsonPath: 'rows',
    delayMs: 200,
    concurrency: 5,
    demoMode: false,
    fromDate: formatDateLocal(sevenDaysAgo),
    toDate: formatDateLocal(today)
  });

  // Step 3 Verification (pre-flight API test)
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyPublisherId, setVerifyPublisherId] = useState(null);

  // Step 3 Execution (Fetch Progress)
  const [isFetching, setIsFetching] = useState(false);
  const [fetchLog, setFetchLog] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [monetizingMap, setMonetizingMap] = useState({});
  const [fetchStatusMap, setFetchStatusMap] = useState({});
  const cancelRef = useRef(null);

  // Step 4 Data (Gaps results)
  const [gapResults, setGapResults] = useState({
    stats: { totalPublishers: 0, publishersWithGaps: 0, totalGaps: 0 },
    gapData: []
  });

  // Step 5 Data
  const [outreachTemplate, setOutreachTemplate] = useState(DEFAULT_TEMPLATE);

  // Helper to extract publisher ID from static URL
  const extractPublisherIdFromUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:publishers|publisher)\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  };

  // Handling CSV/Excel Upload Confirm
  const handleUploadComplete = ({ wantedDeals: parsedDeals, detectedPublishers, rawState }) => {
    setWantedDeals(parsedDeals);
    setHasUploaded(true);
    setUploaderSavedState(rawState);
    
    // Auto-populate publisher list with detected CSV publishers if any
    if (detectedPublishers.length > 0) {
      setPublishers(detectedPublishers);
      setPublisherText(detectedPublishers.join('\n'));
    }
    
    // Move to Step 2: Target Publishers Setup
    setStep(2);
  };

  // Token state is managed internally; no manual refresh needed.

  const handleStartFetch = async (overridePubs) => {
    const targetPubs = overridePubs || publishers;
    setIsFetching(true);
    setCompletedCount(0);
    setFetchLog([]);
    setHasFetched(false);
    
    // Create new cancel signal
    const controlSignal = { cancelled: false };
    cancelRef.current = controlSignal;

    const newFetchStatusMap = {};
    const formatTime = () => new Date().toLocaleTimeString();

    const handleProgress = (pubId, status, details, resultDealsCount) => {
      let type = 'info';
      if (status === 'success') type = 'success';
      if (status === 'error') type = 'error';

      setFetchLog(prev => [
        ...prev,
        {
          timestamp: formatTime(),
          type,
          text: `[${pubId}] ${details}`
        }
      ]);

      if (status === 'success' || status === 'error') {
        newFetchStatusMap[pubId] = { 
          status,
          errorMsg: status === 'error' ? details : ''
        };
        setCompletedCount(c => c + 1);
      }
    };

    // Token validation
    if (!apiConfig.demoMode && !apiConfig.authToken) {
      setFetchLog(prev => [
        ...prev,
        { timestamp: formatTime(), type: 'error', text: '[SYSTEM] No access token configured. Please enter your API token in Step 3.' }
      ]);
      setIsFetching(false);
      return;
    }

    try {
      const results = await fetchAllPublishers({
        publishers: targetPubs,
        apiConfig,
        controlSignal,
        onProgress: handleProgress
      });

      if (!controlSignal.cancelled) {
        setMonetizingMap(results);
        setFetchStatusMap(newFetchStatusMap);
        
        // Calculate gaps
        const gaps = calculateGaps(wantedDeals, results, newFetchStatusMap);
        setGapResults(gaps);

        setHasFetched(true);
        setIsFetching(false);
      }
    } catch (err) {
      setFetchLog(prev => [
        ...prev,
        { timestamp: formatTime(), type: 'error', text: `[FATAL] Pipeline error: ${err.message}` }
      ]);
      setIsFetching(false);
    }
  };

  const handleCancelFetch = () => {
    if (cancelRef.current) {
      cancelRef.current.cancelled = true;
    }
    setIsFetching(false);
    setFetchLog(prev => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), type: 'error', text: '[SYSTEM] Fetch process cancelled by user.' }
    ]);
  };

  const handleBackFromVerify = () => {
    setIsVerifying(false);
    setVerifyResult(null);
    setVerifyPublisherId(null);
  };

  const handleVerifyApi = async (targetPubs) => {
    setIsVerifying(true);
    setVerifyResult(null);

    const testPub = targetPubs[0];
    setVerifyPublisherId(testPub);

    if (!apiConfig.demoMode && !apiConfig.authToken) {
      setVerifyResult({
        success: false,
        publisherId: testPub,
        error: 'No access token configured. Please enter your API token in the configuration form.'
      });
      return;
    }

    try {
      const deals = await fetchPublisherDeals(testPub, apiConfig);
      setVerifyResult({
        success: true,
        publisherId: testPub,
        dealsCount: deals.length,
        status: 200
      });
    } catch (err) {
      let errMsg = err.message;
      if (errMsg === 'Failed to fetch' || errMsg === 'Load failed') {
        errMsg = 'Failed to fetch (Network error, CORS issue, or server unreachable)';
      }
      setVerifyResult({
        success: false,
        publisherId: testPub,
        error: errMsg
      });
    }
  };

  const handleResetFetch = () => {
    setCompletedCount(0);
    setFetchLog([]);
    setHasFetched(false);
    setIsVerifying(false);
    setVerifyResult(null);
    setVerifyPublisherId(null);
    setStep(3);
  };

  const handleBackFromFetch = () => {
    setHasFetched(false);
    setIsVerifying(false);
    setStep(3);
  };

  const navigateToStep = (targetStep) => {
    if (isFetching) return;
    if (targetStep !== 3) {
      setIsVerifying(false);
      setVerifyResult(null);
      setVerifyPublisherId(null);
    }
    setStep(targetStep);
  };

  const hasPublishers = publishers.length > 0;

  return (
    <div className="app-container">
      <header>
        <div>
          <h1 className="brand-title">
            <Activity size={20} style={{ color: 'var(--primary)' }} />
            AP Gap Analyzer
          </h1>
        </div>
        <p className="brand-subtitle">
          audit publisher monetizing packages against wanted deal distributions
        </p>
      </header>

      {/* Step Progress bar */}
      <StepIndicator
        currentStep={step === 3 && isFetching ? 3 : step}
        onStepClick={navigateToStep}
        hasUploaded={hasUploaded}
        hasPublishers={hasPublishers}
        hasFetched={hasFetched}
      />

      {/* Main Content Area */}
      <main style={{ minHeight: '500px' }}>
        
        {/* STEP 1: Upload Wanted List */}
        {step === 1 && (
          <div className="animated-fade-in">
            <WantedListUploader
              onUploadComplete={handleUploadComplete}
              savedState={uploaderSavedState}
            />
          </div>
        )}

        {/* STEP 2: Configure Target Publishers */}
        {step === 2 && (
          <PublisherListInput
            initialPublishers={publishers}
            text={publisherText}
            onTextChange={setPublisherText}
            onChange={(pubs) => setPublishers(pubs)}
            onNext={() => setStep(3)}
            onPrev={() => setStep(1)}
          />
        )}

        {/* STEP 3: API Configuration, Verification, OR Fetch Progress */}
        {step === 3 && (
          <>
            {!isVerifying && !isFetching && !hasFetched ? (
              <APIConfig
                apiConfig={apiConfig}
                onConfigChange={setApiConfig}
                onNext={() => {
                  let activePubs = [...publishers];
                  if (activePubs.length === 0) {
                    const extracted = extractPublisherIdFromUrl(apiConfig.baseUrl);
                    if (extracted) {
                      activePubs = [extracted];
                      setPublishers(activePubs);
                    } else {
                      activePubs = ['Default Publisher'];
                      setPublishers(activePubs);
                    }
                  }
                  handleVerifyApi(activePubs);
                }}
                onPrev={() => setStep(2)}
              />
            ) : isVerifying && !isFetching ? (
              <div className="glass-card animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                    {verifyResult ? (verifyResult.success ? 'API Connection Verified' : 'API Verification Failed') : 'Verifying API Connection...'}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {verifyResult
                      ? verifyResult.success
                        ? 'The test call succeeded. Review the summary below before running the full batch.'
                        : 'The test call failed. Please review your API configuration and try again.'
                      : 'Sending a pre-flight test request to validate the endpoint, token, and date range...'}
                  </p>
                </div>

                {verifyResult && (
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.625rem',
                    border: `1px solid ${verifyResult.success ? 'var(--success)' : 'var(--error)'}`,
                    background: verifyResult.success ? 'var(--success-subtle)' : 'var(--error-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: verifyResult.success ? 'var(--success)' : 'var(--error)' }}>
                      {verifyResult.success ? '✓' : '✗'} {verifyResult.success ? 'HTTP 200 OK' : 'Connection Error'}
                    </div>
                    {verifyResult.success ? (
                      <>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <strong>Test Publisher:</strong> {verifyResult.publisherId}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <strong>Deals Found:</strong> {verifyResult.dealsCount}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <strong>Test Publisher:</strong> {verifyResult.publisherId}<br />
                        <strong>Error:</strong> {verifyResult.error}
                      </div>
                    )}
                  </div>
                )}

                {!verifyResult && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <span className="spinner" style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid var(--border-strong)',
                      borderRadius: '50%',
                      borderTopColor: 'var(--primary)',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Testing with publisher: {verifyPublisherId || extractPublisherIdFromUrl(apiConfig.baseUrl) || 'Default Publisher'}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={handleBackFromVerify} disabled={!verifyResult}>
                    Back to Config
                  </button>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {verifyResult?.success && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setIsVerifying(false);
                          handleStartFetch(publishers);
                        }}
                      >
                        Run Full Fetch <ArrowRight size={16} />
                      </button>
                    )}
                    {verifyResult && !verifyResult.success && (
                      <button className="btn btn-secondary" onClick={() => { setVerifyResult(null); handleVerifyApi(publishers.length > 0 ? publishers : [verifyPublisherId || 'Default Publisher']); }}>
                        Retry Test
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <FetchProgress
                isFetching={isFetching}
                logs={fetchLog}
                completedCount={completedCount}
                totalCount={publishers.length}
                onCancel={handleCancelFetch}
                onProceed={() => setStep(4)}
                onReset={handleResetFetch}
                onBackToConfig={handleBackFromFetch}
              />
            )}
          </>
        )}

        {/* STEP 4: Gap Analysis report */}
        {step === 4 && (
          <GapAnalysis
            stats={gapResults.stats}
            gapData={gapResults.gapData}
            onProceed={() => setStep(5)}
            onPrev={() => setStep(3)}
          />
        )}

        {/* STEP 5: Outreach Messages generation */}
        {step === 5 && (
          <OutreachMessages
            gapData={gapResults.gapData}
            onPrev={() => setStep(4)}
            template={outreachTemplate}
            onTemplateChange={setOutreachTemplate}
          />
        )}

      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '2rem' }}>
        AP Gap Analyzer Tool · Browser-Native Client v1.0.0
      </footer>
    </div>
  );
}
