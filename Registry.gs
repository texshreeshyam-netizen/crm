// ============================================================
// Registry.gs — Property Registry Tracking (Step 16)
// SignatureReality CRM v1.0
// ============================================================

function createRegistry(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Registry', 'create');
    if (!data.LeadID) return error('Lead ID required.');
    if (!data.PropertyID) return error('Property ID required.');

    var regId = generateUniqueId('REG');
    var row = [
      regId,
      data.LeadID,
      data.PropertyID,
      data.TokenID || '',
      sanitizeString(data.BuyerName || ''),
      sanitizeString(data.SellerName || ''),
      sanitizeString(data.WitnessName || ''),
      sanitizeNumber(data.SalePrice || 0),
      sanitizeNumber(data.StampDuty || 0),
      sanitizeNumber(data.RegistrationFee || 0),
      data.RegistryDate || '',
      data.RegistryOffice || '',
      data.DocumentNumber || '',
      data.Status || 'Pending',
      sanitizeString(data.Notes || ''),
      sanitizeString(data.Documents || ''),
      session.userId,
      new Date()
    ];
    appendToSheet(SHEET_NAMES.REGISTRY, row);

    // Update lead status to Registry
    updateLeadStatus(data.LeadID, 'Registry', 'Registry process started');
    appendActivity(data.LeadID, session.userId, 'Registry Created',
      'Registry initiated for Property: ' + data.PropertyID + ', Sale Price: ₹' + data.SalePrice);
    logCreate(session.userId, 'Registry', regId, { leadId: data.LeadID, propertyId: data.PropertyID });
    return success({ regId: regId }, 'Registry record created');
  } catch (e) {
    Logger.log('createRegistry error: ' + e);
    return error(e.message);
  }
}

function getRegistry(regId) {
  try {
    requireLogin();
    var reg = findRowById(SHEET_NAMES.REGISTRY, 'RegistryID', regId);
    if (!reg) return error('Registry record not found.');
    return success(reg);
  } catch (e) {
    return error(e.message);
  }
}

function getAllRegistries(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.REGISTRY);
    if (filters.status) rows = rows.filter(function(r) { return r.Status === filters.status; });
    if (filters.leadId) rows = rows.filter(function(r) { return r.LeadID === filters.leadId; });
    if (filters.search) {
      var q = filters.search.toLowerCase();
      rows = rows.filter(function(r) {
        return (r.BuyerName || '').toLowerCase().indexOf(q) !== -1 ||
               (r.SellerName || '').toLowerCase().indexOf(q) !== -1 ||
               (r.LeadID || '').toLowerCase().indexOf(q) !== -1 ||
               (r.DocumentNumber || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    rows.sort(function(a, b) { return new Date(b.CreatedDate) - new Date(a.CreatedDate); });
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch (e) {
    return error(e.message);
  }
}

function updateRegistryStatus(regId, status, notes) {
  try {
    var session = requireLogin();
    enforceRBAC('Registry', 'update');
    var reg = findRowById(SHEET_NAMES.REGISTRY, 'RegistryID', regId);
    if (!reg) return error('Registry record not found.');
    var headers = getHeaders(SHEET_NAMES.REGISTRY);
    var stIdx = headers.indexOf('Status');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.REGISTRY, reg._row, stIdx + 1, status);

    // If registry done → move lead to Commission Pending
    if (status === 'Completed') {
      updateLeadStatus(reg.LeadID, 'Commission Pending', 'Registry completed');
      appendActivity(reg.LeadID, session.userId, 'Registry Completed', notes || 'Registry process completed');
    }
    logUpdate(session.userId, 'Registry', regId, { Status: reg.Status }, { Status: status });
    return success(null, 'Registry status updated to ' + status);
  } catch (e) {
    return error(e.message);
  }
}

function updateRegistry(regId, data) {
  try {
    var session = requireLogin();
    enforceRBAC('Registry', 'update');
    var reg = findRowById(SHEET_NAMES.REGISTRY, 'RegistryID', regId);
    if (!reg) return error('Registry record not found.');
    var headers = getHeaders(SHEET_NAMES.REGISTRY);
    var updatable = ['BuyerName','SellerName','WitnessName','SalePrice','StampDuty',
      'RegistrationFee','RegistryDate','RegistryOffice','DocumentNumber','Status','Notes','Documents'];
    updatable.forEach(function(f) {
      if (data[f] !== undefined) {
        var idx = headers.indexOf(f);
        if (idx !== -1) updateSheetCell(SHEET_NAMES.REGISTRY, reg._row, idx + 1, data[f]);
      }
    });
    logUpdate(session.userId, 'Registry', regId, reg, data);
    return success(null, 'Registry updated');
  } catch (e) {
    return error(e.message);
  }
}
