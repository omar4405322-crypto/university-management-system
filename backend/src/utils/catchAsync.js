/**
 * Wraps async functions to catch errors and pass them to the global error handler
 * @param {Function} fn - Async function to wrap
 */
module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
