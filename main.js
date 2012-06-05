var chroot = require("./chroot.js");
var http = require('http');
var readFile = require('fs').readFile;
var qs = require('querystring');

//chroot.run("ls", function (ecode, out, err) {
//    console.log("Ran 'ls', exit code: " + ecode + "\nSTDOUT:\n " + out + "\nSTDERR:\n" + err);
//});

function cmdRequestHandler(request, response) {
    //console.log(request);
    if (request.method == 'GET') {
        readFile('assets/cmd.html', function(err, data) {
            if (err) {
                response.statusCode = 400;
                response.end(err);
            } else {
                response.end(data);
            }
        });
        response.setHeader('Content-Type', 'text/html');
        response.statusCode =  200;
    } else {
        request.on('data', function(data) {
            var params = qs.parse(data.toString());
            //			console.log(data);
            console.log(params);
            chroot.run(params.command, function (ecode, out, err) {
                var body = "Ran '" + params.command + "', exit code: <pre>" + ecode + "</pre>\nSTDOUT:\n<pre>" + out + "</pre>\nSTDERR:\n<pre>" + err + "</pre>";
                response.setHeader('Content-Type', 'text/html');
                response.statusCode = ecode ? 400 : 200;
                response.end(body);
            });
        });
    }
}

var server = http.createServer(cmdRequestHandler);

server.listen(8000);
