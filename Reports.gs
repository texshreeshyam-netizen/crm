// ============================================================
// Reports.gs — Business Report Generation
// Signature Realty CRM V10
// ============================================================

function generateLeadReport(filters) {
  try {
    requireLogin();
    filters = filters || {};
    var leads = getSheetData(SHEET_NAMES.LEADS);

    // V10 field names: DateCreated, LeadStatus, AssignedAgent
    if (filters.fromDate) {
      var fd = new Date(filters.fromDate);
      leads = leads.filter(function(l) { return new Date(l.DateCreated) >= fd; });
    }
    if (filters.toDate) {
      var td = new Date(filters.toDate);
      leads = leads.filter(function(l) { return new Date(l.DateCreated) <= td; });
    }
    if (filters.source)    leads = leads.filter(function(l) { return l.Source === filters.source; });
    if (filters.status)    leads = leads.filter(function(l) { return l.LeadStatus === filters.status; });
    if (filters.agent)     leads = leads.filter(function(l) { return l.AssignedAgent === filters.agent; });
    if (filters.category)  leads = leads.filter(function(l) { return l.Category === filters.category; });
    if (filters.leadType)  leads = leads.filter(function(l) { return l.LeadType === filters.leadType; });
    if (filters.transactionType) leads = leads.filter(function(l) { return l.TransactionType === filters.transactionType; });

    var sourceBreakdown = {};
    var statusBreakdown = {};
    var scoreBreakdown = { Hot: 0, Warm: 0, Cold: 0 };
    var categoryBreakdown = {};
    var transactionBreakdown = {};
    var leadTypeBreakdown = {};

    leads.forEach(function(l) {
      sourceBreakdown[l.Source]          = (sourceBreakdown[l.Source] || 0) + 1;
      statusBreakdown[l.LeadStatus]      = (statusBreakdown[l.LeadStatus] || 0) + 1;
      categoryBreakdown[l.Category]      = (categoryBreakdown[l.Category] || 0) + 1;
      transactionBreakdown[l.TransactionType] = (transactionBreakdown[l.TransactionType] || 0) + 1;
      leadTypeBreakdown[l.LeadType]      = (leadTypeBreakdown[l.LeadType] || 0) + 1;
      if (l.ScoreCategory) scoreBreakdown[l.ScoreCategory] = (scoreBreakdown[l.ScoreCategory] || 0) + 1;
    });

    return success({
      type: 'Lead Report',
      generatedAt: new Date(),
      filters: filters,
      totalLeads: leads.length,
      bySource: sourceBreakdown,
      byStatus: statusBreakdown,
      byScore: scoreBreakdown,
      byCategory: categoryBreakdown,
      byTransaction: transactionBreakdown,
      byLeadType: leadTypeBreakdown,
      leads: leads.slice(0, 200)
    });
  } catch(e) { return error(e.message); }
}

function generateRevenueReport(period) {
  try {
    requireLogin();
    period = period || 'monthly';
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);
    var now = new Date();
    var startDate;
    if (period === 'weekly') startDate = getWeekStart(now);
    else if (period === 'monthly') startDate = getMonthStart(now);
    else if (period === 'yearly') startDate = getYearStart(now);
    else startDate = new Date(0);

    var filtered = commissions.filter(function(c) { return new Date(c.CreatedDate) >= startDate; });
    var totalSales  = filtered.reduce(function(s, c) { return s + safeNum(c.SalePrice); }, 0);
    var totalGross  = filtered.reduce(function(s, c) { return s + safeNum(c.GrossCommission); }, 0);
    var totalNet    = filtered.reduce(function(s, c) { return s + safeNum(c.NetCommission); }, 0);
    var totalTDS    = filtered.reduce(function(s, c) { return s + safeNum(c.TDS); }, 0);
    var totalGST    = filtered.reduce(function(s, c) { return s + safeNum(c.GST); }, 0);

    var byAgent = {};
    filtered.forEach(function(c) {
      if (c.Agent1) {
        if (!byAgent[c.Agent1]) byAgent[c.Agent1] = { deals: 0, amount: 0 };
        byAgent[c.Agent1].deals++;
        byAgent[c.Agent1].amount += safeNum(c.Agent1Amount);
      }
    });

    return success({
      type: 'Revenue Report',
      period: period,
      startDate: formatDate(startDate),
      endDate: formatDate(now),
      totalDeals: filtered.length,
      totalSalesValue: totalSales,
      grossCommission: totalGross,
      netCommission: totalNet,
      tdsDeducted: totalTDS,
      gstCollected: totalGST,
      byAgent: byAgent,
      records: filtered
    });
  } catch(e) { return error(e.message); }
}

