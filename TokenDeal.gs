// ============================================================
// TokenDeal.gs — Token Receipts & Agreement Management
// SignatureReality CRM v1.0
// ============================================================

function createTokenReceipt(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Tokens', 'create');
    var errs = validateTokenData(data);
    if (errs.length) return error(errs.join(' '));

    var tokenId = generateUniqueId('TKN');
    var receiptNo = generateReceiptNumber();
    var row = [
      tokenId,
      data.LeadID,
      data.PropertyID,
      sanitizeNumber(data.Amount),
      new Date(data.ReceiptDate || new Date()),
      receiptNo,
      session.name,
      data.PaymentMethod,
      data.Documents || '',
      'Received'
    ];
    appendToSheet(SHEET_NAMES.TOKENS, row);
    // Update lead status
    updateLeadStatus(data.LeadID, 'Token Received', 'Token amount: ' + formatCurrency(data.Amount));
    // Update property status to Hold
    updatePropertyStatus(data.PropertyID, 'Hold');
    appendActivity(data.LeadID, session.userId, 'Token Received',
      'Amount: ' + formatCurrency(data.Amount) + ' | Receipt: ' + receiptNo + ' | Method: ' + data.PaymentMethod);
    // Auto-create commission record
    createCommissionFromToken(data, tokenId);
    logCreate(session.userId, 'Tokens', tokenId, { leadId: data.LeadID, amount: data.Amount });
    return success({ tokenId: tokenId, receiptNumber: receiptNo }, 'Token receipt created: ' + receiptNo);
  } catch(e) {
    Logger.log('createTokenReceipt error: ' + e);
    return error(e.message);
  }
}

function getToken(tokenId) {
  try {
    requireLogin();
    var token = findRowById(SHEET_NAMES.TOKENS, 'TokenID', tokenId);
    if (!token) return error('Token not found.');
    return success(token);
  } catch(e) {
    return error(e.message);
  }
}

function getAllTokens(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.TOKENS);
    if (filters.leadId) rows = rows.filter(function(r) { return r.LeadID === filters.leadId; });
    if (filters.status) rows = rows.filter(function(r) { return r.Status === filters.status; });
    rows = sortArray(rows, 'ReceiptDate', 'desc');
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch(e) {
    return error(e.message);
  }
}

function generateTokenReceiptHTML(tokenId) {
  try {
    requireLogin();
    var token = findRowById(SHEET_NAMES.TOKENS, 'TokenID', tokenId);
    if (!token) return error('Token not found.');
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', token.LeadID);
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', token.PropertyID);
    var companyName = getConfig('Company_Name') || 'SignatureReality';

    var html = '<div style="font-family:Arial;max-width:700px;margin:auto;padding:30px;border:2px solid #1976D2">' +
      '<h1 style="color:#1976D2;text-align:center">' + companyName + '</h1>' +
      '<h2 style="text-align:center;color:#555">TOKEN RECEIPT</h2>' +
      '<hr><table style="width:100%;margin:20px 0">' +
      '<tr><td><strong>Receipt No:</strong></td><td>' + token.ReceiptNumber + '</td>' +
      '<td><strong>Date:</strong></td><td>' + formatDate(token.ReceiptDate) + '</td></tr>' +
      '<tr><td><strong>Received From:</strong></td><td>' + (lead ? lead.Name : token.LeadID) + '</td>' +
      '<td><strong>Mobile:</strong></td><td>' + (lead ? lead.Mobile : '') + '</td></tr>' +
      '<tr><td><strong>Property:</strong></td><td>' + (prop ? prop.PropertyName : token.PropertyID) + '</td>' +
      '<td><strong>Location:</strong></td><td>' + (prop ? prop.Location : '') + '</td></tr>' +
      '<tr><td><strong>Amount:</strong></td><td colspan="3"><strong style="font-size:1.3em;color:#1976D2">' + formatCurrency(token.Amount) + '</strong></td></tr>' +
      '<tr><td><strong>Payment Method:</strong></td><td>' + token.PaymentMethod + '</td>' +
      '<td><strong>Received By:</strong></td><td>' + token.ReceivedBy + '</td></tr>' +
      '</table><hr>' +
      '<p style="font-size:12px;color:#888;text-align:center">This is a computer-generated receipt and is valid without signature.</p>' +
      '</div>';
    return success({ html: html, receiptNumber: token.ReceiptNumber });
  } catch(e) {
    return error(e.message);
  }
}

