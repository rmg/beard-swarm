var posix = require('posix')
  , util = require('util')
  , child_process = require('child_process')
  , events = require('events')
  , log = require('./log.js').log


function makeExecCompleter(cmd) {
  function execCompleter(exit, stdout, stderr) {
    var message = [ "execComplete"
                  , { "exec": cmd
                    , "exit": exit
                    , "stdout": stdout
                    , "stderr": stderr
                    }
                  ]
    process.send(message)
  }
  return execCompleter
}

// one-way(ish) pass to jail!
function do_chroot(path) {
  var message = [ 'chrooted'
                , { "path": path
                  }
                ]
  posix.chroot(path)
  process.send(message)
}

// one-off, fire-and-forgets
function do_exec(args) {
  var cmd = args[0]
    , opts = args[1] || {}
  child_process.exec(cmd, opts, makeExecCompleter(cmd))
}

function makeRelay(cmd, tag) {
  function relay(args) {
    var message = [ 'data'
                  , { "run": cmd
                    , "tag": tag
                    , "data": arguments
                    }
                  ]
    process.send(message)
  }
}

function monitorRun(cmd, sub) {
  sub.stdout.on('data', makeRelay(cmd, 'stdout.data'))
  sub.stderr.on('data', makeRelay(cmd, 'stderr.data'))
}

// monitored, longer running commands
function do_run(args) {
  var cmd = args[0]
    , cmdargs = args[1] || []
    , opts = args[2] || {}
  sub = child_process.spawn(cmd, cmdargs, opts)
  monitorRun(cmd, sub)
}

function do_chroot(args) {
  var chroot_dir = args[0]
    , chdir      = args[1] || false
  posix.chroot(chroot_dir)
  console.log(chroot_dir, chdir)
  if (chdir) {
    process.chdir(chdir)
  }
}

function dispatch(cmd, args) {
  switch(cmd) {
    case 'chroot': do_chroot(args);  break
    case 'exec':   do_exec(args);    break
    case 'run':    do_run(args);     break
    case 'quit':   process.exit();   break
    default:       log("unkown dispatch: %s, %s", cmd, args)
  }
}

function message_from_parent(message, socket) {
  if (socket) {
    // someone wants to hear our thoughts!
    // pipe(socket, sub.stdout)
  } else {
    dispatch.apply(null, message)
  }
}

function spawn_self(args, opts) {
  var args = args || []
    , opts = args || {}
  return child_process.fork(__filename, args, opts)
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
  this.emit('chrooted', path)
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
    default: util.inspect(event, args, sendHandle)
  }
}

Chroot.prototype.exit = function(code) {
  this.emit('exit', code)
}

if (process.send) {
  util.debug("OMG I'M A CHILD!")
  process.on('message', message_from_parent)
} else {
  exports.Chroot = Chroot
}
