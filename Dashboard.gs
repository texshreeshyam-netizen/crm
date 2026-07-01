// ============================================================
// Dashboard.gs — KPI & Analytics Data
// Signature Realty CRM V10
// ============================================================

function getDashboardData() {
  try {
    // Check if sheets are set up
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var leadsSheet = ss.getSheetByName(SHEET_NAMES.LEADS);
    if (!leadsSheet) {
      return success({
        setupRequired: true,
        kpis: { totalLeads:0, hotLeads:0, closedLeads:0, availableProperties:0,
                activeLeads:0, conversionRate:0, monthlyRevenue:0, pendingCommission:0,
                newLeadsThisMonth:0, staleProperties:0, pendingDeals:0, avgDealValue:0 },
        pipeline: [], revenue: [], agents: [], recentActivities: [],
        todaysVisits: [], pendingFollowUps: [],
        propertyStats: { available:0 }, conversionFunnel: [], inventorySnapshot: {}
      }, 'Setup required — run setupCRM() in Apps Script editor first');
    }

    var data = {};
    // Each section loads independently — one failure won't break the whole dashboard
    try { data.kpis = getKPIs(); } catch(e) { data.kpis = {}; Logger.log('getKPIs error: '+e); }
    try { data.pipeline = getLeadPipeline(); } catch(e) { data.pipeline = []; Logger.log('pipeline error: '+e); }
    try { data.revenue = getRevenueMetrics(); } catch(e) { data.revenue = []; Logger.log('revenue error: '+e); }
    try { data.agents = getAgentMetrics(); } catch(e) { data.agents = []; Logger.log('agents error: '+e); }
    try { data.recentActivities = getRecentActivities(10); } catch(e) { data.recentActivities = []; Logger.log('activities error: '+e); }
    try { data.todaysVisits = getTodaysVisits(); } catch(e) { data.todaysVisits = []; Logger.log('visits error: '+e); }
    try { data.pendingFollowUps = getPendingFollowUps(); } catch(e) { data.pendingFollowUps = []; Logger.log('followups error: '+e); }
    try { data.propertyStats = getPropertyStats(); } catch(e) { data.propertyStats = {}; Logger.log('propStats error: '+e); }
    try { data.conversionFunnel = getConversionFunnel(); } catch(e) { data.conversionFunnel = []; Logger.log('funnel error: '+e); }
    try { data.inventorySnapshot = getInventorySnapshot(); } catch(e) { data.inventorySnapshot = {}; Logger.log('snapshot error: '+e); }

    return success(data);
  } catch(e) {
    Logger.log('getDashboardData error: ' + e);
    return error('Dashboard error: ' + e.message + ' — Run setupCRM() if sheets are missing.');
  }
}

function getKPIs() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);
    var now = new Date();
    var monthStart = getMonthStart(now);

    var totalLeads = leads.length;
    // V10 field: LeadStatus
    var closedLeads = leads.filter(function(l) { return l.LeadStatus === 'Closed'; }).length;
    var conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

    var paidComm = commissions.filter(function(c) { return c.PaymentStatus === 'Paid'; });
    var totalRevenue = paidComm.reduce(function(sum, c) { return sum + safeNum(c.NetCommission); }, 0);

    var monthlyComm = paidComm.filter(function(c) { return new Date(c.PaymentDate) >= monthStart; });
    var monthlyRevenue = monthlyComm.reduce(function(sum, c) { return sum + safeNum(c.NetCommission); }, 0);

    var avgDealValue = closedLeads > 0 ?
      commissions.reduce(function(sum, c) { return sum + safeNum(c.SalePrice); }, 0) / closedLeads : 0;

    var pendingComm = commissions.filter(function(c) { return c.PaymentStatus === 'Pending'; });
    var pendingAmount = pendingComm.reduce(function(sum, c) { return sum + safeNum(c.NetCommission); }, 0);

    var hotLeads = leads.filter(function(l) { return l.ScoreCategory === 'Hot'; }).length;
    // V10 field: DateCreated
    var newLeads = leads.filter(function(l) { return new Date(l.DateCreated) >= monthStart; }).length;

    var activeStatuses = [
      'New', 'Telecalling', 'Interested', 'Verified',
      'Requirement Filled', 'Matched', 'Shortlisted',
      'Shared with Client', 'Site Visit Scheduled', 'Site Visited',
      'Negotiating', 'Token Received'
    ];
    var activeLeads = leads.filter(function(l) {
      return activeStatuses.indexOf(l.LeadStatus) !== -1;
    }).length;

    var propStats = getPropertyStats();

    return {
      totalLeads: totalLeads,
      activeLeads: activeLeads,
      closedLeads: closedLeads,
      conversionRate: conversionRate,
      totalRevenue: totalRevenue,
      monthlyRevenue: monthlyRevenue,
      pendingCommission: pendingAmount,
      avgDealValue: avgDealValue,
      hotLeads: hotLeads,
      newLeadsThisMonth: newLeads,
      pendingDeals: pendingComm.length,
      availableProperties: propStats.available || 0,
      staleProperties: propStats.stale || 0,
      pendingVerification: propStats.pendingVerification || 0
    };
  } catch(e) {
    Logger.log('getKPIs error: ' + e);
    return {};
  }
}

