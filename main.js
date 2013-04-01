var env = require("./environment.js")
  , web = require("./web.js")
  , events = require("events")
  , util = require('util')
  , server = new web.WWWCommandSource()
  , kue = require('kue')
  , jobs = kue.createQueue()
  , https = require('https')
  , http = require('http')
  , log           = require('./log.js').log

function runCommand(cmd, result_handler) {
  console.log("Command from interwebs: " + cmd)
  env.run(cmd, result_handler)
}

var fake_emitter = new events.EventEmitter()

function fake_task() {
  var nums = [1,1]
  function fib() {
    var next = nums[0] + nums[1]
    fake_emitter.emit('data', nums[0])
    nums[0] = nums[1]
    nums[1] = next
  }
  setInterval(fib, 500)
}

function fake_logger(data) {
  console.log(data)
}
function turn_on() {
  fake_emitter.on("data", fake_logger)
}
function turn_off() {
  fake_emitter.removeListener('data', fake_logger)
}

setTimeout(turn_on, 50)
setTimeout(turn_off, 1500)
setTimeout(turn_on, 2500)
//fake_task()

server.on("command", runCommand)

server.listen(8000)
kue.app.listen(3000)

// Create a test 'chroot' job on the jobs queue
jobs.create('chroot', { title: 'compile nodejs'
                      , src: "https://github.com/antirez/redis/tarball/2.6.0-rc7"
                      , env: 'chroot'
                      , commands: [ "pwd"
                                  , "wget -q -O src.tar.gz https://github.com/antirez/redis/tarball/2.6.0-rc7"
                                  , "file src.tar.gz"
                                  , "tar -xf src.tar.gz"
                                  , "mv antirez-redis-* redis"
                                  , ["make", {cwd: "redis"}]
                                  , ["make test", {cwd: "redis"}]
                                  , "ls"
                                  ]
                      }).save()

function chroot_job(job, done) {
  var task = job.data
    , chroot = new env.Environment(task.env)
    , opts = task.opt || {}
    , commands = task.commands || []
  //   , ready = false
  //   , downloaded = false

  // if (task.src) {
  //   commands.prepend("tar -xf src.tgz")
  //   commands.prepend("wget -o src.tgz " + task.src)
  // }

  function wrap_up(err, stdout, stderr) {
    log("wrap_up(err, stdout, stderr):\nerr: %s\nstdout: %s\nstderr: %s", err, stdout, stderr)
    job.log("err: %s", err)
    job.log("stdout: %s", stdout)
    job.log("stderr: %s", stderr)
    chroot.end()
    if (err)
      done(err)
    else
      done()
  }
  function start_task() {
    log("start_task: %s (%s)", commands, opts)
    chroot.exec_list(commands, opts, wrap_up)
    //chroot.exec(cmd, null, wrap_up)
  }
  function loggit() {
    job.log("ERROR: %s", util.inspect(arguments))
  }
  chroot.on('ready', start_task)
  chroot.on('exit', loggit)
  chroot.on('error', loggit)
}

// Start a Kue runner for 'chroot' jobs on the queue
jobs.process('chroot', chroot_job)


//runCommand("gcc --version", util.inspect)
