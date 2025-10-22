/** @type {import('mocha').MochaOptions} */
module.exports = {
  checkLeaks: true,
  require: 'tsx',
  recursive: true,
  reporter: 'spec',
  timeout: 5e3,
  spec: ['lib/**/*.test.ts'],
}
