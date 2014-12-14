//
// This is a basic router example
//
// This script runs a simple WAMP router on port 9000
// It illustrates:
// - how to filter out incoming connections,
// - how to declare a router-embedded RPC,
// - how to subscribe to router events.
//

WAMPRT_TRACE = true;

Router = require('../lib/wamp.rt');
program = require('commander');


program.option('-p, --port <port>', 'Server IP port', parseInt,9000);


function onRPCRegistered(uri) {
    console.log('onRPCRegistered RPC registered', uri);
}

function onRPCUnregistered(uri) {
    console.log('onRPCUnregistered RPC unregistered', uri);
}

function onPublish(topicUri, args) {
    console.log('onPublish Publish', topicUri, args);
}

//
// WebSocket server
//
app = new Router(
    { port: program.port,
      // The router will select the appropriate protocol,
      // but we can still deny the connection
      // TODO: this should be the other way round, really ...
      handleProtocols: function(protocols,cb) {
          console.log(protocols);
          cb(true,protocols[0]);
          //cb(false);
      }
    }
);

app.on('RPCRegistered', onRPCRegistered);
app.on('RPCUnregistered', onRPCUnregistered);
app.on('Publish', onPublish);

self = this; // to access newly made "globals" in REPL
app.regrpc('wamp.rt.foo', function(id, args, session) {
	self.sess = session; // save last session of called rpc
	sock = session.wsclient._socket;
	console.log("["+ sock.remoteAddress + ":" + sock.remotePort + "] args=" + args);
    app.resrpc(id,["bar", "bar2"], {"key1": "bar1", "key2": "bar2"});
	self.bla = "hue";
});


require("repl").start("repl> ");