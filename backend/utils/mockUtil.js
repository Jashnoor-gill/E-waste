export function shouldUseMock(req, isDbDataEmpty = false) {
  const qp = (req.query.mock || '').toString();
  const header = (req.headers['x-use-mock'] || '').toString();
  const envMode = (process.env.MOCK_MODE || 'auto').toLowerCase(); // on|off|auto

  // Per-request overrides first
  if (qp === '1' || /^(1|true|on)$/i.test(header)) return true;
  if (qp === '0') return false;

  // Environment mode
  if (envMode === 'on') return true;
  if (envMode === 'off') return false;

  // auto: use mock when db has no data or is unavailable (handled by caller)
  return isDbDataEmpty === true;
}