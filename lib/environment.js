var child_process = require('child_process')
  , tmp           = require('tmp')
  , util          = require('util')
  , path          = require('path')
  , events        = require('events')
  , Chroot        = require('./chroot.js')
  , log           = require('./log.js').log
  , fs            = require('fs')
  , _             = require('lodash')
  , f             = util.format

function Environment(name) {
  this.env = name
  this.path = null

  // Setup the circle of life..
  this.once('temp-created', this.sync.bind(this))
  this.once('synced', this.mount.bind(this))
  this.once('mounted', this.chroot.bind(this))
  this.once('chrooted', this.chrooted.bind(this))
  // ..and the death spiral
  this.once('umounted', this.cleanup.bind(this))
  this.once('clean', this.then_emit('exit'))

  // Make it so
  this.make_temp()
}

util.inherits(Environment, events.EventEmitter)

Environment.prototype.then_emit = function(e) {
  function do_emit() {
    var args = _.flatten([e, _.toArray(arguments)], true)
    this.emit.apply(this, args)
  }
  return do_emit.bind(this)
}

Environment.prototype.chrooted = function(path) {
  // TODO: verify path
  log("chrooted: %s", path)
  this.emit('ready')
}

Environment.prototype.make_temp = function() {
  tmp.dir({template: '/tmp/tmp-XXXXXX'},
          this.then_emit('temp-created'))
}

Environment.prototype.base_exec_list = function(host, cmds, list_opts, next) {
  var todo = 0
    , acc_out = ""
    , acc_err = ""

  function execNext(err, out, stderr) {
    var opts = _.clone(list_opts)
      , cmd = cmds[todo]
    if (out) acc_out += out
    if (stderr) acc_err += stderr
    log("execNext(%s) -> %s: %s", err, cmd, opts.cwd)
    if (err) {
      if (!err.message) {
        err.message = stderr
      }
      log("execComplete():\n%s", arguments)
      log("out: %s\nerr: %s", acc_out, acc_err)
      if (typeof next === 'function') next(err, acc_out, acc_err)
      else this.emit("error", 'OMG THE WORLD IS ON FIRE!!', opts, arguments)
    } else if (todo < cmds.length) {
      if (util.isArray(cmd)) {
        opts = _.extend(opts, cmd[1] || {})
        cmd = cmd[0]
      }
      host.exec(cmd, opts, execNext.bind(this))
      todo += 1
    } else {
      if (typeof next === 'string') this.emit(next, acc_out, acc_err)
      else process.nextTick( function() { next(err, acc_out, acc_err) } )
    }
  }
  log("base_exec_list(): %s", list_opts.cwd)
  execNext.call(this)
}

Environment.prototype.host_exec_list = function(cmds, opts, next) {
  opts = opts || { "cwd":   this.path
                 , "env":   process.env
                 }
  if (opts && opts.cwd) log("host_exec_list(): %s", opts.cwd)
  this.base_exec_list(child_process, cmds, opts, next)
}

Environment.prototype.mount = function(err, stdout, stderr) {
  // setup mounts
  var cmds = [ "pwd", "ls"
             , f("cp -L /etc/resolv.conf %s/ro/etc/", this.path)
             , f("mount -o remount,ro %s/ro", this.path)
             , f("mount -t proc none %s/ro/proc", this.path)
             , f("mount -t sysfs sysfs %s/ro/sys", this.path)
             , f("mount --rbind /dev %s/ro/dev", this.path)
             , f("mount -t tmpfs tmpfs %s/ro/tmp", this.path)
             , f("mount -t tmpfs tmpfs %s/ro/root", this.path)
             ]
  if (err) this.emit('error', stdout, stderr)
  else this.host_exec_list(cmds, null, 'mounted')
}

Environment.prototype.umount = function(err) {
  var cmds = [ "pwd" //debug
             , "ls -l" //debug
             , "mount" //debug
             , "umount -l ./ro/proc"
             , "umount -l ./ro/sys"
             , "umount -l ./ro/dev"
             , "umount -l ./ro/tmp"
             , "umount -l ./ro/root"
             , "umount -l ./ro"
             ]
  function umount_result(unmounted, stdout, stderr) {
    if (unmounted) {
      this.emit('umounted')
    } else {
      log("Failed to umount, trying again!")
      process.nextTick(this.umount.bind(this))
    }
  }
  function check_umount() {
    var tmpdir = path.basename(this.path)
      , cmd = util.format("mount | grep '%s'", tmpdir)
    child_process.exec(cmd, umount_result.bind(this))
  }
  this.host_exec_list(cmds, null, check_umount.bind(this))
}

Environment.prototype.end = function() {
  this.sub.once('exit', this.umount.bind(this))
  this.sub.quit()
}

// TODO: Strategy Pattern - make setup pluggable so we can
//       use mount --bind, overlayfs, etc.
Environment.prototype.sync = function(err, path) {
  //var cmd = util.format('rsync -a --inplace %s/ %s',
  //                      this.env,
  //                      path)
  var cmd = util.format('mount --bind %s %s/ro',
                        this.env,
                        path)
  this.path = path
  log("sync(): %s", path)
  if (err) {
    this.emit("error", arguments)
  } else {
    fs.mkdirSync(util.format("%s/ro", path))
    fs.mkdirSync(util.format("%s/rw", path))
    child_process.exec(cmd, null, this.then_emit('synced'))
  }
}

Environment.prototype.chroot = function() {
  var args = []
    , opts = { "cwd": this.path
             , "env": process.env
             }
  log("chroot(): %s (%s)", this.path, opts.cwd)
  this.sub = new Chroot(args, opts)
  this.sub.once('chrooted', this.chrooted.bind(this))
  this.sub.chroot(this.path + "/ro", '/root')
}

Environment.prototype.cleanup = function() {
  // unmounted, now we clean up this mess
  var cmd = util.format('rm -rf %s', this.path)
  log("cleanup(): %s", this.path)
  child_process.exec(cmd, this.then_emit('clean'))
}

Environment.prototype.run = function(cmd, args, opts) {
  this.sub.run(cmd, args, opts)
  // some sort of monitoring?
}

Environment.prototype.exec = function(cmd, opts, cb) {
  log("exec().path: %s, opts: %s", this.path, opts)
  this.sub.exec(cmd, opts, cb)
}

Environment.prototype.exec_list = function(cmds, opts, next) {
  log("exec_list(%s, %s, %s)", cmds, opts, next)
  this.base_exec_list(this.sub, cmds, opts, next)
}

exports.Environment = Environment

exports.run = function chroot_run(cmd, cb) {
  var env = new Environment('chroot')
  function done() {
    env.end()
    cb.apply(this, _.toArray(arguments))
  }
  function run_cmd() {
    env.exec(cmd, null, done)
  }
  env.on('ready', run_cmd)
  env.on('exit', console.log)
  env.on('error', console.log)
}
