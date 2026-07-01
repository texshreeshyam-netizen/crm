// ============================================================
// MatchingEngine.gs — Intelligent Lead-Property Matching
// Signature Realty CRM V10
// ============================================================

function matchLeadToProperties(leadId) {
  try {
    requireLogin();
    enforceRBAC('Leads', 'read');
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
    if (!lead) return error('Lead not found.');

    var properties = getAvailableProperties();
    if (!properties.length) return error('No verified/available properties found.');

    // Build requirement from Lead fields (Groups F-P)
    var req = buildRequirementFromLead(lead);

    // Apply hard filters first
    var hardMatched = applyHardFilters(req, properties);

    // Score all hard-matched
    var scored = hardMatched.map(function(prop) {
      return {
        property: sanitizePropertyForMatch(prop),
        score: calculateMatchScore(req, prop),
        hardMatch: true
      };
    });

    // Partial matches from non-hard-matched (score >= 30)
    var hardIds = hardMatched.map(function(p) { return p.PropertyID; });
    var softOnly = properties.filter(function(p) { return hardIds.indexOf(p.PropertyID) === -1; });
    softOnly.forEach(function(prop) {
      var s = calculateMatchScore(req, prop);
      if (s >= 30) {
        scored.push({ property: sanitizePropertyForMatch(prop), score: s, hardMatch: false });
      }
    });

    // Sort descending by score
    scored.sort(function(a, b) { return b.score - a.score; });
    var topMatches = scored.slice(0, 10);

    // Update lead status & shortlist fields if matches found
    if (topMatches.length > 0) {
      var lead2 = findRowById(SHEET_NAMES.LEADS, 'LeadID', leadId);
      if (lead2 && lead2.LeadStatus === 'Requirement Filled') {
        updateLeadStatus(leadId, 'Matched', topMatches.length + ' properties matched');
      }
      // Update MatchedPropertyIDs on lead
      var matchedIds = topMatches.map(function(m) { return m.property.PropertyID; });
      var headers = getHeaders(SHEET_NAMES.LEADS);
      var mpIdx = headers.indexOf('MatchedPropertyIDs');
      var scIdx = headers.indexOf('ShortlistCount');
      if (lead2 && mpIdx !== -1) {
        updateSheetCell(SHEET_NAMES.LEADS, lead2._row, mpIdx + 1, matchedIds.join(','));
      }
      if (lead2 && scIdx !== -1) {
        updateSheetCell(SHEET_NAMES.LEADS, lead2._row, scIdx + 1, matchedIds.length);
      }

      // Increment matched count on each property
      topMatches.forEach(function(m) {
        incrementPropertyMatchCount(m.property.PropertyID);
      });
    }

    appendActivity(leadId, 'system', 'Auto Match Run',
      topMatches.length + ' properties matched (hard: ' +
      topMatches.filter(function(m) { return m.hardMatch; }).length + ')');

    return success({
      leadId: leadId,
      totalMatches: topMatches.length,
      matches: topMatches,
      requirement: req
    });
  } catch(e) {
    Logger.log('matchLeadToProperties error: ' + e);
    return error(e.message);
  }
}

// ---- Build requirement object from Lead record fields ----
function buildRequirementFromLead(lead) {
  return {
    TransactionType:  lead.TransactionType || '',
    Category:         lead.Category || '',
    SubCategory:      lead.SubCategory || '',
    BudgetMin:        safeNum(lead.BudgetMin || 0),
    BudgetMax:        safeNum(lead.BudgetMax || 0),
    BudgetFlexible:   lead.BudgetFlexible || 'No',
    Location1:        sanitizeString(lead.LocationPref1 || ''),
    Location2:        sanitizeString(lead.LocationPref2 || ''),
    Location3:        sanitizeString(lead.LocationPref3 || ''),
    LocationStrictness: lead.LocationStrictness || 'Flexible',
    BHKMin:           safeNum(lead.BHKMin || 0),
    BHKMax:           safeNum(lead.BHKMax || 0),
    Furnishing:       lead.Furnishing || '',
    PossessionRequired: lead.PossessionStatusRequired || '',
    FacingPreference: lead.FacingPreference || '',
    ParkingRequired:  lead.ParkingRequired || 'No',
    AmenitiesRequired: sanitizeString(lead.AmenitiesRequired || ''),
    TenantType:       lead.TenantType || '',
    FoodPreference:   lead.FoodPreference || '',
    PetsAllowed:      lead.PetsAllowed || ''
  };
}

