var spawn = require('child_process').spawn;
    // TODO s/bash/chroot/
// var chroot = spawn('bash', ['-i']);

var log = function(tag, buf) {
	return function (data) {
		console.log("<" + tag + ">" + data + "</" + tag + ">\n");
		buf.push(data);
	};
};

exports.run = function (cmd, cb) {
	var outbuf = [], errbuf = [];
	var sub = spawn('bash', ['-i']);
	sub.stdout.on('data', log('stdout', outbuf));
	sub.stderr.on('data', log('stderr', errbuf));
	sub.on('exit', function (exit) {
			cb(exit, outbuf.join(), errbuf.join());
			});
	sub.stdin.end(cmd + "\n");
};
