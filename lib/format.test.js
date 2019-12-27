const { expect } = require('chai')
const f = require('./format')

describe('format', () => {
  describe('wrap()', () => {
    it('should require delimeter to be a string', () => {
      expect(() => f.wrap(undefined, 'a')).to.throw(TypeError)
      expect(() => f.wrap(null, 'b')).to.throw(TypeError)
    })

    it('should allow empty string delimeters', () => {
      expect(f.wrap('', 'hello')).to.equal('hello')
    })

    it('should wrap single characters', () => {
      expect(f.wrap('*', 'hello'))
        .to.equal('*hello*')
    })

    it('should escape delimeters within the string', () => {
      expect(f.wrap('*', 'he*llo'))
        .to.equal('*he\\*llo*')
    })

    it('should handle multiple arguments', () => {
      expect(f.wrap('`', 'abra', 'kad``abra', 'allakhazam'))
        .to.equal('`abra kad\\`\\`abra allakhazam`')
    })
  })
})
