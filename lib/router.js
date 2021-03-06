// wamp.rt
// Copyright Orange 2014

var WebSocketServer = require('ws').Server;
var Session = require('./session');
var WAMP = require('./protocol');
var tools = require('./util');
var log = require('./log');
var util = require('util');
var eventEmitter = require('events').EventEmitter;

module.exports = Router;


util.inherits(Router, eventEmitter);

function Router(options) {
    var _options = options || {};
    // We need to verify that the subprotocol is wamp.2.json
    var cb = _options.handleProtocols;
    _options.handleProtocols = function (protocols, callback) {
        var i=0;
        var result = false;
        while(i < protocols.length && result === false) {
            result = (protocols[i] == "wamp.2.json");
            i++;
        }
        if (result && typeof cb == 'function') {
            // If a handleProtocol function was provided by the
            // calling script, just filter out the results
            cb([protocols[i-1]], callback);
        } else {
            callback(result, result ? protocols[i-1] : null);
        }
    };
    var _rpcs = {};
    var _pending = {};
    this._sessions = {};
    var _topics = {};
    var _trace = function (msg) {
        log.trace('[ROUTER] ' + msg);
    };
    // Instantiate WebSocketServer
    var _wss = new WebSocketServer(_options);
    // Create a Session object for the lifetime of each
    // WebSocket client object
    _wss.on('connection', function (wsclient) {
        var id = tools.randomId();
        this._sessions[id] = new Session(this, wsclient);
        wsclient.on('close', function() {
			this._sessions[id].cleanup();
			if (typeof _options.sessionOnClose != "undefined")
				_options.sessionOnClose(this._sessions[id]);
			delete this._sessions[id];
        }.bind(this));
    }.bind(this));

    // RPC Management
    this.getrpc = function(uri) {
        return _rpcs[uri];
    };

    this.regrpc = function(uri, rpc) {
        _trace("Registering " + uri);
        _rpcs[uri] = rpc;
        this.emit('RPCRegistered', [uri])
    };

    this.unregrpc = function(uri) {
        _trace("Unregistering " + uri);
        delete _rpcs[uri];
        this.emit('RPCUnregistered', [uri])
    };

    this.callrpc = function(uri, args, callback, session) {
        if (typeof this.getrpc(uri) !== 'undefined') {
            var invId = tools.randomId();
            _pending[invId] = callback;
            this.getrpc(uri).apply(this ,[invId, args, session]);
            return true;
        } else {
            return false;
        }
    };

    this.resrpc = function(invId, err, args) {
        if (typeof _pending[invId] !== 'undefined') {
            _pending[invId].apply(this, [err, args]);
            delete _pending[invId];
        }
    };

    // Topic Management
    this.gettopic = function(topicUri) {
        return _topics[topicUri];
    };

    this.substopic = function(topicUri, subscriptionId, callback) {
        _trace("Registering topic " + topicUri+ " subsc id " + subscriptionId);
        if (typeof _topics[topicUri] === 'undefined') {
            _topics[topicUri] = {};
        }
        _topics[topicUri][subscriptionId] = callback;
    };

    this.unsubstopic = function(topicUri, subscriptionId) {
        _trace("Unregistering topic " + topicUri + " subsc id " + subscriptionId);
        delete _topics[topicUri][subscriptionId];
    };

    this.publish = function(topicUri, publicationId, args, kwargs, session) {
        _trace("Publish " + topicUri + " " + publicationId);
        this.emit('Publish', topicUri, args, kwargs);
        if (typeof _topics[topicUri] !== 'undefined') {
            for(var key in _topics[topicUri]) {
                if(typeof _topics[topicUri][key] !== 'undefined') {
                    _topics[topicUri][key].apply(this, [publicationId, args, kwargs, session]);
                }
            }
            return true;
        } else {
            _trace("Undefined topic ");
            return false;
        }
    };
	
	this.session = {}; // make interaction with router feel like a WAMP client

	this.session.publish = function(uri, args, kwargs) {
		var publicationId = tools.randomId();
		this.publish(uri, publicationId, args, kwargs);
	}.bind(this);
	
	this.session.register = function(uri, callback) {
		this.regrpc(uri, function(id, args, session) {
			this.resrpc(id, false, [[callback(args[0], uri, session)]]);
		}.bind(this));
	}.bind(this);
	
	this.session.registerCallback = function(uri, callback) {
		this.regrpc(uri, function(id, args, session) {
			var returnCallback = function(ret) {
				this.resrpc(id, false, [[ret]]);
			}.bind(this);
			callback(args[0], uri, session, returnCallback);
		}.bind(this));
	}.bind(this);
	
	this.session.subscribe = function(uri, callback) {
		var subscriptionId = tools.randomId();
		this.substopic(uri, subscriptionId, function(publicationId, args, kwargs, session) {
			callback(args, uri, session);
		}.bind(this));
	}.bind(this);
}