function generateAgentReport(agentName, period) {
  try {
    requireLogin();
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var visits = getSheetData(SHEET_NAMES.SITE_VISITS);
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);

    // V10: AssignedAgent, LeadStatus
    var agentLeads = leads.filter(function(l) { return l.AssignedAgent === agentName; });
    var agentVisits = visits.filter(function(v) { return v.Agent === agentName; });
    var agentComm = commissions.filter(function(c) { return c.Agent1 === agentName || c.Agent2 === agentName; });

    var closedLeads = agentLeads.filter(function(l) { return l.LeadStatus === 'Closed'; }).length;
    var totalEarned = agentComm.reduce(function(sum, c) {
      if (c.Agent1 === agentName) return sum + safeNum(c.Agent1Amount);
      return sum + safeNum(c.Agent2Amount);
    }, 0);

    var statusBreakdown = {};
    agentLeads.forEach(function(l) {
      statusBreakdown[l.LeadStatus] = (statusBreakdown[l.LeadStatus] || 0) + 1;
    });

    return success({
      type: 'Agent Performance Report',
      agent: agentName,
      totalLeads: agentLeads.length,
      closedDeals: closedLeads,
      conversionRate: agentLeads.length > 0 ? Math.round((closedLeads / agentLeads.length) * 100) : 0,
      siteVisits: agentVisits.length,
      completedVisits: agentVisits.filter(function(v) { return v.Status === 'Completed'; }).length,
      totalCommission: totalEarned,
      hotLeads: agentLeads.filter(function(l) { return l.ScoreCategory === 'Hot'; }).length,
      warmLeads: agentLeads.filter(function(l) { return l.ScoreCategory === 'Warm'; }).length,
      byStatus: statusBreakdown,
      leads: agentLeads,
      commissions: agentComm
    });
  } catch(e) { return error(e.message); }
}

function generateCommissionReport(period) {
  try {
    requireLogin();
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);
    var grouped = { Pending: [], Paid: [], Partial: [], Failed: [] };
    commissions.forEach(function(c) {
      var s = c.PaymentStatus || 'Pending';
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(c);
    });

    var summary = {};
    Object.keys(grouped).forEach(function(s) {
      summary[s] = {
        count: grouped[s].length,
        totalNet: grouped[s].reduce(function(sum, c) { return sum + safeNum(c.NetCommission); }, 0)
      };
    });

    return success({
      type: 'Commission Report',
      generatedAt: new Date(),
      summary: summary,
      records: commissions
    });
  } catch(e) { return error(e.message); }
}

function generateInventoryReport() {
  try {
    requireLogin();
    var props = getSheetData(SHEET_NAMES.INVENTORY);
    // V10 fields: AvailabilityStatus, Category, ListingType
    var byStatus = {};
    var byCategory = {};
    var byListingType = {};
    var byTransaction = {};
    var totalAvailableValue = 0;
    var staleCount = 0;
    var staleDays = getConfig('Stale_Inventory_Days') || 60;
    var staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - staleDays);

    props.forEach(function(p) {
      byStatus[p.AvailabilityStatus]  = (byStatus[p.AvailabilityStatus] || 0) + 1;
      byCategory[p.Category]          = (byCategory[p.Category] || 0) + 1;
      byListingType[p.ListingType]    = (byListingType[p.ListingType] || 0) + 1;
      byTransaction[p.TransactionType] = (byTransaction[p.TransactionType] || 0) + 1;
      if (p.AvailabilityStatus === 'Available') totalAvailableValue += safeNum(p.Price);
      if (p.AvailabilityStatus === 'Available' && p.CreatedDate && new Date(p.CreatedDate) < staleCutoff) staleCount++;
    });

    var avgDaysInInv = 0;
    if (props.length) {
      var totalDays = props.reduce(function(sum, p) {
        return sum + (p.CreatedDate ? daysBetween(p.CreatedDate, new Date()) : 0);
      }, 0);
      avgDaysInInv = Math.round(totalDays / props.length);
    }

    return success({
      type: 'Inventory Report',
      generatedAt: new Date(),
      totalProperties: props.length,
      byStatus: byStatus,
      byCategory: byCategory,
      byListingType: byListingType,
      byTransaction: byTransaction,
      availableInventoryValue: totalAvailableValue,
      staleProperties: staleCount,
      avgDaysInInventory: avgDaysInInv,
      properties: props
    });
  } catch(e) { return error(e.message); }
}

