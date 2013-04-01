var should = require('should')

describe("Many cogs", function() {
    describe("Environment", function() {
        it("runs a build given correct inputs", function(done) {
            var task = { title: 'compile redis'
                       , src: "https://github.com/antirez/redis/tarball/2.6.12"
                       , env: 'chroot'
                       , commands:
                           [ "pwd"
                           , "echo foobar > src.tar.gz"
                           , "file src.tar.gz"
                           , "ls"
                       ]
                }
                , env  = require("../environment.js")
                , chroot = new env.Environment(task.env)
                , opts = task.opt || {}
                , commands = task.commands || []
            chroot.on('ready', function() {
                chroot.exec_list(commands, opts, function(err, stdout, stderr) {
                    should.not.exist(err)
                    chroot.end()
                })
            })
            chroot.on('exit', done)
            chroot.on('error', console.log)
        })
    })
})
