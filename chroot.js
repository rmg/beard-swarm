var spawn = require('child_process').spawn;

function logger(tag, buf) {
  function emit_log(data) {
    console.log("<" + tag + ">" + data + "</" + tag + ">\n");
    buf.push(data);
  }
  return emit_log;
}

function run(cmd, cb) {
  var outbuf = [], errbuf = [];
  var opts = {
      "cwd": undefined,
      "env": process.env
  };
  // TODO s/bash/chroot/
  var shell = 'bash';
  var args = ['-i'];
  var sub = spawn(shell, args); //, opts);

  function cleanup(exit) {
    cb(exit, outbuf.join(), errbuf.join());
  }
  sub.stdout.on('data', logger('stdout', outbuf));
  sub.stderr.on('data', logger('stderr', errbuf));
  sub.on('exit', cleanup);
  sub.stdin.end(cmd + "\n");
}

exports.run = run;
