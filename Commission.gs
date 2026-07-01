// ============================================================
// Commission.gs — Commission Calculation & Management
// SignatureReality CRM v1.0
// ============================================================

function createCommission(data) {
  try {
    var session = data._session || requireLogin();
    var errs = validateCommissionData(data);
    if (errs.length) return error(errs.join(' '));

    var defaults = getCommissionDefaults();
    var salePrice = sanitizeNumber(data.SalePrice);
    var rate = sanitizeNumber(data.CommissionRate || defaults.rate);
    var gross = (salePrice * rate) / 100;
    var tds = (gross * defaults.tdsRate) / 100;
    var gst = (gross * defaults.gstRate) / 100;
    var net = gross - tds - gst;

    // Agent split
    var agent1 = data.AgentName || data.Agent1 || '';
    var agent1Pct = sanitizeNumber(data.Agent1Percent || 100);
    var agent1Amt = (net * agent1Pct) / 100;
    var agent2 = data.Agent2 || '';
    var agent2Pct = sanitizeNumber(data.Agent2Percent || 0);
    var agent2Amt = (net * agent2Pct) / 100;

    var commId = generateUniqueId('COM');
    var row = [
      commId,
      data.LeadID,
      data.PropertyID,
      salePrice,
      rate,
      gross,
      tds,
      gst,
      net,
      agent1,
      agent1Pct,
      agent1Amt,
      agent2,
      agent2Pct,
      agent2Amt,
      'Pending',
      '',
      new Date()
    ];
    appendToSheet(SHEET_NAMES.COMMISSIONS, row);
    appendActivity(data.LeadID, session ? session.userId : 'system', 'Commission Created',
      'Gross: ' + formatCurrency(gross) + ' | TDS: ' + formatCurrency(tds) +
      ' | GST: ' + formatCurrency(gst) + ' | Net: ' + formatCurrency(net));
    logCreate(session ? session.userId : 'system', 'Commissions', commId, { net: net });
    return success({
      commId: commId,
      gross: gross,
      tds: tds,
      gst: gst,
      net: net,
      agent1Amount: agent1Amt
    }, 'Commission created');
  } catch(e) {
    Logger.log('createCommission error: ' + e);
    return error(e.message);
  }
}

function getCommission(commId) {
  try {
    requireLogin();
    var comm = findRowById(SHEET_NAMES.COMMISSIONS, 'CommissionID', commId);
    if (!comm) return error('Commission not found.');
    return success(comm);
  } catch(e) {
    return error(e.message);
  }
}

function getAllCommissions(filters) {
  try {
    var session = requireLogin();
    filters = filters || {};
    var rows = getSheetData(SHEET_NAMES.COMMISSIONS);

    if (session.role === 'Agent') {
      rows = rows.filter(function(r) { return r.Agent1 === session.name || r.Agent2 === session.name; });
    }
    if (filters.paymentStatus) rows = rows.filter(function(r) { return r.PaymentStatus === filters.paymentStatus; });
    if (filters.leadId) rows = rows.filter(function(r) { return r.LeadID === filters.leadId; });
    if (filters.agent) rows = rows.filter(function(r) { return r.Agent1 === filters.agent || r.Agent2 === filters.agent; });
    rows = sortArray(rows, 'CreatedDate', 'desc');
    return success(paginateArray(rows, filters.page, filters.pageSize || 50));
  } catch(e) {
    return error(e.message);
  }
}

function calculateCommission(dealData) {
  try {
    var defaults = getCommissionDefaults();
    var salePrice = sanitizeNumber(dealData.SalePrice);
    var rate = sanitizeNumber(dealData.CommissionRate || defaults.rate);
    var gross = (salePrice * rate) / 100;
    var tds = (gross * defaults.tdsRate) / 100;
    var gst = (gross * defaults.gstRate) / 100;
    var net = gross - tds - gst;
    return success({
      salePrice: salePrice,
      commissionRate: rate,
      gross: formatCurrency(gross),
      grossRaw: gross,
      tds: formatCurrency(tds),
      tdsRaw: tds,
      gst: formatCurrency(gst),
      gstRaw: gst,
      net: formatCurrency(net),
      netRaw: net
    });
  } catch(e) {
    return error(e.message);
  }
}

