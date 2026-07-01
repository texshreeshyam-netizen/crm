// ============================================================
// Negotiation.gs — Negotiation Tracking & Deal Management
// SignatureReality CRM v1.0
// ============================================================

function createNegotiation(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Negotiations', 'create');
    var errs = validateNegotiationData(data);
    if (errs.length) return error(errs.join(' '));

    var negId = generateUniqueId('NEG');
    var row = [
      negId,
      data.LeadID,
      data.PropertyID,
      sanitizeNumber(data.InitialOffer || 0),
      '', // CounterOffer
      '', // FinalAmount
      0,  // Rounds
      'InProgress',
      50, // DealProbability default
      sanitizeString(data.Notes || ''),
      new Date()
    ];
    appendToSheet(SHEET_NAMES.NEGOTIATIONS, row);
    updateLeadStatus(data.LeadID, 'Negotiating', 'Negotiation started');
    appendActivity(data.LeadID, session.userId, 'Negotiation Started',
      'Initial offer: ' + formatCurrency(data.InitialOffer) + ' for property ' + data.PropertyID);
    logCreate(session.userId, 'Negotiations', negId, { leadId: data.LeadID });
    return success({ negId: negId }, 'Negotiation started successfully');
  } catch(e) {
    Logger.log('createNegotiation error: ' + e);
    return error(e.message);
  }
}

function getNegotiation(negId) {
  try {
    requireLogin();
    var neg = findRowById(SHEET_NAMES.NEGOTIATIONS, 'NegotiationID', negId);
    if (!neg) return error('Negotiation not found.');
    return success(neg);
  } catch(e) {
    return error(e.message);
  }
}

function getAllNegotiations(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.NEGOTIATIONS);
    if (filters.status) rows = rows.filter(function(r) { return r.Status === filters.status; });
    if (filters.leadId) rows = rows.filter(function(r) { return r.LeadID === filters.leadId; });
    rows = sortArray(rows, 'CreatedDate', 'desc');
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch(e) {
    return error(e.message);
  }
}

function recordOffer(negId, amount, side, notes) {
  try {
    var session = requireLogin();
    enforceRBAC('Negotiations', 'update');
    var neg = findRowById(SHEET_NAMES.NEGOTIATIONS, 'NegotiationID', negId);
    if (!neg) return error('Negotiation not found.');
    var headers = getHeaders(SHEET_NAMES.NEGOTIATIONS);

    if (side === 'buyer') {
      var ioIdx = headers.indexOf('InitialOffer');
      if (ioIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, ioIdx + 1, sanitizeNumber(amount));
    } else {
      var coIdx = headers.indexOf('CounterOffer');
      if (coIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, coIdx + 1, sanitizeNumber(amount));
    }
    // Increment rounds
    var roundsIdx = headers.indexOf('Rounds');
    var currentRounds = safeNum(neg.Rounds) + 1;
    if (roundsIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, roundsIdx + 1, currentRounds);

    // Update probability
    var prob = calculateDealProbability(negId);
    var probIdx = headers.indexOf('DealProbability');
    if (probIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, probIdx + 1, prob);

    var action = side === 'buyer' ? 'Buyer Offer' : 'Seller Counter-Offer';
    appendActivity(neg.LeadID, session.userId, action, formatCurrency(amount) + (notes ? ' — ' + notes : ''));
    logUpdate(session.userId, 'Negotiations', negId, {}, { side: side, amount: amount, round: currentRounds });
    return success({ rounds: currentRounds, probability: prob }, 'Offer recorded (Round ' + currentRounds + ')');
  } catch(e) {
    return error(e.message);
  }
}

function recordCounterOffer(negId, amount, notes) {
  return recordOffer(negId, amount, 'seller', notes);
}

function updateNegotiationStatus(negId, status, finalAmount) {
  try {
    var session = requireLogin();
    enforceRBAC('Negotiations', 'update');
    var neg = findRowById(SHEET_NAMES.NEGOTIATIONS, 'NegotiationID', negId);
    if (!neg) return error('Negotiation not found.');
    var headers = getHeaders(SHEET_NAMES.NEGOTIATIONS);
    var stIdx = headers.indexOf('Status');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, stIdx + 1, status);

    if (status === 'Agreed' && finalAmount) {
      var faIdx = headers.indexOf('FinalAmount');
      if (faIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, faIdx + 1, sanitizeNumber(finalAmount));
      var probIdx = headers.indexOf('DealProbability');
      if (probIdx !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, probIdx + 1, 100);
      updateLeadStatus(neg.LeadID, 'Token Received', 'Deal agreed at ' + formatCurrency(finalAmount));
      appendActivity(neg.LeadID, session.userId, 'Deal Agreed', 'Final amount: ' + formatCurrency(finalAmount));
    } else if (status === 'Failed') {
      var probIdx2 = headers.indexOf('DealProbability');
      if (probIdx2 !== -1) updateSheetCell(SHEET_NAMES.NEGOTIATIONS, neg._row, probIdx2 + 1, 0);
      updateLeadStatus(neg.LeadID, 'Lost', 'Negotiation failed — deal could not be closed');
      appendActivity(neg.LeadID, session.userId, 'Deal Failed', 'Negotiation unsuccessful');
    }
    logUpdate(session.userId, 'Negotiations', negId, { Status: neg.Status }, { Status: status });
    return success(null, 'Negotiation status updated to ' + status);
  } catch(e) {
    return error(e.message);
  }
}

function calculateDealProbability(negId) {
  try {
    var neg = findRowById(SHEET_NAMES.NEGOTIATIONS, 'NegotiationID', negId);
    if (!neg) return 50;
    var initialOffer = safeNum(neg.InitialOffer);
    var counterOffer = safeNum(neg.CounterOffer);
    var rounds = safeNum(neg.Rounds);

    if (!initialOffer) return 30;
    if (!counterOffer) return 50;

    var gap = Math.abs(counterOffer - initialOffer);
    var gapPercent = gap / Math.max(initialOffer, counterOffer) * 100;

    var prob = 70;
    if (gapPercent < 5) prob = 90;
    else if (gapPercent < 10) prob = 80;
    else if (gapPercent < 20) prob = 65;
    else if (gapPercent < 30) prob = 50;
    else prob = 30;

    // More rounds = less likely
    if (rounds > 5) prob = Math.max(20, prob - 10);
    return Math.min(99, Math.max(5, prob));
  } catch(e) { return 50; }
}

function getNegotiationHistory(leadId) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.NEGOTIATIONS);
    return success(rows.filter(function(r) { return r.LeadID === leadId; }));
  } catch(e) {
    return error(e.message);
  }
}

function getNegotiationsByLead(leadId) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.NEGOTIATIONS);
    return rows.filter(function(r) { return r.LeadID === leadId; });
  } catch(e) { return []; }
}
