var child_process = require('child_process')
  , spawn         = child_process.spawn
  , exec          = child_process.exec
  , tmp           = require('tmp')
  , util          = require('util')
  , path          = require('path')
  , events        = require('events')
  , env           = require('./environment.js')
  , Chroot        = require('./chroot.js').Chroot
  , inspect       = require('better-inspect')
  , log           = require('./log.js').log
  , _             = require('lodash')

function Environment(name) {
  this.env = name
  this.path = null

  // Setup the cicle of life
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
  // should verify path
  this.emit('ready')
}

Environment.prototype.make_temp = function() {
  // rsync env to chroot home
  tmp.dir({template: '/tmp/tmp-XXXXXX'},
          this.then_emit('temp-created'))
}

Environment.prototype.exec_list = function(cmds, opts, next) {
  var todo = 0

  opts = opts || { "cwd":   this.path
                 , "env":   process.env
                 }

  function execNext(err, out, stderr) {
    if (err) {
      this.emit("error", 'OMG THE WORLD IS ON FIRE!!', opts, arguments)
      log("execComplete() < %s", arguments)
    } else if (todo < cmds.length) {
      child_process.exec(cmds[todo], opts, execNext.bind(this))
      todo += 1
    } else {
      if (typeof next === 'string') this.emit(next)
      else process.nextTick(next)
    }
  }
  execNext.call(this)
}

Environment.prototype.mount = function(err) {
  // setup mounts
  var cmds = [ "cp -L /etc/resolv.conf ./etc/"
             , "mount -t proc none ./proc"
             , "mount --rbind /sys ./sys"
             , "mount --rbind /dev ./dev"
             ]
  this.exec_list(cmds, null, 'mounted')
}

Environment.prototype.umount = function(err) {
  var cmds = [ "pwd" //debug
             , "ls -l" //debug
             , "mount" //debug
             , "umount -l ./proc"
             , "umount -l ./sys"
             , "umount -l ./dev"
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
  this.exec_list(cmds, null, check_umount.bind(this))
}

Environment.prototype.end = function() {
  this.sub.once('exit', this.umount.bind(this))
  this.sub.quit()
}

Environment.prototype.sync = function(err, path) {
  this.path = path
  var cmd = util.format('rsync -a --inplace %s/ %s',
                        this.env,
                        this.path)
  if (err) this.emit("error", arguments)
  else child_process.exec(cmd, this.then_emit('synced'))
}

Environment.prototype.chroot = function() {
  var args = []
    , opts = { "cwd": this.path
             , "env": process.env
             }
  this.sub = new Chroot(args, opts)
  this.sub.once('chrooted', this.chrooted.bind(this))
  this.sub.chroot(this.path)
}

Environment.prototype.cleanup = function() {
  // unmounted, now we clean up this mess
  var cmd = util.format('rm -rf %s', this.path)
  child_process.exec(cmd, this.then_emit('clean'))
}

Environment.prototype.run = function(cmd, args, opts) {
  this.sub.run(cmd, args, opts)
  // some sort of monitoring?
}

Environment.prototype.exec = function(cmd, opts, cb) {
  this.sub.exec(cmd, opts, cb)
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






function mkstemp(cb) {
  tmp.dir({ template: '/tmp/tmp-XXXXXX' }, cb)
}

function sync_env(src, dst, cb) {
  function sync_done(err, stdout, stderr) {
    if (err) cb(err, stdout, stderr)
    else cb(err, dst)
  }
  log("rsync %s/ %s", src, dst)
  exec(util.format('rsync -a --inplace %s/ %s', src, dst), sync_done)
}

function make_env(env, cb) {
  mkstemp(function(err, root) {
    if (err) cb(err)
    else sync_env(env, root, cb)
  })
}

function logger(tag, buf) {
  function emit_log(data) {
    log("<%s>%s</%s>", tag, data, tag)
    if (buf) buf.push(data)
  }
  return emit_log
}

function umount(root, cb) {
  var opts = { "cwd":   root
             , "env":   process.env
             , "stdio": "pipe"
             }
  var sub = spawn('sh', ['-i'], opts)
  var cmds = [ "pwd"
             , "ls -l"
             , "mount"
             , "umount -l ./proc"
             , "umount -l ./sys"
             , "umount -l ./dev"
             ]
  sub.on('exit', cb)
  sub.stdout.on('data', logger('umount[stdout]'))
  sub.stderr.on('data', logger('umount[stderr]'))
  for (var i = 0; i < cmds.length; i++) {
    sub.stdin.write(util.format("%s\n", cmds[i]))
  }
  sub.stdin.end()
}

function chroot(root) {
  function setup_exit(exit) {
    log("chroot setup shell exited: %s", exit)
  }
  log("chroot(%s)", root)
  var opts = { cwd:   root
             , env:   process.env
             , stdio: 'pipe'
             }
  var sub = spawn('sh', ['-i'], opts)
  var cmds = [ "cp -L /etc/resolv.conf ./etc/ || exit"
             , "mount -t proc none ./proc || exit"
             , "mount --rbind /sys ./sys || exit"
             , "mount --rbind /dev ./dev || exit"
             ]
  sub.stdout.on('data', logger('chroot(setup)[out]'))
  sub.stderr.on('data', logger('chroot(setup)[err]'))
  for (var i = 0; i < cmds.length; i++) {
    log("sending: %s", cmds[i])
    sub.stdin.write(cmds[i] + "\n")
  }
  sub.stdin.end()
  sub.on('exit', setup_exit)
  return spawn('chroot', ['./'], opts)
}

function chroot_env(env, cb) {
  function env_created(err, root) {
    if (err) cb(err, root)
    else cb(err, chroot(root), root)
  }
  make_env(env, env_created)
}

function run(cmd, cb) {
  var root   = './chroot'
    , outbuf = []
    , errbuf = []

  function make_cleaner(path) {
    function cleanup(exit) {
      log("cleanup(%s)", arguments)
      umount(path, function(er, so, se) {
        log("done unmounting..")
        cb(exit, outbuf.join("\n"), errbuf.join("\n"))
      })
    }
    return cleanup
  }

  function chroot_created(err, sub, path) {
    if (err) log("chroot_created(%s)", arguments)
    else {
      sub.stdout.on('data', logger('stdout', outbuf))
      sub.stderr.on('data', logger('stderr', errbuf))
      sub.on('exit', make_cleaner(path))
      log("Running: %s", cmd)
      sub.stdin.end(cmd + "\n")
    }
  }

  chroot_env(root, chroot_created)
}

//exports.run = run;
