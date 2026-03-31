const LogLevels = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

const logError = (error, context = {}) => {
  console.error(`[${LogLevels.ERROR}]`, {
    message: error?.message || String(error),
    stack: error?.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

const logWarning = (message, context = {}) => {
  console.warn(`[${LogLevels.WARNING}]`, {
    message,
    ...context,
    timestamp: new Date().toISOString()
  });
};

const logInfo = (message, context = {}) => {
  console.log(`[${LogLevels.INFO}]`, {
    message,
    ...context,
    timestamp: new Date().toISOString()
  });
};

export { logError, logWarning, logInfo };