function applyTDS(amount) {
  var rate = getConfig('TDS_Rate') || 10;
  return (sanitizeNumber(amount) * rate) / 100;
}

function applyGST(amount) {
  var rate = getConfig('GST_Rate') || 18;
  return (sanitizeNumber(amount) * rate) / 100;
}

function splitCommission(netAmount, agents) {
  // agents = [{name, percent}]
  return agents.map(function(a) {
    return {
      name: a.name,
      percent: a.percent,
      amount: (sanitizeNumber(netAmount) * sanitizeNumber(a.percent)) / 100
    };
  });
}

function processCommissionPayment(commId, paymentDate) {
  try {
    var session = requireLogin();
    enforceRBAC('Commissions', 'update');
    var comm = findRowById(SHEET_NAMES.COMMISSIONS, 'CommissionID', commId);
    if (!comm) return error('Commission not found.');
    var headers = getHeaders(SHEET_NAMES.COMMISSIONS);
    var stIdx = headers.indexOf('PaymentStatus');
    var pdIdx = headers.indexOf('PaymentDate');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.COMMISSIONS, comm._row, stIdx + 1, 'Paid');
    if (pdIdx !== -1) updateSheetCell(SHEET_NAMES.COMMISSIONS, comm._row, pdIdx + 1, new Date(paymentDate || new Date()));
    appendActivity(comm.LeadID, session.userId, 'Commission Paid',
      'Net amount: ' + formatCurrency(comm.NetCommission));
    logUpdate(session.userId, 'Commissions', commId, { PaymentStatus: 'Pending' }, { PaymentStatus: 'Paid' });
    return success(null, 'Commission payment recorded');
  } catch(e) {
    return error(e.message);
  }
}

function reverseCommission(leadId, propertyId) {
  try {
    var rows = getSheetData(SHEET_NAMES.COMMISSIONS);
    var comm = rows.find(function(r) { return r.LeadID === leadId && r.PropertyID === propertyId && r.PaymentStatus !== 'Paid'; });
    if (!comm) return;
    var headers = getHeaders(SHEET_NAMES.COMMISSIONS);
    var stIdx = headers.indexOf('PaymentStatus');
    if (stIdx !== -1) updateSheetCell(SHEET_NAMES.COMMISSIONS, comm._row, stIdx + 1, 'Failed');
    appendActivity(leadId, 'system', 'Commission Reversed', 'Deal cancelled — commission reversed');
  } catch(e) { Logger.log('reverseCommission: ' + e); }
}

function getCommissionSummary() {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.COMMISSIONS);
    var summary = { totalGross: 0, totalNet: 0, totalTDS: 0, totalGST: 0, pending: 0, paid: 0 };
    rows.forEach(function(r) {
      summary.totalGross += safeNum(r.GrossCommission);
      summary.totalNet += safeNum(r.NetCommission);
      summary.totalTDS += safeNum(r.TDS);
      summary.totalGST += safeNum(r.GST);
      if (r.PaymentStatus === 'Pending' || r.PaymentStatus === 'Partial') summary.pending++;
      if (r.PaymentStatus === 'Paid') summary.paid++;
    });
    return success(summary);
  } catch(e) {
    return error(e.message);
  }
}

function getAgentCommissions(agentName) {
  try {
    requireLogin();
    var rows = getSheetData(SHEET_NAMES.COMMISSIONS);
    var agentRows = rows.filter(function(r) { return r.Agent1 === agentName || r.Agent2 === agentName; });
    var totalEarned = agentRows.reduce(function(sum, r) {
      if (r.Agent1 === agentName) return sum + safeNum(r.Agent1Amount);
      return sum + safeNum(r.Agent2Amount);
    }, 0);
    return success({ agent: agentName, records: agentRows, totalEarned: totalEarned });
  } catch(e) {
    return error(e.message);
  }
}
