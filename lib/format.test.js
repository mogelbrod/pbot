const { expect } = require("chai")
const f = require("./format")

describe("format", () => {
  describe("wrap()", () => {
    it("should require delimeter to be a string", () => {
      expect(() => f.wrap(undefined)).to.throw(TypeError)
      expect(() => f.wrap(null)).to.throw(TypeError)
      expect(() => f.wrap("")).to.throw(TypeError)
    })

    it("should wrap single characters", () => {
      expect(f.wrap("*", "hello")).to.equal("*hello*")
    })
  })
})
