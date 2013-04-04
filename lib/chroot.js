var util = require('util')
  , child_process = require('child_process')
  , events = require('events')
  , log = require('./log.js').log


function spawn_self(args, opts) {
  var args = args || []
    , opts = args || {}
  return child_process.fork('lib/chroot_slave.js', args, opts)
}


function Job(chroot, cmd, args, opts) {
  this.chroot = chroot
  this.cmd = cmd
  this.args = args
  this.opts = opts
  // TODO: make these Streams instead?
  this.stdout = new events.EventEmitter()
  this.stderr = new events.EventEmitter()
}

util.inherits(Job, events.EventEmitter)

Job.prototype.data = function(data) {
  switch(data.tag) {
    case "data.stdout": this.stdout.emit("data", data.data); break
    case "data.stderr": this.stderr.emit("data", data.data); break
    default: this.emit("data", this.data); log("odd job data: %s", data)
  }
}

function Chroot(args, opts) {
  this.jobs = {}
  this.execs = {}
  this.child = spawn_self(args, opts)
  this.child.on('exit', this.exit.bind(this))
  this.child.on('message', this.onMessage.bind(this))
}

util.inherits(Chroot, events.EventEmitter)

Chroot.prototype.register_run = function(name, job) {
  this.jobs[name] = job
}

Chroot.prototype.complete_exec = function(name, cb) {
  cb.apply(this, Array.prototype.slice.apply(arguments))
  delete this.execs[name]
}

Chroot.prototype.register_exec = function(name, cb) {
  this.execs[name] = this.complete_exec(name, cb)
}

Chroot.prototype.run = function(cmd, args, opts) {
  var job = new Job(this, cmd, args, opts)
  this.child.send(['run', [cmd, args, opts]])
  this.jobs[cmd] = job
}

Chroot.prototype.exec = function(cmd, opts, cb) {
  this.execs[cmd] = cb
  this.child.send(['exec', [cmd, opts]])
}

Chroot.prototype.chroot = function(path, chdir) {
  this.child.send(['chroot', [path, chdir]])
}

Chroot.prototype.quit = function() {
  this.child.send(['quit'])
}

Chroot.prototype.dispatch_data = function(args) {
  if (this.jobs[args.run]) this.jobs[args.run].data(args)
  else log("no job %s", args)
}

Chroot.prototype.dispatch_exec = function(args) {
  function cb_with_args(cb) {
    return function() {
      cb(args.exit, args.stdout, args.stderr)
    }
  }
  if (this.execs[args.exec]) {
    process.nextTick(cb_with_args(this.execs[args.exec]))
    this.emit("exec", args)
    delete this.execs[args.exec]
  }
  else log("no exec %s", args)
}

Chroot.prototype.onMessage = function(message, sendHandle) {
  var event = message[0]
    , args = message[1]
  switch(event) {
    case "data": this.dispatch_data(args); break
    case "execComplete": this.dispatch_exec(args); break
    case "chrooted": this.emit('chrooted', args['path']); break
    default: util.inspect(event, args, sendHandle)
  }
}

Chroot.prototype.exit = function(code) {
  this.emit('exit', code)
}

exports.Chroot = Chroot