function generateMonthlySummary() {
  try {
    requireLogin();
    var now = new Date();
    var monthStart = getMonthStart(now);
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);

    // V10 field: DateCreated, LeadStatus
    var monthLeads = leads.filter(function(l) { return new Date(l.DateCreated) >= monthStart; });
    var monthComm = commissions.filter(function(c) { return new Date(c.CreatedDate) >= monthStart; });

    return success({
      type: 'Monthly Summary',
      month: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      newLeads: monthLeads.length,
      closedDeals: monthLeads.filter(function(l) { return l.LeadStatus === 'Closed'; }).length,
      revenue: monthComm.reduce(function(sum, c) { return sum + safeNum(c.NetCommission); }, 0),
      hotLeads: monthLeads.filter(function(l) { return l.ScoreCategory === 'Hot'; }).length,
      leadsBySource: getLeadSourceBreakdown(),
      pipeline: getLeadPipeline()
    });
  } catch(e) { return error(e.message); }
}

function generateBuilderProjectReport() {
  try {
    requireLogin();
    var projects = getSheetData(SHEET_NAMES.BUILDER_PROJECTS);
    var units = getSheetData(SHEET_NAMES.INVENTORY).filter(function(p) {
      return p.ListingType === 'Builder-Developer';
    });
    var projectSummary = projects.map(function(proj) {
      var projUnits = units.filter(function(u) { return u.LinkedProjectID === proj.ProjectID; });
      return {
        ProjectID: proj.ProjectID,
        ProjectName: proj.ProjectName,
        Builder: proj.BuilderCompanyName,
        LaunchStatus: proj.LaunchStatus,
        TotalUnits: projUnits.length,
        Available: projUnits.filter(function(u) { return u.AvailabilityStatus === 'Available'; }).length,
        Sold: projUnits.filter(function(u) { return u.AvailabilityStatus === 'Sold'; }).length,
        PriceRange: '₹' + formatNum(proj.PriceRangeMin) + '–₹' + formatNum(proj.PriceRangeMax)
      };
    });
    return success({
      type: 'Builder Project Report',
      totalProjects: projects.length,
      projects: projectSummary
    });
  } catch(e) { return error(e.message); }
}

function exportReportCSV(reportType, filters) {
  try {
    requireLogin();
    enforceRBAC('Reports', 'export');
    var reportData;
    if (reportType === 'leads')       reportData = generateLeadReport(filters);
    else if (reportType === 'revenue') reportData = generateRevenueReport(filters && filters.period);
    else if (reportType === 'inventory') reportData = generateInventoryReport();
    else if (reportType === 'commissions') reportData = generateCommissionReport();
    else if (reportType === 'builder') reportData = generateBuilderProjectReport();
    else return error('Unknown report type: ' + reportType);

    if (!reportData.success) return reportData;
    var rows = reportData.data.leads || reportData.data.records || reportData.data.properties || reportData.data.projects || [];
    if (!rows.length) return success('No data', 'Empty report');
    var headers = Object.keys(rows[0]).filter(function(k) { return k !== '_row'; });
    var csv = headers.join(',') + '\n';
    rows.forEach(function(r) {
      csv += headers.map(function(h) {
        return '"' + String(r[h] || '').replace(/"/g, '""') + '"';
      }).join(',') + '\n';
    });
    return success(csv);
  } catch(e) { return error(e.message); }
}

function getReportsList() {
  return success([
    { id: 'leads',       name: 'Lead Report',           description: 'All leads with filters & breakdown' },
    { id: 'revenue',     name: 'Revenue Report',         description: 'Commission and revenue by period' },
    { id: 'agent',       name: 'Agent Performance',      description: 'Agent-wise KPIs' },
    { id: 'commissions', name: 'Commission Report',      description: 'Commission status breakdown' },
    { id: 'inventory',   name: 'Inventory Report',       description: 'Property listing status & values' },
    { id: 'monthly',     name: 'Monthly Summary',        description: 'Month overview for management' },
    { id: 'builder',     name: 'Builder Project Report', description: 'Builder projects & unit availability' }
  ]);
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
