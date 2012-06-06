var chroot = require("./chroot.js");
var web = require("./web.js");

var server = new web.WWWCommandSource();

function runCommand(cmd, result_handler) {
    console.log("Command from interwebs: " + cmd);
    chroot.run(cmd, result_handler);
}

server.on("command", runCommand);

server.listen(8000);