// ---- Hard filters — must match to be in shortlist ----
function applyHardFilters(req, properties) {
  return properties.filter(function(prop) {
    // Category match (hard)
    if (req.Category && prop.Category !== req.Category) return false;

    // Transaction type match (hard)
    if (req.TransactionType && prop.TransactionType !== req.TransactionType) return false;

    // Budget match with tolerance
    var price = safeNum(prop.Price);
    var maxB = safeNum(req.BudgetMax);
    var minB = safeNum(req.BudgetMin);
    if (maxB > 0) {
      var tolerance = req.BudgetFlexible === 'Yes' ? 1.15 : 1.10; // 10-15% over budget
      if (price > maxB * tolerance) return false;
    }
    if (minB > 0 && price < minB * 0.85) return false; // 15% under min

    // BHK range match (hard, if specified)
    if (req.BHKMin > 0 && req.BHKMax > 0) {
      var propBHK = safeNum(prop.BHK);
      if (propBHK < req.BHKMin || propBHK > req.BHKMax) return false;
    } else if (req.BHKMin > 0) {
      if (safeNum(prop.BHK) < req.BHKMin) return false;
    }

    // Location match (at least one of 3 preferences)
    var locs = [req.Location1, req.Location2, req.Location3]
      .filter(function(l) { return l && l.trim(); })
      .map(function(l) { return l.toLowerCase(); });

    if (locs.length > 0 && req.LocationStrictness === 'Strict') {
      var propAddr = String(prop.FullAddress || '').toLowerCase();
      var locMatch = locs.some(function(l) { return propAddr.indexOf(l) !== -1; });
      if (!locMatch) return false;
    }

    return true;
  });
}

// ---- Scoring (0-100 points) ----
function calculateMatchScore(req, prop) {
  var score = 0;

  // Budget fit (0-30 pts)
  var price = safeNum(prop.Price);
  var minB = safeNum(req.BudgetMin);
  var maxB = safeNum(req.BudgetMax);
  if (maxB > 0) {
    if (price >= minB && price <= maxB) score += 30;         // Perfect fit
    else if (price <= maxB * 1.05) score += 22;              // 5% over
    else if (price <= maxB * 1.10) score += 14;              // 10% over
    else if (price <= maxB * 1.15) score += 8;               // 15% over (flexible)
  } else {
    score += 15;
  }

  // Category match (0-20 pts)
  if (!req.Category || prop.Category === req.Category) score += 20;

  // Location match (0-20 pts)
  var locs = [req.Location1, req.Location2, req.Location3]
    .filter(function(l) { return l && l.trim(); })
    .map(function(l) { return l.toLowerCase(); });
  if (locs.length > 0) {
    var propAddr = String(prop.FullAddress || '').toLowerCase();
    var exactMatch = locs.some(function(l, idx) {
      return propAddr.indexOf(l) !== -1 && idx === 0; // Primary location = more points
    });
    var anyMatch = locs.some(function(l) { return propAddr.indexOf(l) !== -1; });
    if (exactMatch) score += 20;
    else if (anyMatch) score += 12;
    else score += 3;
  } else {
    score += 10;
  }

  // BHK match (0-15 pts)
  var propBHK = safeNum(prop.BHK);
  if (req.BHKMin > 0 && req.BHKMax > 0) {
    if (propBHK >= req.BHKMin && propBHK <= req.BHKMax) score += 15;
    else if (propBHK === req.BHKMin - 1 || propBHK === req.BHKMax + 1) score += 7;
  } else if (!req.BHKMin) {
    score += 8;
  }

  // Possession (0-5 pts)
  if (!req.PossessionRequired || req.PossessionRequired === 'Any' ||
      prop.PossessionStatus === req.PossessionRequired) score += 5;

  // Facing (0-3 pts)
  if (!req.FacingPreference || prop.FacingDirection === req.FacingPreference) score += 3;

  // Parking (0-3 pts)
  if (req.ParkingRequired === 'Yes' && prop.Parking) score += 3;
  else if (req.ParkingRequired !== 'Yes') score += 2;

  // Furnishing (0-3 pts)
  if (!req.Furnishing || prop.FurnishingStatus === req.Furnishing) score += 3;

  // Amenities overlap (0-5 pts)
  if (req.AmenitiesRequired && prop.Amenities) {
    var reqAm = req.AmenitiesRequired.split(',').map(function(a) { return a.trim().toLowerCase(); });
    var propAm = prop.Amenities.split(',').map(function(a) { return a.trim().toLowerCase(); });
    var overlap = reqAm.filter(function(a) { return propAm.indexOf(a) !== -1; });
    score += Math.min(5, overlap.length * 2);
  }

  // Tenant preference match (for Rent) (0-3 pts)
  if (req.TenantType && prop.TenantPreference) {
    if (prop.TenantPreference === 'Any' || prop.TenantPreference === req.TenantType) score += 3;
  }

  // Food preference (0-2 pts)
  if (req.FoodPreference && prop.FoodPrefAllowed) {
    if (prop.FoodPrefAllowed === 'Both' || prop.FoodPrefAllowed === req.FoodPreference) score += 2;
  }

  // Pets (0-1 pt)
  if (req.PetsAllowed === 'Yes' && prop.PetsAllowedOwner === 'Yes') score += 1;
  else if (req.PetsAllowed !== 'Yes') score += 1;

  return Math.min(100, score);
}

