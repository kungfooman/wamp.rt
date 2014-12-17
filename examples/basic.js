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
app.regrpc("wamp.rt.foo", function(id, args, session) {
	self.sess = session; // save last session of called rpc
	sock = session.wsclient._socket;
	console.log("["+ sock.remoteAddress + ":" + sock.remotePort + "] args=" + args);

	app.resrpc(id, false, [[{"key1": "bar1", "key2": "bar2"}]]); // args
	//app.resrpc(id, false, [[{"key1": "bar1", "key2": "bar2"}],[{"key1": "bar1", "key2": "bar2"}]]); // args + kwargs
	//app.resrpc(id, false, [[2222]]); // id, isError, only args
	//app.resrpc(id, false, [[2222],[3333]]); // id, isError, args + kwargs
	self.bla = "hue";
});

//app.regrpc("wamp.rt.add", function(id, args, session) {
//	sock = session.wsclient._socket;
//	console.log("["+ sock.remoteAddress + ":" + sock.remotePort + "] add " + args[0][0] + " " + args[0][1]);
//	app.resrpc(id, false, [[args[0][0] + args[0][1]]]);
//});

app.session.register("player_join", function(args, uri, session) {
	sock = session.wsclient._socket;
	console.log("["+ sock.remoteAddress + ":" + sock.remotePort + "] " + uri + " " + args[0]);
	console.log("Player connected: " + args[0]);
	return 777;
});

/*
	Call this like:
		function timing(ret) {
			connection.session.call('server_timingtest', [ret]).then(
				function (res) {
					console.log("Result:", res);
				}
			);
		}
		for (i=0; i<10; i++)
			timing(i);
*/

app.session.registerCallback("server_timingtest", function(args, uri, session, returnCallback) {
	setTimeout(function() {
		returnCallback(args[0]);
	}, 1000);
});

app.session.subscribe("server_got_message", function(args, uri, session) {
	app.session.publish("player_message", ["somebody wrote: " + args[0]]);
});

app.session.register("wamp.rt.add", function(args, uri, session) {
	sock = session.wsclient._socket;
	console.log("["+ sock.remoteAddress + ":" + sock.remotePort + "] " + uri + " " + args[0] + " " + args[1]);
	return args[0] + args[1];
});

subs = function() {
	app.session.publish("wamp.rt.subs", [123]);
}

require("repl").start("repl> ");