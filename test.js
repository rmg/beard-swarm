var environment = require('./environment.js')
  , log = require('./log.js').log

//  , env = new environment.Environment('chroot')
// env.on('ready', run_cmd)
// env.on('exit', util.inspect)
// env.on('error', util.inspect)

// exports.run = function chroot_run(cmd, cb) {
//   var env = new Environment('chroot')
//   function done() {
//     env.end()
//     cb.apply(this, Array.prototype.slice.apply(arguments))
//   }
//   function run_cmd() {
//     env.exec(cmd, null, done)
//   }
//   env.on('ready', run_cmd)
//   env.on('exit', util.inspect)
//   env.on('error', util.inspect)
// }

function when_done() {
  log("command completed: %s", arguments)
}

environment.run('cat /etc/issue', when_done)
