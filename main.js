var chroot = require("./chroot.js");
var web = require("./web.js");
var events = require("events");

var server = new web.WWWCommandSource();

function runCommand(cmd, result_handler) {
  console.log("Command from interwebs: " + cmd);
  chroot.run(cmd, result_handler);
}

var fake_emitter = new events.EventEmitter();

function fake_task() {
  var nums = [1,1];
  function fib() {
    var next = nums[0] + nums[1];
    fake_emitter.emit('data', nums[0]);
    nums[0] = nums[1];
    nums[1] = next;
  }
  setInterval(fib, 500);
}

function fake_logger(data) {
  console.log(data);
}
function turn_on() {
  fake_emitter.on("data", fake_logger);
}
function turn_off() {
  fake_emitter.removeListener('data', fake_logger);
}

setTimeout(turn_on, 50);
setTimeout(turn_off, 1500);
setTimeout(turn_on, 2500);
fake_task();

server.on("command", runCommand);

server.listen(8000);
