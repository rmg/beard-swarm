var child_process = require('child_process')
  , spawn         = child_process.spawn
  , exec          = child_process.exec
  , tmp           = require('tmp')
  , util          = require('util')

function log() {
  var args = Array.prototype.slice.apply(arguments)
    , str = util.format.apply(util, args)
  util.log(str)
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
      util.inspect("cleanup", arguments)
      umount(path, function(er, so, se) {
        log("done unmounting..")
        cb(exit, outbuf.join("\n"), errbuf.join("\n"))
      })
    }
    return cleanup
  }

  function chroot_created(err, sub, path) {
    if (err) util.inspect(err, sub, path)
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

exports.run = run;
