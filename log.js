var inspect = require('better-inspect').inspect
  , _ = require('lodash')
  , util = require('util')

function log() {
  var args = _.toArray(arguments)
    , first = true
    , args = _.map(args, function(a) { if (first) { first = false; return a } else { return inspect(a) } })
    , str = util.format.apply(util, args)
  util.log(str)
}

exports.log = log