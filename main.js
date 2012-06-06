var chroot = require("./chroot.js");
var web = require("./web.js");
//chroot.run("ls", function (ecode, out, err) {
//    console.log("Ran 'ls', exit code: " + ecode + "\nSTDOUT:\n " + out + "\nSTDERR:\n" + err);
//});

var server = new web.WWWCommandSource();

server.on("command", function (cmd, reply) {
    console.log("Comand from interwebs: " + cmd);
        chroot.run(cmd, reply);
});

//
//function cmdRequestHandler(request, response) {
//    //console.log(request);
//    if (request.method == 'GET') {
//        readFile('assets/cmd.html', function(err, data) {
//            if (err) {
//                response.statusCode = 400;
//                response.end(err);
//            } else {
//                response.end(data);
//            }
//        });
//        response.setHeader('Content-Type', 'text/html');
//        response.statusCode =  200;
//    } else {
//        request.on('data', function(data) {
//            var params = qs.parse(data.toString());
//            //			console.log(data);
//            console.log(params);
//            chroot.run(params.command, function (ecode, out, err) {
//                var body = "Ran '" + params.command + "', exit code: <pre>" + ecode + "</pre>\nSTDOUT:\n<pre>" + out + "</pre>\nSTDERR:\n<pre>" + err + "</pre>";
//                response.setHeader('Content-Type', 'text/html');
//                response.statusCode = ecode ? 400 : 200;
//                response.end(body);
//            });
//        });
//    }
//}
//
//var server = http.createServer(cmdRequestHandler);

server.listen(8000);
