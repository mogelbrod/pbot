/** @type {import('mocha').MochaOptions} */
module.exports = {
  checkLeaks: true,
  recursive: true,
  reporter: 'spec',
  timeout: 5e3,
  spec: ['lib/**/*.test.js'],
}
