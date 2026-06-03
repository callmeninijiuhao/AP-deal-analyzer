/**
 * Extracts a friendly name from an owner string (typically an email).
 * e.g., "alice@example.com" -> "Alice" (capitalized)
 * "bob" -> "Bob"
 * @param {string} owner - The owner string.
 * @returns {string} The formatted name.
 */
export function getOwnerName(owner) {
  if (!owner) return 'Deal Owner';
  
  // If it's an email, take the part before '@'
  let namePart = owner;
  if (owner.includes('@')) {
    namePart = owner.split('@')[0];
  }
  
  // Clean up punctuation (dots, underscores, etc.) and capitalize
  namePart = namePart.replace(/[._-]/g, ' ');
  return namePart
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Groups gap data by owner to create consolidated email messages.
 * Handles split owners if comma-separated.
 * @param {Array<{pubId: string, missingDeals: Array<{id: string, name: string, owner: string}>}>} gapData - The gap calculation results.
 * @returns {Array<{
 *   owner: string,
 *   ownerName: string,
 *   deals: Array<{ dealId: string, dealName: string, publishers: string[] }>
 * }>}
 */
export function groupGapsByOwner(gapData) {
  const groups = {};

  gapData.forEach(gapRecord => {
    // Skip failed fetches
    if (gapRecord.failed) return;

    gapRecord.missingDeals.forEach(deal => {
      // Split by comma in case there are multiple owners listed
      const rawOwners = deal.owner ? String(deal.owner).split(',') : ['Unknown Owner'];
      
      rawOwners.forEach(rawOwner => {
        const owner = rawOwner.trim();
        if (!owner) return;

        const ownerKey = owner.toLowerCase();
        
        if (!groups[ownerKey]) {
          groups[ownerKey] = {
            owner,
            ownerName: getOwnerName(owner),
            dealsMap: {}
          };
        }
        
        const dealKey = deal.id.toLowerCase();
        if (!groups[ownerKey].dealsMap[dealKey]) {
          groups[ownerKey].dealsMap[dealKey] = {
            dealId: deal.id,
            dealName: deal.name,
            publishers: []
          };
        }
        
        // Avoid duplicate publishers in the same group
        if (!groups[ownerKey].dealsMap[dealKey].publishers.includes(gapRecord.pubId)) {
          groups[ownerKey].dealsMap[dealKey].publishers.push(gapRecord.pubId);
        }
      });
    });
  });

  return Object.values(groups)
    .map(group => {
      const deals = Object.values(group.dealsMap).sort((a, b) => 
        a.dealId.localeCompare(b.dealId)
      );
      
      return {
        owner: group.owner,
        ownerName: group.ownerName,
        deals
      };
    })
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

/**
 * Renders a consolidated message using the template and values.
 * @param {string} template - The template string.
 * @param {{
 *   ownerName: string,
 *   deals: Array<{ dealId: string, dealName: string, publishers: string[] }>
 * }} values - The replacement values.
 * @returns {string} The rendered template text.
 */
export function renderMessage(template, values) {
  const dealListText = values.deals
    .map(deal => {
      const pubList = deal.publishers.map(pub => `• ${pub}`).join('\n');
      return `Deal Name: "${deal.dealName}" (ID: ${deal.dealId})\nPublisher ID(s):\n${pubList}`;
    })
    .join('\n\n');

  const dealCount = values.deals.length;
  const publisherCount = values.deals.reduce((acc, d) => acc + d.publishers.length, 0);

  return template
    .replace(/{owner_name}/g, values.ownerName)
    .replace(/{deal_list}/g, dealListText)
    .replace(/{deal_count}/g, String(dealCount))
    .replace(/{publisher_count}/g, String(publisherCount));
}
