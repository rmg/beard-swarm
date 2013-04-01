var fs     = require('fs')
  , assert = require('assert')

describe("Testing environment sanity check", function() {
    it("Has a chroot-able environment in ./chroot", function() {
        assert(fs.existsSync('./chroot'),
               "You need a chroot environment at ./chroot to run tests, try untarring a Gentoo stage3 into ./chroot")
    })
})