function getLeadPipeline() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    // Full V10 funnel stages
    var stages = [
      'New', 'Telecalling', 'No Answer', 'Call Later',
      'Interested', 'Verified', 'Requirement Filled',
      'Matched', 'Shortlisted', 'Shared with Client',
      'Site Visit Scheduled', 'Site Visited',
      'Negotiating', 'Token Received', 'Deal Confirmed',
      'Registry', 'Commission Pending', 'Closed',
      'Lost', 'Invalid', 'Not Interested', 'Inactive'
    ];
    return stages.map(function(stage) {
      var count = leads.filter(function(l) { return l.LeadStatus === stage; }).length;
      return { stage: stage, count: count };
    }).filter(function(s) { return s.count > 0; }); // Only show populated stages
  } catch(e) { return []; }
}

function getRevenueMetrics() {
  try {
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);
    var now = new Date();
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      var mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      var mComm = commissions.filter(function(c) {
        var pd = new Date(c.CreatedDate);
        return pd >= d && pd < mEnd;
      });
      var revenue = mComm.reduce(function(sum, c) { return sum + safeNum(c.NetCommission); }, 0);
      months.push({ month: label, revenue: revenue, deals: mComm.length });
    }
    return months;
  } catch(e) { return []; }
}

function getAgentMetrics() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var commissions = getSheetData(SHEET_NAMES.COMMISSIONS);
    var agentMap = {};

    // V10 field: AssignedAgent
    leads.forEach(function(l) {
      var ag = l.AssignedAgent || '';
      if (!ag) return;
      if (!agentMap[ag]) agentMap[ag] = { name: ag, leads: 0, closed: 0, commission: 0, hotLeads: 0 };
      agentMap[ag].leads++;
      if (l.LeadStatus === 'Closed') agentMap[ag].closed++;
      if (l.ScoreCategory === 'Hot') agentMap[ag].hotLeads++;
    });

    commissions.forEach(function(c) {
      if (c.Agent1 && agentMap[c.Agent1]) agentMap[c.Agent1].commission += safeNum(c.Agent1Amount);
      if (c.Agent2 && agentMap[c.Agent2]) agentMap[c.Agent2].commission += safeNum(c.Agent2Amount);
    });

    var list = Object.keys(agentMap).map(function(k) {
      var a = agentMap[k];
      a.conversionRate = a.leads > 0 ? Math.round((a.closed / a.leads) * 100) : 0;
      return a;
    });
    return list.sort(function(a, b) { return b.commission - a.commission; }).slice(0, 10);
  } catch(e) { return []; }
}

function getConversionFunnel() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var stages = [
      { stage: 'Total Leads',            status: null },
      { stage: 'Verified',               status: 'Verified' },
      { stage: 'Requirement Filled',     status: 'Requirement Filled' },
      { stage: 'Shortlisted',            status: 'Shortlisted' },
      { stage: 'Site Visit Scheduled',   status: 'Site Visit Scheduled' },
      { stage: 'Site Visited',           status: 'Site Visited' },
      { stage: 'Negotiating',            status: 'Negotiating' },
      { stage: 'Token Received',         status: 'Token Received' },
      { stage: 'Closed',                 status: 'Closed' }
    ];
    var total = leads.length;
    return stages.map(function(s) {
      var count = s.status
        ? leads.filter(function(l) { return l.LeadStatus === s.status; }).length
        : total;
      return { stage: s.stage, count: count, percent: total > 0 ? Math.round((count / total) * 100) : 0 };
    });
  } catch(e) { return []; }
}

