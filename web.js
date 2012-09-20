var http = require('http');
var util = require('util');
var events = require('events');
var qs = require('querystring');
var readFile = require('fs').readFile;


function WWWCommandSource() {
    events.EventEmitter.call(this);
    var me = this;
    this.server = http.createServer(function (request, response) {
        me.requestHandler(request, response);
    });
    this.on('newListener', function (ev, fn) {
        console.log("New listener for: " + ev);
    });
}

util.inherits(WWWCommandSource, events.EventEmitter);

WWWCommandSource.prototype.listen = function (port) {
    this.server.listen(port);
};

function commandResponseWrapper(command, httpResponse) {
    return function (ecode, out, err) {
        var body = util.format("Ran '%s', exit code: <pre>%s</pre>\n" +
                                "STDOUT:\n<pre>%s</pre>\n" +
                                "STDERR:\n<pre>%s</pre>",
                                command, ecode, out, err);
        httpResponse.setHeader('Content-Type', 'text/html');
        httpResponse.statusCode = ecode ? 400 : 200;
        httpResponse.end(body);
    };
}

WWWCommandSource.prototype.requestHandler = function (request, response) {
    //console.log(request);
    var cmdSource = this;
    console.log(util.format("%s - %s", request.method, request.url));
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
            console.log(" -> ", params);
            //console.dir(cmdSource);
            cmdSource.emit("command",
                        params.command,
                        commandResponseWrapper(params.command, response));
        });
    }
};

exports.WWWCommandSource = WWWCommandSource;
