// ============================================================
// Validation.gs — Input Data Validation
// Signature Realty CRM V10
// ============================================================

function validateEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function validatePhone(phone) {
  if (!phone) return false;
  var cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 12;
}

function validateBudget(min, max) {
  if (min && max && Number(min) > Number(max)) return false;
  if (min && Number(min) < 0) return false;
  return true;
}

// ---- Lead validation (V10 field names) ----
function validateLeadData(data) {
  var errors = [];
  var name = data.FullName || data.Name || '';
  if (!name || trimStr(name).length < 2)
    errors.push('Full name is required (min 2 chars).');
  var phone = data.PrimaryPhone || data.Mobile || '';
  if (!validatePhone(phone))
    errors.push('Valid 10-digit primary phone is required.');
  if (data.WhatsAppNumber && !validatePhone(data.WhatsAppNumber))
    errors.push('WhatsApp number must be valid.');
  if (data.Email && !validateEmail(data.Email))
    errors.push('Invalid email format.');
  if (!data.Source)
    errors.push('Lead source is required.');
  if (data.BudgetMin && isNaN(Number(data.BudgetMin)))
    errors.push('Budget Min must be a number.');
  if (data.BudgetMax && isNaN(Number(data.BudgetMax)))
    errors.push('Budget Max must be a number.');
  if (!validateBudget(data.BudgetMin, data.BudgetMax))
    errors.push('Budget Min cannot exceed Budget Max.');
  if (data.LeadType && LEAD_TYPES.indexOf(data.LeadType) === -1)
    errors.push('Invalid lead type. Must be: ' + LEAD_TYPES.join(', '));
  if (data.TransactionType && TRANSACTION_TYPES.indexOf(data.TransactionType) === -1)
    errors.push('Invalid transaction type.');
  if (data.Category && PROPERTY_CATEGORIES.indexOf(data.Category) === -1)
    errors.push('Invalid category.');
  return errors;
}

// ---- Property/Inventory validation (V10 field names) ----
function validatePropertyData(data) {
  var errors = [];
  if (!data.FullAddress && !data.Address)
    errors.push('Full address is required.');
  if (!data.ListingType || LISTING_TYPES.indexOf(data.ListingType) === -1)
    errors.push('Valid listing type required: ' + LISTING_TYPES.join(', '));
  if (!data.Category || PROPERTY_CATEGORIES.indexOf(data.Category) === -1)
    errors.push('Valid category required: ' + PROPERTY_CATEGORIES.join(', '));
  if (!data.TransactionType || TRANSACTION_TYPES.indexOf(data.TransactionType) === -1)
    errors.push('Valid transaction type required.');
  if (data.TransactionType !== 'Rent' && data.TransactionType !== 'Lease') {
    if (!data.Price || isNaN(Number(data.Price)) || Number(data.Price) <= 0)
      errors.push('Valid price is required for Sale.');
  }
  if (data.CarpetArea && isNaN(Number(data.CarpetArea)))
    errors.push('Carpet area must be a number.');
  if (data.ListingType === 'Builder-Developer' && !data.LinkedProjectID && !data.RERANumber)
    errors.push('Builder properties require Linked Project ID or RERA number.');
  if (data.OwnerPhone && !validatePhone(data.OwnerPhone))
    errors.push('Owner phone must be valid.');
  if (data.BrokerPhone && !validatePhone(data.BrokerPhone))
    errors.push('Broker phone must be valid.');
  return errors;
}

// ---- Builder Project validation ----
function validateBuilderProjectData(data) {
  var errors = [];
  if (!data.ProjectName || trimStr(data.ProjectName).length < 2)
    errors.push('Project name is required.');
  if (!data.RERANumber)
    errors.push('RERA registration number is required.');
  if (!data.BuilderCompanyName)
    errors.push('Builder company name is required.');
  if (data.SalesOfficePhone && !validatePhone(data.SalesOfficePhone))
    errors.push('Sales office phone must be valid.');
  return errors;
}

// ---- Requirement validation ----
function validateRequirementData(data) {
  var errors = [];
  if (!data.LeadID) errors.push('LeadID is required.');
  if (data.Category && PROPERTY_CATEGORIES.indexOf(data.Category) === -1)
    errors.push('Valid category is required.');
  if (!validateBudget(data.BudgetMin, data.BudgetMax))
    errors.push('Budget Min cannot exceed Budget Max.');
  if (data.BHKMin && data.BHKMax && Number(data.BHKMin) > Number(data.BHKMax))
    errors.push('BHK Min cannot exceed BHK Max.');
  return errors;
}

// ---- Site Visit validation ----
function validateSiteVisitData(data) {
  var errors = [];
  if (!data.LeadID) errors.push('LeadID is required.');
  if (!data.PropertyID) errors.push('PropertyID is required.');
  if (!data.ScheduledDate) errors.push('Scheduled date is required.');
  var d = new Date(data.ScheduledDate);
  if (isNaN(d.getTime())) errors.push('Scheduled date must be a valid date.');
  return errors;
}

// ---- Negotiation validation ----
function validateNegotiationData(data) {
  var errors = [];
  if (!data.LeadID) errors.push('LeadID is required.');
  if (!data.PropertyID) errors.push('PropertyID is required.');
  if (data.InitialOffer && isNaN(Number(data.InitialOffer)))
    errors.push('Initial offer must be a number.');
  return errors;
}

// ---- Token validation ----
function validateTokenData(data) {
  var errors = [];
  if (!data.LeadID) errors.push('LeadID is required.');
  if (!data.PropertyID) errors.push('PropertyID is required.');
  if (!data.Amount || isNaN(Number(data.Amount)) || Number(data.Amount) <= 0)
    errors.push('Valid token amount is required.');
  if (!data.PaymentMethod || PAYMENT_METHODS.indexOf(data.PaymentMethod) === -1)
    errors.push('Valid payment method is required: ' + PAYMENT_METHODS.join(', '));
  return errors;
}

// ---- Commission validation ----
function validateCommissionData(data) {
  var errors = [];
  if (!data.LeadID) errors.push('LeadID is required.');
  if (!data.PropertyID) errors.push('PropertyID is required.');
  if (!data.SalePrice || isNaN(Number(data.SalePrice)) || Number(data.SalePrice) <= 0)
    errors.push('Valid sale price is required.');
  return errors;
}

// ---- User validation ----
function validateUserData(data) {
  var errors = [];
  if (!data.Name || trimStr(data.Name).length < 2)
    errors.push('Name is required (min 2 chars).');
  if (!validateEmail(data.Email))
    errors.push('Valid email is required.');
  if (!data.Role || ROLES.indexOf(data.Role) === -1)
    errors.push('Valid role is required: ' + ROLES.join(', '));
  if (data.Mobile && !validatePhone(data.Mobile))
    errors.push('Valid mobile number required.');
  return errors;
}

// ---- Agent validation ----
function validateAgentData(data) {
  var errors = [];
  if (!data.Name || trimStr(data.Name).length < 2)
    errors.push('Agent name is required.');
  if (!validatePhone(data.Phone))
    errors.push('Valid phone number is required.');
  if (!validateEmail(data.Email))
    errors.push('Valid email is required.');
  return errors;
}

// ---- String sanitization helpers ----
function sanitizeString(str) {
  return String(str || '').trim().replace(/[<>'"]/g, '');
}

function sanitizeNumber(val) {
  var n = Number(val);
  return isNaN(n) ? 0 : n;
}

function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}