function getInventorySnapshot() {
  try {
    var props = getSheetData(SHEET_NAMES.INVENTORY);
    var byListingType = { Owner: 0, 'Agent-Broker': 0, 'Builder-Developer': 0 };
    var byCategory = {};
    var byTransaction = { Sale: 0, Rent: 0, Lease: 0 };
    var stale = 0;
    var staleDays = getConfig('Stale_Inventory_Days') || 60;
    var staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - staleDays);

    props.filter(function(p) { return p.AvailabilityStatus === 'Available'; })
      .forEach(function(p) {
        var lt = p.ListingType || 'Unknown';
        if (byListingType[lt] !== undefined) byListingType[lt]++;
        var cat = p.Category || 'Unknown';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        var tx = p.TransactionType || 'Unknown';
        if (byTransaction[tx] !== undefined) byTransaction[tx]++;
        if (p.CreatedDate && new Date(p.CreatedDate) < staleCutoff) stale++;
      });

    return { byListingType: byListingType, byCategory: byCategory, byTransaction: byTransaction, stale: stale };
  } catch(e) { return {}; }
}

function getRecentActivities(limit) {
  try {
    limit = limit || 20;
    var rows = getSheetData(SHEET_NAMES.ACTIVITIES);
    rows.sort(function(a, b) { return new Date(b.Date) - new Date(a.Date); });
    return rows.slice(0, limit);
  } catch(e) { return []; }
}

function getTodaysVisits() {
  try {
    var visits = getSheetData(SHEET_NAMES.SITE_VISITS);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return visits.filter(function(v) {
      var d = new Date(v.ScheduledDate);
      return d >= today && d < tomorrow;
    });
  } catch(e) { return []; }
}

function getSiteVisitsByLead(leadId) {
  try {
    var rows = getSheetData(SHEET_NAMES.SITE_VISITS);
    return rows.filter(function(r) { return r.LeadID === leadId; });
  } catch(e) { return []; }
}

function getPendingFollowUps() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var overdueDays = getConfig('Follow_Up_Overdue_Days') || 3;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - overdueDays);
    var activeStatuses = [
      'New', 'Telecalling', 'Interested', 'Verified',
      'Requirement Filled', 'Matched', 'Shortlisted',
      'Shared with Client', 'Site Visit Scheduled', 'Site Visited', 'Negotiating'
    ];
    return leads.filter(function(l) {
      if (activeStatuses.indexOf(l.LeadStatus) === -1) return false;
      var lastAction = new Date(l.LastActionDate || l.DateCreated || new Date());
      return lastAction < cutoff;
    }).map(function(l) {
      return {
        LeadID: l.LeadID,
        FullName: l.FullName,
        PrimaryPhone: l.PrimaryPhone,
        LeadStatus: l.LeadStatus,
        ScoreCategory: l.ScoreCategory,
        AssignedAgent: l.AssignedAgent,
        LastActionDate: l.LastActionDate,
        DaysOverdue: Math.floor((new Date() - new Date(l.LastActionDate || l.DateCreated)) / 86400000)
      };
    }).slice(0, 20);
  } catch(e) { return []; }
}

function getConversionMetrics() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var total = leads.length;
    if (!total) return {};
    var statuses = {};
    leads.forEach(function(l) {
      var s = l.LeadStatus || 'Unknown';
      statuses[s] = (statuses[s] || 0) + 1;
    });
    return { total: total, byStatus: statuses };
  } catch(e) { return {}; }
}

function getLeadSourceBreakdown() {
  try {
    var leads = getSheetData(SHEET_NAMES.LEADS);
    var sourceMap = {};
    leads.forEach(function(l) {
      var src = l.Source || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    return Object.keys(sourceMap).map(function(k) {
      return { source: k, count: sourceMap[k] };
    }).sort(function(a, b) { return b.count - a.count; });
  } catch(e) { return []; }
}
