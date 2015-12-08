'use strict';

let SeleniumRunner = require('../lib/core/selenium_runner');

let isWindows = process.platform === 'win32';

let BROWSERS = ['chrome', 'firefox'];
if (isWindows) {
  BROWSERS.push('ie');
}

describe('SeleniumRunner', function() {
  let runner;

  describe('#start', function() {
    it('should reject when passed incorrect configuration', function() {
      runner = new SeleniumRunner({
        'browser': 'invalid'
      });
      return runner.start().should.be.rejected;
    });

    it('should return browser capabilities', function() {
      runner = new SeleniumRunner();
      return runner.start().
      then(function(caps) {
        return caps.serialize();
      }).should.eventually.contain.all.keys('browserName', 'version');
    });

    it.skip('should handle if Chrome crashes', function() {
      runner = new SeleniumRunner({
        'browser': 'chrome',
        'chrome': {
          'args': '--crash-test'
        },
        'verbose': true
      });

      // Wait for session to actually have Chrome start up.
      return runner.start()
        .catch(function(e) {
          throw e;
        })
        .should.be.rejected;
    });
  });

  BROWSERS.forEach(function(browser) {
    describe('#loadAndWait - ' + browser, function() {
      beforeEach(function() {
        runner = new SeleniumRunner({
          'browser': browser,
          'timeouts': {
            'scripts': 5000,
            'pageLoad': 10000,
            'pageCompleteCheck': 10000
          }
        });
        return runner.start();
      });

      it('should be able to load a url', function() {
        return runner.loadAndWait('http://httpbin.org/html').should.be.fulfilled;
      });

      if (browser !== 'chrome') {
        // Chrome doesn't report a failure after load has been aborted by page load timeout.
        // Putting if (chrome) {this.skip()} inside the test doesn't work, the afterEach teardown
        // isn't run. Seems like a mocha bug.

        it('should fail if url takes too long to load', function() {
          return runner.loadAndWait('http://httpbin.org/delay/20', 'return true').should.be.rejected;
        });
      }

      it('should fail if wait script never returns true', function() {
        return runner.loadAndWait('http://httpbin.org/html', 'return false').should.be.rejected;
      });

      it('should fail if wait script throws an exception', function() {
        return runner.loadAndWait('http://httpbin.org/html', 'throw new Error("foo");').should.be.rejected;
      });

      it.skip('should fail if wait script hangs', function() {
        return runner.loadAndWait('http://httpbin.org/html', 'while (true) {}; return true;').should.be.rejected;
      });

      afterEach(function() {
        return runner
          .stop()
          .timeout(10000, 'Waited for ' + browser + ' to quit for too long');
      });
    });

    describe('#runScript - ' + browser, function() {
      beforeEach(function() {
        runner = new SeleniumRunner({
          'browser': browser
        });
        return runner.start()
          .then(function() {
            return runner.loadAndWait('http://httpbin.org/html');
          });
      });

      it('should handle a boolean return', function() {
        return runner.runScript('return true;').should.become.true;
      });

      it('should handle a number return', function() {
        return runner.runScript('return 42;').should.become(42);
      });

      it('should handle an object return', function() {
        return runner.runScript('return window.performance.timing;')
          .should.eventually.contain.all.keys('fetchStart', 'domInteractive');
      });

      it('should handle an array return', function() {
        return runner.runScript('return window.performance.getEntriesByType("resource");')
          .should.eventually.be.an('array');
      });

      it('should fail if script throws an exception', function() {
        return runner.runScript('throw new Error("foo");').should.be.rejected;
      });

      /*
       FIXME: Apparently firefox can consider executeScript to succeed if it forcefully killed a hanging script.
       1) SeleniumRunner #runScript - firefox should fail if script hangs:
       AssertionError: expected promise to be rejected but it was fulfilled with 'A script on this page may be busy, or it may have stopped responding. You can stop the script now, open the script in the debugger, or let the script continue.\n\nScript: http://httpbin.org/html line 69 > Function:1'
       at null.<anonymous> (/Users/tobli/Development/btnext/node_modules/chai-as-promised/lib/chai-as-promised.js:122:55)
       at null.<anonymous> (/Users/tobli/Development/btnext/node_modules/chai-as-promised/lib/chai-as-promised.js:66:33)
       at Object.defineProperty.get (/Users/tobli/Development/btnext/node_modules/chai/lib/chai/utils/addProperty.js:35:29)
       at Context.<anonymous> (/Users/tobli/Development/btnext/test/selenium_runner_tests.js:93:75)
       */

      it.skip('should fail if script hangs', function() {
        return runner.runScript('while (true) {}; return true;').should.be.rejected;
      });

      afterEach(function() {
        return runner
          .stop()
          .timeout(10000, 'Waited for ' + browser + ' to quit for too long');
      });
    });
  });
});
