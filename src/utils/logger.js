const info = (msg, meta) => {
  // Production: integrate with Winston, Datadog, etc.
  // For now, just log to console
  console.log(`[INFO] ${msg}`, meta || '');
};

const error = (msg, meta) => {
  console.error(`[ERROR] ${msg}`, meta || '');
};

module.exports = { info, error };
