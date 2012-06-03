var spawn = require('child_process').spawn,
    // TODO s/bash/chroot/
    chroot = spawn('bash', ['-i']);

var my_cmds = ["ls", "cd ~", "ls"];

var log = function(tag) {
	return function (data) {
		console.log(tag + ": " + data);
	};
};

chroot.stdout.on('data', log("stdout"));
chroot.stderr.on('data', log("stderr"));
chroot.on('exit', log('exit'));

for (var c in my_cmds) {
    chroot.stdin.write(my_cmds[c] + "\n");
}
chroot.stdin.end();
