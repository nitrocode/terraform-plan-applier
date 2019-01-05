// for pretty stuff
const colors = require('colors');

/**
 * Creates a basic logger with color and verbose only functionality
 *
 * @param {boolean} verbose allow printing from info function
 */
function createLogger(verbose) {
  return {
    msg: (msg) => {
      console.info(colors.green(msg));
    },
    info: (msg) => {
      // only print if verbose is enabled
      if (verbose) {
        console.info(msg);
      }
    },
    error: (msg) => {
      console.error(colors.red(msg));
    },
  };
}

module.exports = createLogger;