// ---- Sanitize property for sharing (hide personal contact) ----
function sanitizePropertyForMatch(prop) {
  var safe = cloneObj(prop);
  // Remove owner/broker direct contact for matching display
  safe.OwnerPhone = '(Contact listing agent)';
  safe.OwnerEmail = '(Contact listing agent)';
  safe.BrokerPhone = '(Contact listing agent)';
  return safe;
}

function getTopMatches(leadId, limit) {
  var result = matchLeadToProperties(leadId);
  if (!result.success) return result;
  limit = limit || 5;
  result.data.matches = result.data.matches.slice(0, limit);
  return result;
}

// ---- Create Shortlist (confirm matches + update lead) ----
function createShortlist(leadId, propertyIds, notes, sharedVia) {
  try {
    var session = requireLogin();
    enforceRBAC('Leads', 'update');
    if (!propertyIds || !propertyIds.length) return error('Select at least one property.');

    // Update lead shortlist fields
    updateShortlist(leadId, propertyIds, sharedVia || '', '');

    // Update lead status
    updateLeadStatus(leadId, 'Shortlisted', 'Shortlisted ' + propertyIds.length + ' properties');

    // Increment shared count on each property
    propertyIds.forEach(function(pid) {
      incrementPropertySharedCount(pid, leadId);
    });

    // Send notification to client
    sendShortlistNotification(leadId, propertyIds);

    // Auto task: call & share with client
    onShortlistReady(leadId);

    appendActivity(leadId, session.userId, 'Shortlist Created',
      propertyIds.length + ' properties: ' + propertyIds.join(', ') +
      (notes ? ' | Notes: ' + notes : '') +
      (sharedVia ? ' | Via: ' + sharedVia : ''));

    return success({ leadId: leadId, count: propertyIds.length }, 'Shortlist created and notification sent');
  } catch(e) {
    return error(e.message);
  }
}

// ---- Hourly batch matching (for all active leads with requirements) ----
function hourlyMatchingEngine() {
  try {
    if (!getConfig('Auto_Matching_Enabled')) return;
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var eligibleStatuses = ['Requirement Filled', 'Verified'];
    var eligible = leads.filter(function(l) {
      return eligibleStatuses.indexOf(l.LeadStatus) !== -1;
    });
    var count = 0;
    eligible.forEach(function(lead) {
      try {
        matchLeadToProperties(lead.LeadID);
        count++;
      } catch(e) {
        Logger.log('hourlyMatching error for ' + lead.LeadID + ': ' + e);
      }
    });
    Logger.log('Hourly matching complete: ' + count + ' leads processed');
  } catch(e) {
    Logger.log('hourlyMatchingEngine error: ' + e);
  }
}

// ---- Find similar properties (for "Similar/Alternate" suggestions) ----
function getSimilarProperties(propertyId, limit) {
  try {
    requireLogin();
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', propertyId);
    if (!prop) return error('Property not found.');

    var allProps = getAvailableProperties().filter(function(p) {
      return p.PropertyID !== propertyId;
    });

    var fakeReq = {
      Category:         prop.Category,
      TransactionType:  prop.TransactionType,
      BudgetMin:        safeNum(prop.Price) * 0.85,
      BudgetMax:        safeNum(prop.Price) * 1.15,
      BudgetFlexible:   'Yes',
      Location1:        String(prop.FullAddress || '').split(',')[0],
      Location2:        '', Location3: '',
      LocationStrictness: 'Flexible',
      BHKMin:           safeNum(prop.BHK),
      BHKMax:           safeNum(prop.BHK) + 1,
      Furnishing:       '',
      PossessionRequired: '',
      FacingPreference: '',
      ParkingRequired:  'No',
      AmenitiesRequired: '',
      TenantType:       '', FoodPreference: '', PetsAllowed: ''
    };

    var scored = allProps.map(function(p) {
      return { property: p, score: calculateMatchScore(fakeReq, p) };
    }).filter(function(m) { return m.score >= 40; });

    scored.sort(function(a, b) { return b.score - a.score; });
    return success(scored.slice(0, limit || 5).map(function(m) { return m.property; }));
  } catch(e) {
    return error(e.message);
  }
}
