var posix = require('posix')
  , child_process = require('child_process')
  , log = require('./log.js').log

function message_from_parent(message, socket) {
  if (socket) {
    // someone wants to hear our thoughts!
    // pipe(socket, sub.stdout)
  } else {
    dispatch.apply(null, message)
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

// one-way(ish) pass to jail!
function do_chroot(path) {
  var message = [ 'chrooted'
                , { "path": path
                  }
                ]
  posix.chroot(path)
  process.send(message)
}

function do_chroot(args) {
  var chroot_dir = args[0]
    , chdir      = args[1] || false
    , message = [ 'chrooted'
                , { "path": chroot_dir
                  }
                ]
  posix.chroot(chroot_dir)
  console.log(chroot_dir, chdir)
  if (chdir) {
    process.chdir(chdir)
  }
  process.send(message)
}

// one-off, fire-and-forgets
function do_exec(args) {
  var cmd = args[0]
    , opts = args[1] || {}
  child_process.exec(cmd, opts, makeExecCompleter(cmd))
}

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

// monitored, longer running commands
function do_run(args) {
  var cmd = args[0]
    , cmdargs = args[1] || []
    , opts = args[2] || {}
  sub = child_process.spawn(cmd, cmdargs, opts)
  monitorRun(cmd, sub)
}

function monitorRun(cmd, sub) {
  sub.stdout.on('data', makeRelay(cmd, 'stdout.data'))
  sub.stderr.on('data', makeRelay(cmd, 'stderr.data'))
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

process.on('message', message_from_parent)
