var chroot = require("./chroot.js");

chroot.run("ls", function (ecode, out, err) {
    console.log("Ran 'ls', exit code: " + ecode + "\nSTDOUT:\n " + out + "\nSTDERR:\n" + err);
});
