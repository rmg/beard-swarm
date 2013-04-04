describe("Environment", function() {
  it("runs a basic command", function(done) {
    var environment = require('../lib/environment.js')
    environment.run('cat /etc/issue', done)
  })
})
