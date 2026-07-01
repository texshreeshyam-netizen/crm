// ============================================================
// Requirement.gs — Lead Property Requirements
// Signature Realty CRM V10
// ============================================================

function createRequirement(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Requirements', 'create');
    var errs = validateRequirementData(data);
    if (errs.length) return error(errs.join(' '));

    var reqId = generateUniqueId('REQ');
    var row = [
      reqId,
      data.LeadID,
      data.RequirementType || 'Purchase',
      data.Category || '',
      data.SubCategory || '',
      sanitizeNumber(data.BHKMin || data.BHK || 0),
      sanitizeNumber(data.BHKMax || data.BHK || 0),
      sanitizeNumber(data.BudgetMin || 0),
      sanitizeNumber(data.BudgetMax || 0),
      data.BudgetFlexible || 'No',
      sanitizeNumber(data.MinArea || 0),
      sanitizeNumber(data.MaxArea || 0),
      sanitizeString(data.Location1 || data.Locations || ''),
      sanitizeString(data.Location2 || ''),
      sanitizeString(data.Location3 || ''),
      data.LocationStrictness || 'Flexible',
      data.FacingPreference || '',
      data.ParkingRequired || 'No',
      data.Furnishing || '',
      sanitizeString(data.AmenitiesRequired || data.Amenities || ''),
      data.Possession || 'Any',
      data.FundingType || '',
      sanitizeNumber(data.LoanAmount || 0),
      data.Urgency || data.UrgencyLevel || '',
      data.Purpose || '',
      sanitizeString(data.SpecialNotes || data.Notes || ''),
      new Date()
    ];

    appendToSheet(SHEET_NAMES.REQUIREMENTS, row);

    // Update lead status to Requirement Filled
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', data.LeadID);
    if (lead && ['Interested', 'Verified', 'Telecalling'].indexOf(lead.LeadStatus) !== -1) {
      updateLeadStatus(data.LeadID, 'Requirement Filled', 'Full requirement form filled');
      onRequirementFilled(data.LeadID);
    }

    logCreate(session.userId, 'Requirements', reqId, { leadId: data.LeadID });
    appendActivity(data.LeadID, session.userId, 'Requirement Added',
      (data.RequirementType || 'Purchase') + ' | ' + (data.Category || '') +
      ' | Budget: ₹' + sanitizeNumber(data.BudgetMin) + '–₹' + sanitizeNumber(data.BudgetMax) +
      ' | Loc: ' + (data.Location1 || ''));

    return success({ reqId: reqId }, 'Requirement saved');
  } catch(e) {
    Logger.log('createRequirement error: ' + e);
    return error(e.message);
  }
}

function getRequirements(leadId) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.REQUIREMENTS);
    return rows.filter(function(r) { return r.LeadID === leadId; });
  } catch(e) {
    return [];
  }
}

function getRequirement(reqId) {
  try {
    requireLogin();
    var req = findRowById(SHEET_NAMES.REQUIREMENTS, 'RequirementID', reqId);
    if (!req) return error('Requirement not found.');
    return success(req);
  } catch(e) {
    return error(e.message);
  }
}

function updateRequirement(reqId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('Requirements', 'update');
    var req = findRowById(SHEET_NAMES.REQUIREMENTS, 'RequirementID', reqId);
    if (!req) return error('Requirement not found.');
    var headers = getHeaders(SHEET_NAMES.REQUIREMENTS);
    var updatable = [
      'RequirementType', 'Category', 'SubCategory',
      'BHKMin', 'BHKMax', 'BudgetMin', 'BudgetMax', 'BudgetFlexible',
      'MinArea', 'MaxArea',
      'Location1', 'Location2', 'Location3', 'LocationStrictness',
      'FacingPreference', 'ParkingRequired', 'Furnishing', 'AmenitiesRequired',
      'Possession', 'FundingType', 'LoanAmount', 'Urgency', 'Purpose', 'SpecialNotes'
    ];
    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.REQUIREMENTS, req._row, idx + 1, data[f]);
      }
    });
    logUpdate(session.userId, 'Requirements', reqId, req, data);
    appendActivity(req.LeadID, session.userId, 'Requirement Updated', 'Requirement ' + reqId + ' updated');
    return success(null, 'Requirement updated');
  } catch(e) {
    return error(e.message);
  }
}

function deleteRequirement(reqId) {
  try {
    var session = requireLogin();
    var req = findRowById(SHEET_NAMES.REQUIREMENTS, 'RequirementID', reqId);
    if (!req) return error('Requirement not found.');
    deleteSheetRow(SHEET_NAMES.REQUIREMENTS, req._row);
    logDelete(session.userId, 'Requirements', reqId, req);
    return success(null, 'Requirement deleted');
  } catch(e) {
    return error(e.message);
  }
}

function getAllRequirements(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.REQUIREMENTS);
    if (filters.category) rows = rows.filter(function(r) { return r.Category === filters.category; });
    if (filters.leadId) rows = rows.filter(function(r) { return r.LeadID === filters.leadId; });
    if (filters.requirementType) rows = rows.filter(function(r) { return r.RequirementType === filters.requirementType; });
    return success(rows);
  } catch(e) {
    return error(e.message);
  }
}