function getTokensByLead(leadId) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.TOKENS);
    return success(rows.filter(function(r) { return r.LeadID === leadId; }));
  } catch(e) {
    return error(e.message);
  }
}

function cancelToken(tokenId, reason) {
  try {
    var session = requireLogin();
    enforceRBAC('Tokens', 'update');
    var token = findRowById(SHEET_NAMES.TOKENS, 'TokenID', tokenId);
    if (!token) return error('Token not found.');
    var headers = getHeaders(SHEET_NAMES.TOKENS);
    var stIdx = headers.indexOf('Status');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.TOKENS, token._row, stIdx + 1, 'Cancelled');
    // Revert property status
    updatePropertyStatus(token.PropertyID, 'Available');
    updateLeadStatus(token.LeadID, 'Deal Failed', 'Token cancelled: ' + (reason || ''));
    appendActivity(token.LeadID, session.userId, 'Token Cancelled', reason || '');
    // Reverse commission
    reverseCommission(token.LeadID, token.PropertyID);
    return success(null, 'Token cancelled');
  } catch(e) {
    return error(e.message);
  }
}

// Agreements

function createAgreement(data) {
  try {
    var session = requireLogin();
    enforceRBAC('Tokens', 'create');
    var agreementId = generateUniqueId('AGR');
    var row = [
      agreementId,
      data.LeadID,
      data.PropertyID,
      data.TokenID || '',
      data.BuyerName || '',
      data.SellerName || '',
      data.WitnessName || '',
      sanitizeNumber(data.SalePrice || 0),
      new Date(data.AgreementDate || new Date()),
      data.Documents || '',
      'Draft',
      new Date()
    ];
    appendToSheet(SHEET_NAMES.AGREEMENTS, row);
    appendActivity(data.LeadID, session.userId, 'Agreement Created',
      'Agreement ' + agreementId + ' for ' + formatCurrency(data.SalePrice));
    logCreate(session.userId, 'Agreements', agreementId, { leadId: data.LeadID });
    return success({ agreementId: agreementId }, 'Agreement created');
  } catch(e) {
    return error(e.message);
  }
}

function finalizeAgreement(agreementId) {
  try {
    var session = requireLogin();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.AGREEMENTS);
    if (!sheet) return error('Agreements sheet not found.');
    var agr = findRowById(SHEET_NAMES.AGREEMENTS, 'AgreementID', agreementId);
    if (!agr) return error('Agreement not found.');
    var headers = getHeaders(SHEET_NAMES.AGREEMENTS);
    var stIdx = headers.indexOf('Status');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.AGREEMENTS, agr._row, stIdx + 1, 'Finalized');
    updateLeadStatus(agr.LeadID, 'Closed', 'Agreement finalized');
    updatePropertyStatus(agr.PropertyID, 'Sold');
    appendActivity(agr.LeadID, session.userId, 'Deal Closed', 'Agreement finalized — deal closed');
    return success(null, 'Agreement finalized. Deal closed!');
  } catch(e) {
    return error(e.message);
  }
}

function createCommissionFromToken(tokenData, tokenId) {
  try {
    var prop = findRowById(SHEET_NAMES.INVENTORY, 'PropertyID', tokenData.PropertyID);
    var salePrice = prop ? safeNum(prop.Price) : 0;
    if (salePrice <= 0) return;
    var lead = findRowById(SHEET_NAMES.LEADS, 'LeadID', tokenData.LeadID);
    createCommission({
      LeadID: tokenData.LeadID,
      PropertyID: tokenData.PropertyID,
      SalePrice: salePrice,
      AgentName: lead ? lead.Agent : '',
      Notes: 'Auto-created from token ' + tokenId
    });
  } catch(e) { Logger.log('createCommissionFromToken: ' + e); }
}
