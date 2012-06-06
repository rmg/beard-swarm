var http = require('http');
var util = require('util');
var events = require('events');
var qs = require('querystring');
var readFile = require('fs').readFile;
var http = require('http');


function WWWCommandSource() {
    events.EventEmitter.call(this);
    this.server = http.createServer(this.requestHandler);
}

util.inherits(WWWCommandSource, events.EventEmitter);

WWWCommandSource.prototype.listen = function (port) {
    this.server.listen(port);
};

function commandResponseWrapper(command, httpResponse) {
    return function (ecode, out, err) {
        var body = "Ran '" + command + "', exit code: <pre>" + ecode + "</pre>\nSTDOUT:\n<pre>" + out + "</pre>\nSTDERR:\n<pre>" + err + "</pre>";
        httpResponse.setHeader('Content-Type', 'text/html');
        httpResponse.statusCode = ecode ? 400 : 200;
        httpResponse.end(body);
    };
}

WWWCommandSource.prototype.requestHandler = function (request, response) {
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
            this.emit("command",
                        params.command,
                        commandResponseWrapper(params.command, response));
        });
    }
};

exports.WWWCommandSource = WWWCommandSource;
