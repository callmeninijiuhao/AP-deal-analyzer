/**
 * Computes coverage and identifies missing deals for each publisher.
 * @param {Array<{id: string, name: string, owner: string}>} wantedDeals - List of wanted deals.
 * @param {Record<string, string[]>} monetizingMap - Map of publisher ID to their monetizing deal IDs.
 * @param {Record<string, {status: string}>} [fetchStatusMap] - Optional map of publisher ID to their fetch status.
 * @returns {{
 *   stats: { totalPublishers: number, publishersWithGaps: number, totalGaps: number },
 *   gapData: Array<{
 *     pubId: string,
 *     coverage: number,
 *     missingDeals: Array<{id: string, name: string, owner: string}>,
 *     monetizingCount: number,
 *     wantedCount: number,
 *     failed: boolean
 *   }>
 * }}
 */
export function calculateGaps(wantedDeals, monetizingMap, fetchStatusMap = {}) {
  const gapData = [];
  let publishersWithGaps = 0;
  let totalGaps = 0;
  let totalMissingRevenue = 0;

  const publishers = Object.keys(monetizingMap);

  publishers.forEach(pubId => {
    const statusInfo = fetchStatusMap[pubId];
    const isFailed = statusInfo?.status === 'error';

    // If fetch failed, we skip normal gap calculation for this publisher
    if (isFailed) {
      gapData.push({
        pubId,
        coverage: 0,
        missingDeals: [],
        monetizingCount: 0,
        wantedCount: wantedDeals.length,
        failed: true,
        errorMsg: statusInfo?.errorMsg || 'Fetch failed',
        missingRevenue: 0
      });
      return;
    }

    const monetizingDeals = monetizingMap[pubId] || [];
    
    // Normalize monetizing deals to set of strings for O(1) lookups
    const monetizingSet = new Set(monetizingDeals.map(id => String(id).toLowerCase().trim()));

    // A deal is missing if it is wanted and not in the monetizing set
    const missingDeals = wantedDeals.filter(deal => {
      const dealIdNormalized = String(deal.id).toLowerCase().trim();
      return !monetizingSet.has(dealIdNormalized);
    });

    const totalWanted = wantedDeals.length;
    const missingCount = missingDeals.length;
    const matchedCount = totalWanted - missingCount;
    
    const coverage = totalWanted > 0 
      ? Math.round((matchedCount / totalWanted) * 100) 
      : 100;

    const missingRevenue = missingDeals.reduce((sum, d) => sum + (d.revenue || 0), 0);

    if (missingCount > 0) {
      publishersWithGaps++;
      totalGaps += missingCount;
      totalMissingRevenue += missingRevenue;
    }

    gapData.push({
      pubId,
      coverage,
      missingDeals,
      monetizingCount: matchedCount,
      wantedCount: totalWanted,
      failed: false,
      missingRevenue
    });
  });

  // Sort by most gaps first (i.e. lowest coverage first, or greatest missing count first)
  // Failed ones go to the bottom or top depending on preference, let's put them at the bottom.
  gapData.sort((a, b) => {
    if (a.failed && !b.failed) return 1;
    if (!a.failed && b.failed) return -1;
    if (a.failed && b.failed) return a.pubId.localeCompare(b.pubId);
    
    // Compare missing count
    const aMissing = a.missingDeals.length;
    const bMissing = b.missingDeals.length;
    if (bMissing !== aMissing) {
      return bMissing - aMissing; // Most missing first
    }
    return a.pubId.localeCompare(b.pubId);
  });

  return {
    stats: {
      totalPublishers: publishers.length,
      publishersWithGaps,
      totalGaps,
      totalMissingRevenue
    },
    gapData
  };
}
