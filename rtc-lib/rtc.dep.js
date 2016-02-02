(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.rtc = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   3.0.2
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$toString = {}.toString;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // see https://github.com/cujojs/when/issues/410 for details
      return function() {
        process.nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertx() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFulfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable) {
      if (maybeThenable.constructor === promise.constructor) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        var then = lib$es6$promise$$internal$$getThen(maybeThenable);

        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value);
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      var enumerator = this;

      enumerator._instanceConstructor = Constructor;
      enumerator.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (enumerator._validateInput(input)) {
        enumerator._input     = input;
        enumerator.length     = input.length;
        enumerator._remaining = input.length;

        enumerator._init();

        if (enumerator.length === 0) {
          lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
        } else {
          enumerator.length = enumerator.length || 0;
          enumerator._enumerate();
          if (enumerator._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(enumerator.promise, enumerator._validationError());
      }
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return lib$es6$promise$utils$$isArray(input);
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var enumerator = this;

      var length  = enumerator.length;
      var promise = enumerator.promise;
      var input   = enumerator._input;

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        enumerator._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var enumerator = this;
      var c = enumerator._instanceConstructor;

      if (lib$es6$promise$utils$$isMaybeThenable(entry)) {
        if (entry.constructor === c && entry._state !== lib$es6$promise$$internal$$PENDING) {
          entry._onerror = null;
          enumerator._settledAt(entry._state, i, entry._result);
        } else {
          enumerator._willSettleAt(c.resolve(entry), i);
        }
      } else {
        enumerator._remaining--;
        enumerator._result[i] = entry;
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var enumerator = this;
      var promise = enumerator.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        enumerator._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          enumerator._result[i] = value;
        }
      }

      if (enumerator._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, enumerator._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!lib$es6$promise$utils$$isArray(entries)) {
        lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        lib$es6$promise$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        lib$es6$promise$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;

    var lib$es6$promise$promise$$counter = 0;

    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this._id = lib$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        if (!lib$es6$promise$utils$$isFunction(resolver)) {
          lib$es6$promise$promise$$needsResolver();
        }

        if (!(this instanceof lib$es6$promise$promise$$Promise)) {
          lib$es6$promise$promise$$needsNew();
        }

        lib$es6$promise$$internal$$initializePromise(this, resolver);
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: function(onFulfillment, onRejection) {
        var parent = this;
        var state = parent._state;

        if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
          return this;
        }

        var child = new this.constructor(lib$es6$promise$$internal$$noop);
        var result = parent._result;

        if (state) {
          var callback = arguments[state - 1];
          lib$es6$promise$asap$$asap(function(){
            lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
          });
        } else {
          lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
        }

        return child;
      },

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":2}],4:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],5:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2

/**
 * Core functionality
 * @module rtc
 * @main rtc
 */


/**
 * Signaling and signaling channels
 * @module rtc.signaling
 * @main rtc.signaling
 */


/**
 * Internal helpers
 * @module rtc.internal
 * @main rtc.internal
 */

(function() {
  var bindHelper, compat;

  bindHelper = function(obj, fun) {
    if (fun == null) {
      return;
    }
    return fun.bind(obj);
  };

  exports.compat = compat = {
    PeerConnection: window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection,
    IceCandidate: window.RTCIceCandidate || window.mozRTCIceCandidate,
    SessionDescription: window.mozRTCSessionDescription || window.RTCSessionDescription,
    MediaStream: window.MediaStream || window.mozMediaStream || window.webkitMediaStream,
    getUserMedia: bindHelper(navigator, navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia),
    supported: function() {
      return (compat.PeerConnection != null) && (compat.IceCandidate != null) && (compat.SessionDescription != null) && (compat.getUserMedia != null);
    }
  };

}).call(this);

},{}],6:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter, Promise, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  ref = require('./internal/promise'), Deferred = ref.Deferred, Promise = ref.Promise;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc
   */


  /**
   * A wrapper for RTCDataChannel. Used to transfer custom data between peers.
   * @class rtc.DataChannel
  #
   * @constructor
   * @param {RTCDataChannel} channel The wrapped native data channel
   * @param {Number} [max_buffer] The size of the send buffer after which we will delay sending
   */

  exports.DataChannel = (function(superClass) {
    extend(DataChannel, superClass);


    /**
     * A new messages was received. Triggers only after `connect()` was called
     * @event message
     * @param {ArrayBuffer} data The data received
     */


    /**
     * The channel was closed
     * @event closed
     */

    function DataChannel(channel, max_buffer) {
      this.channel = channel;
      this.max_buffer = max_buffer != null ? max_buffer : 1024 * 10;
      this._connected = false;
      this._connect_queue = [];
      this._send_buffer = [];
      this.channel.binaryType = 'arraybuffer';
      this.channel.onmessage = (function(_this) {
        return function(event) {
          if (!_this._connected) {
            return _this._connect_queue.push(event.data);
          } else {
            return _this.emit('message', event.data);
          }
        };
      })(this);
      this.channel.onclose = (function(_this) {
        return function() {
          return _this.emit('closed');
        };
      })(this);
      this.channel.onerror = (function(_this) {
        return function(err) {
          return _this.emit('error', err);
        };
      })(this);
    }


    /**
     * Connect to the DataChannel. You will receive messages and will be able to send after calling this.
     * @method connect
     * @return {Promise} Promise which resolves as soon as the DataChannel is open
     */

    DataChannel.prototype.connect = function() {
      var data, i, len, ref1;
      this._connected = true;
      ref1 = this._connect_queue;
      for (i = 0, len = ref1.length; i < len; i++) {
        data = ref1[i];
        this.emit('message', data);
      }
      delete this._connect_queue;
      return Promise.resolve();
    };

    DataChannel.prototype.close = function() {
      this.channel.close();
      return Promise.resolve();
    };


    /**
     * The label of the DataChannel used to distinguish multiple channels
     * @method label
     * @return {String} The label
     */

    DataChannel.prototype.label = function() {
      return this.channel.label;
    };


    /**
     * Send data to the peer through the DataChannel
     * @method send
     * @param data The data to be transferred
     * @return {Promise} Promise which will be resolved when the data was passed to the native data channel
     */

    DataChannel.prototype.send = function(data) {
      var defer;
      if (!this._connected) {
        this.connect();
        console.log("Sending without being connected. Please call connect() on the data channel to start using it.");
      }
      defer = new Deferred();
      this._send_buffer.push([data, defer]);
      if (this._send_buffer.length === 1) {
        this._actualSend();
      }
      return defer.promise;
    };


    /**
     * Method which actually sends the data. Implements buffering
     * @method _actualSend
     * @private
     */

    DataChannel.prototype._actualSend = function() {
      var data, defer, ref1, ref2, results;
      if (this.channel.readyState === 'open') {
        while (this._send_buffer.length) {
          if (this.channel.bufferedAmount >= this.max_buffer) {
            setTimeout(this._actualSend.bind(this), 1);
            return;
          }
          ref1 = this._send_buffer[0], data = ref1[0], defer = ref1[1];
          try {
            this.channel.send(data);
          } catch (_error) {
            setTimeout(this._actualSend.bind(this), 1);
            return;
          }
          defer.resolve();
          this._send_buffer.shift();
        }
      } else {
        results = [];
        while (this._send_buffer.length) {
          ref2 = this._send_buffer.shift(), data = ref2[0], defer = ref2[1];
          results.push(defer.reject(new Error("DataChannel closed")));
        }
        return results;
      }
    };

    return DataChannel;

  })(EventEmitter);

}).call(this);

},{"./internal/promise":8,"events":1}],7:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter, Promise, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  ref = require('./promise'), Deferred = ref.Deferred, Promise = ref.Promise;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.internal
   */


  /**
   * Helper which handles DataChannel negotiation for RemotePeer
   * @class rtc.internal.ChannelCollection
   */

  exports.ChannelCollection = (function(superClass) {
    extend(ChannelCollection, superClass);


    /**
     * A new data channel is available
     * @event data_channel_added
     * @param {String} name Name of the channel
     * @param {Promise -> rtc.Stream} stream Promise of the channel
     */

    function ChannelCollection() {
      this.channels = {};
      this.defers = {};
      this.pending = {};
      this.wait_d = new Deferred();
      this.wait_p = this.wait_d.promise;
    }


    /**
     * Set the local channel description.
     * @method setLocal
     * @param {Object} data Object describing each offered DataChannel
     */

    ChannelCollection.prototype.setLocal = function(data) {
      this.local = data;
      if (this.remote != null) {
        return this._update();
      }
    };


    /**
     * Set the remote channel description.
     * @method setRemote
     * @param {Object} data Object describing each offered DataChannel
     */

    ChannelCollection.prototype.setRemote = function(data) {
      this.remote = data;
      if (this.local != null) {
        return this._update();
      }
    };


    /**
     * Matches remote and local descriptions and creates promises common DataChannels
     * @method _update
     * @private
     */

    ChannelCollection.prototype._update = function() {
      var channel, config, defer, name, ref1;
      ref1 = this.remote;
      for (name in ref1) {
        config = ref1[name];
        if (this.local[name] != null) {
          if (this.channels[name] != null) {

          } else if (this.pending[name] != null) {
            channel = this.pending[name];
            delete this.pending[name];
            this.channels[name] = Promise.resolve(channel);
            this.emit('data_channel_added', name, this.channels[name]);
          } else {
            defer = new Deferred();
            this.channels[name] = defer.promise;
            this.defers[name] = defer;
            this.emit('data_channel_added', name, this.channels[name]);
          }
        } else {
          console.log("DataChannel offered by remote but not by local");
        }
      }
      for (name in this.local) {
        if (this.remote[name] == null) {
          console.log("DataChannel offered by local but not by remote");
        }
      }
      return this.wait_d.resolve();
    };


    /**
     * Resolves promises waiting for the given DataChannel
     * @method resolve
     * @param {DataChannel} channel The new channel
     */

    ChannelCollection.prototype.resolve = function(channel) {
      var label;
      label = channel.label();
      if (this.defers[label] != null) {
        this.defers[label].resolve(channel);
        return delete this.defers[label];
      } else {
        return this.pending[label] = channel;
      }
    };


    /**
     * Get a promise to a DataChannel. Will resolve if DataChannel was offered and gets initiated. Might reject after remote and local description are processed.
     * @method get
     * @param {String} name The label of the channel to get
     * @return {Promise -> DataChannel} Promise for the DataChannel
     */

    ChannelCollection.prototype.get = function(name) {
      return this.wait_p.then((function(_this) {
        return function() {
          if (_this.channels[name] != null) {
            return _this.channels[name];
          } else {
            throw new Error("DataChannel not negotiated");
          }
        };
      })(this));
    };

    return ChannelCollection;

  })(EventEmitter);

}).call(this);

},{"./promise":8,"events":1}],8:[function(require,module,exports){
(function (global){
// Generated by CoffeeScript 1.9.2

/**
 * @module rtc.internal
 */


/**
 * Alias for native promises or a polyfill if not supported
 * @class rtc.internal.Promise
 */

(function() {
  exports.Promise = global.Promise || require('es6-promise').Promise;


  /**
   * Helper to implement deferred execution with promises
   * @class rtc.internal.Deferred
   */


  /**
   * Resolves the promise
   * @method resolve
   * @param [data] The payload to which the promise will resolve
  #
   * @example
   *     var defer = new Deferred()
   *     defer.resolve(42);
   *     defer.promise.then(function(res) {
   *       console.log(res);   // 42
   *     }
   */


  /**
   * Reject the promise
   * @method reject
   * @param {Error} error The payload to which the promise will resolve
  #
   * @example
   *     var defer = new Deferred()
   *     defer.reject(new Error("Reject because we can!"));
   *     defer.promise.then(function(data) {
   *       // wont happen
   *     }).catch(function(err) {
   *       // will happen
   *     }
   */


  /**
   * The promise which will get resolved or rejected by this deferred
   * @property {Promise} promise
   */

  exports.Deferred = (function() {
    function Deferred() {
      this.promise = new exports.Promise((function(_this) {
        return function(resolve, reject) {
          _this.resolve = resolve;
          return _this.reject = reject;
        };
      })(this));
    }

    return Deferred;

  })();


  /**
   * Adds a timeout to a promise. The promise will be rejected if timeout is
   * reached. It will act like the underlying promise if it is resolved or
   * rejected before the timeout is reached.
   * @param {Promse} promise The underlying promise
   * @param {number} time Timeout in ms
   * @return {Promise} Promise acting like the underlying promise or timeout
   */

  exports.timeout = function(promise, time) {
    return new Promise(function(resolve, reject) {
      promise.then(resolve, reject);
      return setTimeout(function() {
        return reject(new Error('Operation timed out'));
      }, time);
    });
  };

}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"es6-promise":3}],9:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('./promise').Deferred;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.internal
   */


  /**
   * Helper handling the mapping of streams for RemotePeer
   * @class rtc.internal.StreamCollection
  #
   * @constructor
   */

  exports.StreamCollection = (function(superClass) {
    extend(StreamCollection, superClass);


    /**
     * A new stream was added to the collection
     * @event steam_added
     * @param {String} name The user defined name of the stream
     * @param {Promise -> rtc.Stream} stream Promise to the stream
     */

    function StreamCollection() {

      /**
       * Contains the promises which will resolve to the streams
       * @property {Object} streams
       */
      this.streams = {};
      this._defers = {};
      this._waiting = {};
      this._pending = {};
      this.wait_d = new Deferred();
      this.wait_p = this.wait_d.promise;
    }


    /**
     * Set stream description and generate promises
     * @method update
     * @param data {Object} An object mapping the stream ids to stream names
     */

    StreamCollection.prototype.update = function(data) {
      var defer, i, id, len, members, name, ref, stream, stream_p;
      members = [];
      this._waiting = {};
      ref = this.streams;
      for (stream_p = i = 0, len = ref.length; i < len; stream_p = ++i) {
        name = ref[stream_p];
        if (data[name] == null) {
          delete this.streams[name];
          this.emit('stream_removed', name);
          if (stream_p.isFullfilled()) {
            stream_p.then(function(stream) {
              return stream.close();
            });
          } else if (stream_p.isPending()) {
            stream_p.reject(new Error("Stream removed before being established"));
          }
        }
      }
      for (name in data) {
        id = data[name];
        if (this.streams[name] == null) {
          defer = new Deferred();
          this.streams[name] = defer.promise;
          this._defers[name] = defer;
          this.emit('stream_added', name, defer.promise);
        }
        if (this._defers[name] != null) {
          if (this._pending[id] != null) {
            stream = this._pending[id];
            delete this._pending[id];
            this._defers[name].resolve(stream);
            delete this._defers[name];
          } else {
            this._waiting[id] = name;
          }
        }
      }
      return this.wait_d.resolve();
    };


    /**
     * Add stream to the collection and resolve promises waiting for it
     * @method resolve
     * @param {rtc.Stream} stream
     */

    StreamCollection.prototype.resolve = function(stream) {
      var id, name;
      id = stream.id();
      if (id === 'default') {
        if (Object.keys(this.streams).length === 1 && Object.keys(this._waiting).length === 1) {
          console.log("Working around incompatibility between Firefox and Chrome concerning stream identification");
          id = Object.keys(this._waiting)[0];
        } else {
          console.log("Unable to work around incompatibility between Firefox and Chrome concerning stream identification");
        }
      }
      if (this._waiting[id] != null) {
        name = this._waiting[id];
        delete this._waiting[id];
        this._defers[name].resolve(stream);
        return delete this._defers[name];
      } else {
        return this._pending[id] = stream;
      }
    };


    /**
     * Gets a promise for a stream with the given name. Might be rejected after `update()`
    #
     * @method get
     * @param {String} name
     * @return {Promise} The promise for the `rtc.Stream`
     */

    StreamCollection.prototype.get = function(name) {
      return this.wait_p.then((function(_this) {
        return function() {
          if (_this.streams[name] != null) {
            return _this.streams[name];
          } else {
            throw new Error("Stream not offered");
          }
        };
      })(this));
    };

    return StreamCollection;

  })(EventEmitter);

}).call(this);

},{"./promise":8,"events":1}],10:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var exports, extend;

  extend = function(root, obj) {
    var key, value;
    for (key in obj) {
      value = obj[key];
      root[key] = value;
    }
    return exports;
  };

  module.exports = exports = {
    internal: {},
    signaling: {}
  };

  extend(exports, require('./peer'));

  extend(exports, require('./remote_peer'));

  extend(exports, require('./local_peer'));

  extend(exports, require('./peer_connection'));

  extend(exports, require('./stream'));

  extend(exports, require('./compat'));

  extend(exports, require('./room'));

  extend(exports, require('./video_element'));

  extend(exports.internal, require('./internal/stream_collection'));

  extend(exports.internal, require('./internal/channel_collection'));

  extend(exports.internal, require('./internal/promise'));

  extend(exports.signaling, require('./signaling/web_socket_channel'));

  extend(exports.signaling, require('./signaling/palava_signaling'));

  extend(exports.signaling, require('./signaling/calling_signaling'));

  extend(exports.signaling, require('./signaling/muc_signaling'));

}).call(this);

},{"./compat":5,"./internal/channel_collection":7,"./internal/promise":8,"./internal/stream_collection":9,"./local_peer":11,"./peer":12,"./peer_connection":13,"./remote_peer":14,"./room":15,"./signaling/calling_signaling":16,"./signaling/muc_signaling":17,"./signaling/palava_signaling":18,"./signaling/web_socket_channel":20,"./stream":21,"./video_element":22}],11:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Peer, Stream,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Peer = require('./peer').Peer;

  Stream = require('./stream').Stream;


  /**
   * @module rtc
   */


  /**
   * Represents the local user of the room
   * @class rtc.LocalPeer
   * @extends rtc.Peer
  #
   * @constructor
   */

  exports.LocalPeer = (function(superClass) {
    extend(LocalPeer, superClass);

    function LocalPeer() {

      /**
       * Contains promises of the local streams offered to all remote peers
       * @property streams
       * @type Object
       */
      this.streams = {};

      /**
       * Contains all DataChannel configurations negotiated with all remote peers
       * @property channels
       * @type Object
       */
      this.channels = {};
      this._status = {};
    }


    /**
     * Get an item of the status transferred to all remote peers
     * @method status
     * @param {String} key The key of the value. Will return
     * @return The value associated with the key
     */


    /**
     * Set an item of the status transferred to all remote peers
     * @method status
     * @param {String} key The key of the value. Will return
     * @param value The value to store
     */

    LocalPeer.prototype.status = function(key, value) {
      if (value != null) {
        this._status[key] = value;
        this.emit('status_changed', this._status);
      } else {
        return this._status[key];
      }
    };


    /**
     * Add data channel which will be negotiated with all remote peers
     * @method addDataChannel
     * @param {String} [name='data'] Name of the data channel
     * @param {Object} [desc={ordered: true}] Options passed to `RTCDataChannel.createDataChannel()`
     */

    LocalPeer.prototype.addDataChannel = function(name, desc) {
      if (typeof name !== 'string') {
        desc = name;
        name = this.DEFAULT_CHANNEL;
      }
      if (desc == null) {
        desc = {
          ordered: true
        };
      }
      this.channels[name] = desc;
      this.emit('configuration_changed');
    };


    /**
     * Add local stream to be sent to all remote peers
     * @method addStream
     * @param {String} [name='stream'] Name of the stream
     * @param {Promise -> rtc.Stream | rtc.Stream | Object} stream The stream, a promise to the stream or the configuration to create a stream with `rtc.Stream.createStream()`
     * @return {Promise -> rtc.Stream} Promise of the stream which was added
     */

    LocalPeer.prototype.addStream = function(name, obj) {
      var saveStream, stream_p;
      saveStream = (function(_this) {
        return function(stream_p) {
          _this.streams[name] = stream_p;
          _this.emit('configuration_changed');
          return stream_p;
        };
      })(this);
      if (typeof name !== 'string') {
        obj = name;
        name = this.DEFAULT_STREAM;
      }
      if ((obj != null ? obj.then : void 0) != null) {
        return saveStream(obj);
      } else if (obj instanceof Stream) {
        return saveStream(Promise.resolve(obj));
      } else {
        stream_p = Stream.createStream(obj);
        return saveStream(stream_p);
      }
    };


    /**
     * Get local stream
     * @method stream
     * @param {String} [name='stream'] Name of the stream
     * @return {Promise -> rtc.Stream} Promise of the stream
     */

    LocalPeer.prototype.stream = function(name) {
      if (name == null) {
        name = this.DEFAULT_STREAM;
      }
      return this.streams[name];
    };


    /**
     * Checks whether the peer is the local peer. Returns always `true` on this
     * class.
     * @method isLocal
     * @return {Boolean} Returns `true`
     */

    LocalPeer.prototype.isLocal = function() {
      return true;
    };

    return LocalPeer;

  })(Peer);

}).call(this);

},{"./peer":12,"./stream":21}],12:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc
   */


  /**
   * A user in the room
   * @class rtc.Peer
   */

  exports.Peer = (function(superClass) {
    extend(Peer, superClass);

    function Peer() {
      return Peer.__super__.constructor.apply(this, arguments);
    }


    /**
     * The status of the peer has changed
     * @event status_changed
     * @param {Object} status The new status object
     */

    Peer.prototype.DEFAULT_CHANNEL = 'data';

    Peer.prototype.DEFAULT_STREAM = 'stream';


    /**
     * Get a value of the status object
     * @method status
     * @param {String} key The key 
     * @return The value
     */

    Peer.prototype.status = function(key) {
      throw new Error("Not implemented");
    };

    return Peer;

  })(EventEmitter);

}).call(this);

},{"events":1}],13:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var DataChannel, Deferred, EventEmitter, Promise, Stream, compat, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  ref = require('./internal/promise'), Deferred = ref.Deferred, Promise = ref.Promise;

  EventEmitter = require('events').EventEmitter;

  Stream = require('./stream').Stream;

  DataChannel = require('./data_channel').DataChannel;

  compat = require('./compat').compat;


  /**
   * @module rtc
   */


  /**
   * Wrapper around native RTCPeerConnection
  #
   * Provides events for new streams and data channels. Signaling information has
   * to be forwarded from events emitted by this object to the remote
   * PeerConnection.
  #
   * @class rtc.PeerConnection
   * @extends events.EventEmitter
  #
   * @constructor
   * @param {Boolean} offering True if the local peer should initiate the connection
   * @param {Object} options Options object passed on from `Room`
   */

  exports.PeerConnection = (function(superClass) {
    extend(PeerConnection, superClass);


    /**
     * New local ICE candidate which should be signaled to remote peer
     * @event ice_candiate
     * @param {Object} candidate The ice candidate
     */


    /**
     * New remote stream was added to the PeerConnection
     * @event stream_added
     * @param {rtc.Stream} stream The stream
     */


    /**
     * New DataChannel to the remote peer is ready to be used
     * @event data_channel_ready
     * @param {rtc.DataChannel} channel The data channel
     */


    /**
     * New offer or answer which should be signaled to the remote peer
     * @event signaling
     * @param {Object} obj The signaling message
     */


    /**
     * The PeerConnection was closed
     * @event closed
     */

    function PeerConnection(offering, options1) {
      var ice_servers;
      this.offering = offering;
      this.options = options1;
      ice_servers = [];
      this.no_gc_bugfix = [];
      if (this.options.stun != null) {
        ice_servers.push({
          url: this.options.stun
        });
      }
      if (this.options.turn != null) {
        ice_servers.push(this.options.turn);
      }
      this.pc = new compat.PeerConnection({
        iceServers: ice_servers
      });
      this.connect_d = new Deferred();
      this.connected = false;
      this.connect_d.promise["catch"](function() {});
      this.signaling_pending = [];
      this.pc.onicecandidate = (function(_this) {
        return function(event) {
          return _this.emit('ice_candidate', event.candidate);
        };
      })(this);
      this.pc.onaddstream = (function(_this) {
        return function(event) {
          return _this.emit('stream_added', new Stream(event.stream));
        };
      })(this);
      this.pc.ondatachannel = (function(_this) {
        return function(event) {
          return _this.emit('data_channel_ready', new DataChannel(event.channel));
        };
      })(this);
      this.pc.onremovestream = function(event) {};
      this.pc.onnegotiationneeded = (function(_this) {
        return function(event) {
          return console.log('onnegotiationneeded called');
        };
      })(this);
      this.pc.oniceconnectionstatechange = (function(_this) {
        return function() {
          var ref1;
          if (_this.pc.iceConnectionState === 'failed') {
            return _this._connectError(new Error("Unable to establish ICE connection"));
          } else if (_this.pc.iceConnectionState === 'closed') {
            return _this.connect_d.reject(new Error('Connection was closed'));
          } else if ((ref1 = _this.pc.iceConnectionState) === 'connected' || ref1 === 'completed') {
            return _this.connect_d.resolve();
          }
        };
      })(this);
      this.pc.onsignalingstatechange = function(event) {};
    }


    /**
     * Add new signaling information received from remote peer
     * @method signaling
     * @param {Object} data The signaling information
     */

    PeerConnection.prototype.signaling = function(data) {
      var sdp;
      sdp = new compat.SessionDescription(data);
      return this._setRemoteDescription(sdp).then((function(_this) {
        return function() {
          if (data.type === 'offer' && _this.connected) {
            return _this._answer();
          }
        };
      })(this))["catch"]((function(_this) {
        return function(err) {
          return _this._connectError(err);
        };
      })(this));
    };


    /**
     * Add a remote ICE candidate
     * @method addIceCandidate
     * @param {Object} desc The candidate
     */

    PeerConnection.prototype.addIceCandidate = function(desc) {
      var candidate;
      if ((desc != null ? desc.candidate : void 0) != null) {
        candidate = new compat.IceCandidate(desc);
        return this.pc.addIceCandidate(candidate);
      } else {
        return console.log("ICE trickling stopped");
      }
    };


    /**
     * Returns the options for the offer/answer
     * @method _oaOptions
     * @private
     * @return {Object}
     */

    PeerConnection.prototype._oaOptions = function() {
      return {
        optional: [],
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      };
    };


    /**
     * Set the remote description
     * @method _setRemoteDescription
     * @private
     * @param {Object} sdp The remote SDP
     * @return {Promise} Promise which will be resolved once the remote description was set successfully
     */

    PeerConnection.prototype._setRemoteDescription = function(sdp) {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          var description;
          description = new compat.SessionDescription(sdp);
          return _this.pc.setRemoteDescription(sdp, resolve, reject);
        };
      })(this));
    };


    /**
     * Create offer, set it on local description and emit it
     * @method _offer
     * @private
     */

    PeerConnection.prototype._offer = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.pc.createOffer(resolve, reject, _this._oaOptions());
        };
      })(this)).then((function(_this) {
        return function(sdp) {
          return _this._processLocalSdp(sdp);
        };
      })(this))["catch"]((function(_this) {
        return function(err) {
          return _this._connectError(err);
        };
      })(this));
    };


    /**
     * Create answer, set it on local description and emit it
     * @method _offer
     * @private
     */

    PeerConnection.prototype._answer = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.pc.createAnswer(resolve, reject, _this._oaOptions());
        };
      })(this)).then((function(_this) {
        return function(sdp) {
          return _this._processLocalSdp(sdp);
        };
      })(this))["catch"]((function(_this) {
        return function(err) {
          return _this._connectError(err);
        };
      })(this));
    };


    /**
     * Set local description and emit it
     * @method _processLocalSdp
     * @private
     * @param {Object} sdp The local SDP
     * @return {Promise} Promise which will be resolved once the local description was set successfully
     */

    PeerConnection.prototype._processLocalSdp = function(sdp) {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          var success;
          success = function() {
            var data;
            data = {
              sdp: sdp.sdp,
              type: sdp.type
            };
            _this.emit('signaling', data);
            return resolve(sdp);
          };
          return _this.pc.setLocalDescription(sdp, success, reject);
        };
      })(this));
    };


    /**
     * Mark connection attempt as failed
     * @method _connectError
     * @private
     * @param {Error} err Error causing connection to fail
     */

    PeerConnection.prototype._connectError = function(err) {
      this.connect_d.reject(err);
      console.log(err);
      return this.emit('error', err);
    };


    /**
     * Add local stream
     * @method addStream
     * @param {rtc.Stream} stream The local stream
     */

    PeerConnection.prototype.addStream = function(stream) {
      return this.pc.addStream(stream.stream);
    };


    /**
     * Remove local stream
     * @method removeStream
     * @param {rtc.Stream} stream The local stream
     */

    PeerConnection.prototype.removeSream = function(stream) {
      return this.pc.removeStream(stream.stream);
    };


    /**
     * Add DataChannel. Will only actually do something if `offering` is `true`.
     * @method addDataChannel
     * @param {String} name Name of the data channel
     * @param {Object} desc Options passed to `RTCPeerConnection.createDataChannel()`
     */

    PeerConnection.prototype.addDataChannel = function(name, options) {
      var channel;
      if (this.offering) {
        channel = this.pc.createDataChannel(name, options);
        this.no_gc_bugfix.push(channel);
        return channel.onopen = (function(_this) {
          return function() {
            return _this.emit('data_channel_ready', new DataChannel(channel));
          };
        })(this);
      }
    };


    /**
     * Establish connection with remote peer. Connection will be established once both peers have called this functio
     * @method connect
     * @return {Promise} Promise which will be resolved once the connection is established
     */

    PeerConnection.prototype.connect = function() {
      if (!this.connected) {
        if (this.offering) {
          this._offer();
        } else if (this.pc.signalingState === 'have-remote-offer') {
          this._answer();
        }
        this.connected = true;
      }
      return Promise.resolve(this.connect_d.promise);
    };


    /**
     * Close the connection to the remote peer
     * @method close
     */

    PeerConnection.prototype.close = function() {
      this.pc.close();
      return this.emit('closed');
    };

    return PeerConnection;

  })(EventEmitter);

}).call(this);

},{"./compat":5,"./data_channel":6,"./internal/promise":8,"./stream":21,"events":1}],14:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var ChannelCollection, Peer, Promise, StreamCollection, merge,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Promise = require('./internal/promise').Promise;

  Peer = require('./peer').Peer;

  StreamCollection = require('./internal/stream_collection').StreamCollection;

  ChannelCollection = require('./internal/channel_collection').ChannelCollection;

  merge = function() {
    var array, i, key, len, res, value;
    res = {};
    for (i = 0, len = arguments.length; i < len; i++) {
      array = arguments[i];
      for (key in array) {
        value = array[key];
        res[key] = value;
      }
    }
    return res;
  };


  /**
   * @module rtc
   */


  /**
   * Represents a remote user of the room
   * @class rtc.RemotePeer
   * @extends rtc.Peer
  #
   * @constructor
   * @param {rtc.PeerConnection} peer_connection The underlying peer connection
   * @param {rtc.SignalingPeer} signaling The signaling connection to the peer
   * @param {rtc.LocalPeer} local The local peer
   * @param {Object} options The options object as passed to `Room`
   */

  exports.RemotePeer = (function(superClass) {
    extend(RemotePeer, superClass);


    /**
     * Message received from peer through signaling
     * @event message
     * @param data The payload of the message
     */


    /**
     * The remote peer left or signaling closed
     * @event left
     */


    /**
     * A new stream is available from the peer
     * @event stream_added
     * @param {String} name Name of the stream
     * @param {Promise -> rtc.Stream} stream Promise of the stream
     */


    /**
     * A new data channel is available from the peer
     * @event data_channel_added
     * @param {String} name Name of the channel
     * @param {Promise -> rtc.DataChannel} channel Promise of the channel
     */


    /**
     * The connection to the peer supplied by the signaling implementation
     * @property signaling
     * @type rtc.signaling.SignalingPeer
     */

    function RemotePeer(peer_connection, signaling, local, options1) {
      this.peer_connection = peer_connection;
      this.signaling = signaling;
      this.local = local;
      this.options = options1;
      this.private_streams = {};
      this.private_channels = {};
      this.stream_collection = new StreamCollection();
      this.streams = this.stream_collection.streams;
      this.streams_desc = {};
      this.stream_collection.on('stream_added', (function(_this) {
        return function(name, stream) {
          return _this.emit('stream_added', name, stream);
        };
      })(this));
      this.channel_collection = new ChannelCollection();
      this.channels = this.channel_collection.channels;
      this.channels_desc = {};
      this.channel_collection.on('data_channel_added', (function(_this) {
        return function(name, channel) {
          return _this.emit('data_channel_added', name, channel);
        };
      })(this));
      this.peer_connection.on('stream_added', (function(_this) {
        return function(stream) {
          return _this.stream_collection.resolve(stream);
        };
      })(this));
      this.peer_connection.on('data_channel_ready', (function(_this) {
        return function(channel) {
          return _this.channel_collection.resolve(channel);
        };
      })(this));
      this.peer_connection.on('signaling', (function(_this) {
        return function(data) {
          data.streams = _this.streams_desc;
          data.channels = _this.channels_desc;
          return _this.signaling.send('signaling', data);
        };
      })(this));
      this.signaling.on('signaling', (function(_this) {
        return function(data) {
          _this.stream_collection.update(data.streams);
          _this.channel_collection.setRemote(data.channels);
          return _this.peer_connection.signaling(data);
        };
      })(this));
      this.peer_connection.on('ice_candidate', (function(_this) {
        return function(candidate) {
          return _this.signaling.send('ice_candidate', candidate);
        };
      })(this));
      this.signaling.on('ice_candidate', (function(_this) {
        return function(candidate) {
          return _this.peer_connection.addIceCandidate(candidate);
        };
      })(this));
      this.signaling.on('status_changed', (function(_this) {
        return function(status) {
          return _this.emit('status_changed', status);
        };
      })(this));
      this.signaling.on('message', (function(_this) {
        return function(data) {
          return _this.emit('message', data);
        };
      })(this));
      this.signaling.on('left', (function(_this) {
        return function() {
          _this.peer_connection.close();
          return _this.emit('left');
        };
      })(this));
      this.peer_connection.on('connected', (function(_this) {
        return function() {};
      })(this));
      this.peer_connection.on('closed', (function(_this) {
        return function() {};
      })(this));
      if ((this.options.auto_connect == null) || this.options.auto_connect) {
        this.connect();
      }
    }

    RemotePeer.prototype.status = function(key) {
      return this.signaling.status[key];
    };


    /**
     * Send a message to the peer through signaling
     * @method message
     * @param data The payload
     * @return {Promise} Promise which is resolved when the data was sent
     */

    RemotePeer.prototype.message = function(data) {
      return this.signaling.send('message', data);
    };


    /**
     * Connect to the remote peer to exchange streams and create data channels
     * @method connect
     * @return {Promise} Promise which will resolved when the connection is established
     */

    RemotePeer.prototype.connect = function() {
      var name, promise, ref, stream, stream_promises;
      if (this.connect_p == null) {
        stream_promises = [];
        ref = merge(this.local.streams, this.private_streams);
        for (name in ref) {
          stream = ref[name];
          promise = stream.then(function(stream) {
            return [name, stream];
          });
          stream_promises.push(promise);
        }
        this.connect_p = Promise.all(stream_promises).then((function(_this) {
          return function(streams) {
            var i, len, options, ref1, ref2;
            for (i = 0, len = streams.length; i < len; i++) {
              ref1 = streams[i], name = ref1[0], stream = ref1[1];
              _this.peer_connection.addStream(stream);
              _this.streams_desc[name] = stream.id();
            }
            ref2 = merge(_this.local.channels, _this.private_channels);
            for (name in ref2) {
              options = ref2[name];
              _this.peer_connection.addDataChannel(name, options);
              _this.channels_desc[name] = options;
            }
            _this.channel_collection.setLocal(_this.channels_desc);
            return _this.peer_connection.connect();
          };
        })(this));
      }
      return this.connect_p;
    };


    /**
     * Closes the connection to the peer
     * @method close
     */

    RemotePeer.prototype.close = function() {
      this.peer_connection.close();
    };


    /**
     * Get a stream from the peer. Has to be sent by the remote peer to succeed.
     * @method stream
     * @param {String} [name='stream'] Name of the stream
     * @return {Promise -> rtc.Stream} Promise of the stream
     */

    RemotePeer.prototype.stream = function(name) {
      if (name == null) {
        name = this.DEFAULT_STREAM;
      }
      return this.stream_collection.get(name);
    };


    /**
     * Add local stream to be sent to this remote peer
    #
     * If you use this method you have to set `auto_connect` to `false` in the options object and call `connect()` manually on all remote peers.
    #
     * @method addStream
     * @param {String} [name='stream'] Name of the stream
     * @param {Promise -> rtc.Stream | rtc.Stream | Object} stream The stream, a promise to the stream or the configuration to create a stream with `rtc.Stream.createStream()`
     * @return {Promise -> rtc.Stream} Promise of the stream which was added
     */

    RemotePeer.prototype.addStream = function(name, obj) {
      var saveStream, stream_p;
      if (!(this.options.auto_connect === false)) {
        return Promise.reject("Unable to add streams directly to remote peers without 'auto_connect' option set to 'false'");
      }
      saveStream = (function(_this) {
        return function(stream_p) {
          _this.private_streams[name] = stream_p;
          return stream_p;
        };
      })(this);
      if (typeof name !== 'string') {
        obj = name;
        name = this.DEFAULT_STREAM;
      }
      if ((obj != null ? obj.then : void 0) != null) {
        return saveStream(obj);
      } else if (obj instanceof Stream) {
        return saveStream(Promise.resolve(obj));
      } else {
        stream_p = Stream.createStream(obj);
        return saveStream(stream_p);
      }
    };


    /**
     * Get a data channel to the remote peer. Has to be added by local and remote side to succeed.
     * @method channel
     * @param {String} [name='data'] Name of the data channel
     * @return {Promise -> rtc.DataChannel} Promise of the data channel
     */

    RemotePeer.prototype.channel = function(name) {
      if (name == null) {
        name = this.DEFAULT_CHANNEL;
      }
      return this.channel_collection.get(name);
    };


    /**
     * Add data channel which will be negotiated with this remote peer
    #
     * If you use this method you have to set `auto_connect` to `false` in the options object and call `connect()` manually on all remote peers.
    #
     * @method addDataChannel
     * @param {String} [name='data'] Name of the data channel
     * @param {Object} [desc={ordered: true}] Options passed to `RTCDataChannel.createDataChannel()`
     */

    RemotePeer.prototype.addDataChannel = function(name, desc) {
      if (!(this.options.auto_connect === false)) {
        return Promise.reject("Unable to add channels directly to remote peers without 'auto_connect' option set to 'false'");
      }
      if (typeof name !== 'string') {
        desc = name;
        name = this.DEFAULT_CHANNEL;
      }
      if (desc == null) {
        desc = {
          ordered: true
        };
      }
      this.private_channels[name] = desc;
      return this.channel(name);
    };


    /**
     * Checks whether the peer is the local peer. Returns always `false` on this
     * class.
     * @method isLocal
     * @return {Boolean} Returns `false`
     */

    RemotePeer.prototype.isLocal = function() {
      return false;
    };

    return RemotePeer;

  })(Peer);

}).call(this);

},{"./internal/channel_collection":7,"./internal/promise":8,"./internal/stream_collection":9,"./peer":12}],15:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter, LocalPeer, MucSignaling, PeerConnection, RemotePeer, WebSocketChannel,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  WebSocketChannel = require('./signaling/web_socket_channel').WebSocketChannel;

  MucSignaling = require('./signaling/muc_signaling').MucSignaling;

  RemotePeer = require('./remote_peer').RemotePeer;

  LocalPeer = require('./local_peer').LocalPeer;

  PeerConnection = require('./peer_connection').PeerConnection;


  /**
   * @module rtc
   */


  /**
   * A virtual room which connects multiple Peers
   * @class rtc.Room
  #
   * @constructor
   * @param {String} name The name of the room. Will be passed on to signaling
   * @param {rtc.Signaling | String} signaling The signaling to be used. If you pass a string it will be interpreted as a websocket address and a palava signaling connection will be established with it.
   * @param {Object} [options] Various options to be used in connections created by this room
   * @param {Boolean} [options.auto_connect=true] Whether remote peers are connected automatically or an explicit `RemotePeer.connect()` call is needed
   * @param {String} [options.stun] The URI of the STUN server to use
   * @param {rtc.LocalPeer} [options.local] The local user
   */

  exports.Room = (function(superClass) {
    extend(Room, superClass);


    /**
     * A new peer is encountered in the room. Fires on new remote peers after joining and for all peers in the room when joining.
     * @event peer_jopined
     * @param {rtc.RemotePeer} peer The new peer
     */


    /**
     * A peer left the room.
     * @event peer_left
     * @param {rtc.RemotePeer} peer The peer which left
     */


    /**
     * A peer changed its status.
     * @event peer_status_changed
     * @param {rtc.RemotePeer} peer The peer which changed its status
     * @param {Object} status The new status
     */


    /**
     * The connection to the room was closed
     * @event closed
     */


    /**
     * The underlying signaling implementation as provided in constructor
     * @property signaling
     * @type rtc.signaling.Signaling
     */


    /**
     * The local peer
     * @property local
     * @type rtc.LocalPeer
     */

    function Room(signaling, options) {
      var channel;
      this.signaling = signaling;
      this.options = options != null ? options : {};
      if (typeof this.signaling === 'string' || this.signaling instanceof String) {
        channel = new WebSocketChannel(this.signaling);
        this.signaling = new MucSignaling(channel);
      }
      this.local = this.options.local || new LocalPeer();
      this.signaling.setStatus(this.local._status);
      this.local.on('status_changed', (function(_this) {
        return function() {
          return _this.signaling.setStatus(_this.local._status);
        };
      })(this));
      this.signaling.on('peer_joined', (function(_this) {
        return function(signaling_peer) {
          var pc, peer;
          pc = new PeerConnection(signaling_peer.first, _this.options);
          peer = _this.createPeer(pc, signaling_peer);
          peer.on('status_changed', function(status) {
            return _this.emit('peer_status_changed', peer, status);
          });
          peer.on('left', function() {
            delete _this.peers[signaling_peer.id];
            return _this.emit('peer_left', peer);
          });
          _this.peers[signaling_peer.id] = peer;
          _this.emit('peer_joined', peer);
          return peer.on('closed', function() {
            return delete _this.peers[signaling_peer.id];
          });
        };
      })(this));
      this.peers = {};
    }


    /**
     * Joins the room. Initiates connection to signaling server if not done before.
     * @method join
     * @return {Promise} A promise which will be resolved once the room was joined
     */

    Room.prototype.connect = function() {
      if (this.join_p == null) {
        this.join_p = this.signaling.connect();
      }
      return this.join_p;
    };


    /**
     * Leaves the room and closes all established peer connections
     * @method leave
     */

    Room.prototype.leave = function() {
      return this.signaling.leave();
    };


    /**
     * Cleans up all resources used by the room.
     * @method leave
     */

    Room.prototype.destroy = function() {
      return this.signaling.leave();
    };


    /**
     * Creates a remote peer. Overwrite to use your own class for peers.
     * @private
     * @method create_peer
     * @param {rtc.PeerConnection} pc The PeerConnection to the peer
     * @param {rtc.SignalingPeer} signaling_peer The signaling connection to the peer
     */

    Room.prototype.createPeer = function(pc, signaling_peer) {
      return new RemotePeer(pc, signaling_peer, this.local, this.options);
    };

    return Room;

  })(EventEmitter);

}).call(this);

},{"./local_peer":11,"./peer_connection":13,"./remote_peer":14,"./signaling/muc_signaling":17,"./signaling/web_socket_channel":20,"events":1}],16:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Calling, CallingInInvitation, CallingInvitationRoom, CallingNamespace, CallingNamespaceRoom, CallingNamespaceRoomPeer, CallingNamespaceUser, CallingOutInvitation, CallingPeer, CallingRoom, CallingSignaling, CallingSignalingPeer, Deferred, EventEmitter, Promise, RemotePeer, Room, extend, ref,
    extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  ref = require('../internal/promise'), Promise = ref.Promise, Deferred = ref.Deferred;

  extend = require('extend');

  Room = require('../room').Room;

  RemotePeer = require('../remote_peer').RemotePeer;

  Calling = (function(superClass) {
    extend1(Calling, superClass);

    function Calling(channel, room_options) {
      var hello_d;
      this.channel = channel;
      this.room_options = room_options;
      this.next_tid = 0;
      this.answers = {};
      hello_d = new Deferred();
      this.hello_p = hello_d.promise;
      this.channel.on('message', (function(_this) {
        return function(msg) {
          var answer, invitation, room;
          _this.resetPing();
          switch (msg.type) {
            case 'hello':
              _this.id = msg.id;
              return hello_d.resolve(msg.server);
            case 'answer':
              if (msg.tid == null) {
                console.log('Missing transaction id in answer');
                return;
              }
              answer = _this.answers[msg.tid];
              delete _this.answers[msg.tid];
              if (answer == null) {
                console.log('Answer without expecting it');
                return;
              }
              if (answer.resolve != null) {
                if (msg.error != null) {
                  return answer.reject(new Error(msg.error));
                } else {
                  return answer.resolve(msg.data);
                }
              } else {
                if (msg.error != null) {
                  return answer(new Error(msg.error));
                } else {
                  return answer(void 0, msg.data);
                }
              }
              break;
            case 'invite_incoming':
              if ((msg.handle == null) || (msg.sender == null) || !msg.room || (msg.status == null) || (msg.peers == null) || (msg.data == null)) {
                console.log("Invalid message");
                return;
              }
              invitation = new CallingInInvitation(_this, msg.handle);
              room = new CallingInvitationRoom(invitation, _this.room_options, msg.sender, msg.data);
              room.signaling.init(msg);
              return _this.emit('invitation', room);
          }
        };
      })(this));
      this.channel.on('closed', (function(_this) {
        return function() {
          _this.emit('closed');
          if (_this.ping_interval) {
            clearInterval(_this.ping_interval);
            return delete _this.ping_interval;
          }
        };
      })(this));
    }

    Calling.prototype.connect = function() {
      return this.channel.connect().then((function(_this) {
        return function() {
          _this.resetPing();
          return _this.hello_p;
        };
      })(this));
    };

    Calling.prototype.request = function(msg, cb) {
      var defer;
      msg.tid = this.next_tid++;
      this.channel.send(msg);
      this.resetPing();
      if (cb != null) {
        this.answers[msg.tid] = cb;
      } else {
        defer = new Deferred();
        this.answers[msg.tid] = defer;
        return defer.promise;
      }
    };

    Calling.prototype.ping = function() {
      return this.request({
        type: 'ping'
      });
    };

    Calling.prototype.resetPing = function() {
      if (this.ping_timeout) {
        clearTimeout(this.ping_timeout);
      }
      return this.ping_timeout = setTimeout((function(_this) {
        return function() {
          _this.ping();
          return _this.resetPing();
        };
      })(this), 2 * 60 * 1000);
    };

    Calling.prototype.subscribe = function(nsid) {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.request({
            type: 'ns_subscribe',
            namespace: nsid
          }, function(err, data) {
            var id, namespace, ref1, ref2, room, status;
            if (err != null) {
              return reject(err);
            } else {
              namespace = new CallingNamespace(_this, nsid);
              ref1 = data.users;
              for (id in ref1) {
                status = ref1[id];
                namespace.addUser(id, status);
              }
              ref2 = data.rooms;
              for (id in ref2) {
                room = ref2[id];
                namespace.addRoom(id, room.status, room.peers);
              }
              return resolve(namespace);
            }
          });
        };
      })(this));
    };

    Calling.prototype.register = function(namespace) {
      return this.request({
        type: 'ns_user_register',
        namespace: namespace
      });
    };

    Calling.prototype.unregister = function(namespace) {
      return this.request({
        type: 'ns_user_unregister',
        namespace: namespace
      });
    };

    Calling.prototype.room = function(room, options) {
      var signaling;
      signaling = this.room_signaling(room);
      return new CallingRoom(signaling, options || this.room_options);
    };

    Calling.prototype.room_signaling = function(room) {
      return new CallingSignaling(this, (function(_this) {
        return function(status, cb) {
          return _this.request({
            type: 'room_join',
            room: room,
            status: status
          }, cb);
        };
      })(this));
    };

    Calling.prototype.setStatus = function(status) {
      return this.request({
        type: 'status',
        status: status
      });
    };

    Calling.prototype.close = function() {
      return this.channel.close();
    };

    return Calling;

  })(EventEmitter);

  CallingNamespace = (function(superClass) {
    extend1(CallingNamespace, superClass);

    function CallingNamespace(calling, id1) {
      var message_handler;
      this.calling = calling;
      this.id = id1;
      this.users = {};
      this.rooms = {};
      message_handler = (function(_this) {
        return function(msg) {
          var peer, room, user;
          if (msg.namespace !== _this.id) {
            return;
          }
          switch (msg.type) {
            case 'ns_user_add':
              if ((msg.user == null) || (msg.status == null)) {
                console.log('Invalid message');
                return;
              }
              return _this.addUser(msg.user, msg.status);
            case 'ns_user_update':
              if ((msg.user == null) || (msg.status == null)) {
                console.log('Invalid message');
                return;
              }
              user = _this.users[msg.user];
              if (user == null) {
                console.log('Unknown user in status change');
                return;
              }
              user.status = msg.status;
              _this.emit('user_changed', user);
              _this.emit('user_status_changed', user, user.status);
              return user.emit('status_changed', user.status);
            case 'ns_user_rm':
              if (msg.user == null) {
                console.log('Invalid message');
                return;
              }
              user = _this.users[msg.user];
              if (user == null) {
                console.log('Unknown user leaving');
                return;
              }
              delete _this.users[msg.user];
              _this.emit('user_changed', user);
              _this.emit('user_left', user);
              return user.emit('left');
            case 'ns_room_add':
              if ((msg.room == null) || (msg.status == null) || (msg.peers == null)) {
                console.log('Invalid message');
                return;
              }
              return _this.addRoom(msg.room, msg.status, msg.peers);
            case 'ns_room_update':
              if ((msg.room == null) || (msg.status == null)) {
                console.log('Invalid message');
                return;
              }
              room = _this.rooms[msg.room];
              if (room == null) {
                console.log('Invalid room');
                return;
              }
              room.status = msg.status;
              _this.emit('room_changed', room);
              _this.emit('room_status_changed', room, room.status);
              return room.emit('status_changed', room.status);
            case 'ns_room_rm':
              if (msg.room == null) {
                console.log('Invalid message');
                return;
              }
              room = _this.rooms[msg.room];
              if (room == null) {
                console.log('Invalid room');
                return;
              }
              delete _this.rooms[msg.room];
              _this.emit('room_changed', room);
              _this.emit('room_closed');
              return room.emit('closed');
            case 'ns_room_peer_add':
              if ((msg.room == null) || (msg.user == null) || (msg.status == null) || (msg.pending == null)) {
                console.log('Invalid message');
                return;
              }
              room = _this.rooms[msg.room];
              if (room == null) {
                console.log('Invalid room');
                return;
              }
              peer = room.addPeer(msg.user, msg.status, msg.pending);
              _this.emit('room_changed', room);
              return _this.emit('room_peer_joined', room, peer);
            case 'ns_room_peer_update':
              if ((msg.room == null) || (msg.user == null)) {
                console.log('Invalid message');
                return;
              }
              room = _this.rooms[msg.room];
              peer = room != null ? room.peers[msg.user] : void 0;
              if (peer == null) {
                console.log('Invalid peer');
                return;
              }
              if (msg.status != null) {
                peer.status = msg.status;
                _this.emit('room_changed', room);
                _this.emit('room_peer_status_changed', room, peer, peer.status);
                peer.emit('status_changed', peer.status);
              }
              if ((msg.pending != null) && msg.pending === false) {
                peer.pending = false;
                peer.accepted_d.resolve();
                _this.emit('room_changed', room);
                _this.emit('peer_accepted', peer);
                return peer.emit('accepted');
              }
              break;
            case 'ns_room_peer_rm':
              if ((msg.room == null) || (msg.user == null)) {
                console.log('Invalid message');
                return;
              }
              room = _this.rooms[msg.room];
              peer = room != null ? room.peers[msg.user] : void 0;
              if (peer == null) {
                console.log('Invalid peer');
                return;
              }
              delete _this.rooms[msg.room].peers[msg.user];
              _this.emit('room_changed', room);
              _this.emit('room_peer_left', room, peer);
              return peer.emit('left');
          }
        };
      })(this);
      this.calling.channel.on('message', message_handler);
      this.on('unsubscribed', (function(_this) {
        return function() {
          return _this.calling.channel.removeListener('message', message_handler);
        };
      })(this));
    }

    CallingNamespace.prototype.addUser = function(id, status) {
      var user;
      user = new CallingNamespaceUser(id, status);
      this.users[id] = user;
      this.emit('user_changed', user);
      this.emit('user_registered', user);
      return user;
    };

    CallingNamespace.prototype.addRoom = function(id, status, peers) {
      var peer, peer_id, room;
      room = new CallingNamespaceRoom(id, status);
      for (peer_id in peers) {
        peer = peers[peer_id];
        room.addPeer(peer_id, peer.status, peer.pending);
      }
      this.rooms[id] = room;
      this.emit('room_changed', room);
      this.emit('room_registered', room);
      return room;
    };

    CallingNamespace.prototype.unsubscribe = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.calling.request({
            type: 'ns_unsubscribe',
            namespace: _this.id
          }, function(err) {
            var _, ref1, user;
            if (err != null) {
              return reject(err);
            } else {
              ref1 = _this.users;
              for (_ in ref1) {
                user = ref1[_];
                user.emit('left');
              }
              _this.users = {};
              _this.emit('unsubscribed');
              return resolve();
            }
          });
        };
      })(this));
    };

    return CallingNamespace;

  })(EventEmitter);

  CallingNamespaceUser = (function(superClass) {
    extend1(CallingNamespaceUser, superClass);

    function CallingNamespaceUser(id1, status1, pending1) {
      this.id = id1;
      this.status = status1;
      this.pending = pending1;
    }

    return CallingNamespaceUser;

  })(EventEmitter);

  CallingNamespaceRoom = (function(superClass) {
    extend1(CallingNamespaceRoom, superClass);

    function CallingNamespaceRoom(id1, status1) {
      this.id = id1;
      this.status = status1;
      this.peers = {};
    }

    CallingNamespaceRoom.prototype.addPeer = function(id, status, pending) {
      var peer;
      peer = new CallingNamespaceRoomPeer(id, status, pending);
      this.peers[id] = peer;
      this.emit('peer_joined', peer);
      return peer;
    };

    return CallingNamespaceRoom;

  })(EventEmitter);

  CallingNamespaceRoomPeer = (function(superClass) {
    extend1(CallingNamespaceRoomPeer, superClass);

    function CallingNamespaceRoomPeer(id1, status1, pending1) {
      this.id = id1;
      this.status = status1;
      this.pending = pending1;
      this.accepted_d = new Deferred();
      if (!this.pending) {
        this.accepted_d.resolve();
      }
      this.on('left', (function(_this) {
        return function() {
          return _this.accepted_d.reject("Peer left");
        };
      })(this));
    }

    CallingNamespaceRoomPeer.prototype.accepted = function() {
      return this.accepted_d.promise;
    };

    return CallingNamespaceRoomPeer;

  })(EventEmitter);

  CallingSignaling = (function(superClass) {
    extend1(CallingSignaling, superClass);

    function CallingSignaling(calling, connect_fun) {
      var message_handler;
      this.calling = calling;
      this.connect_fun = connect_fun;
      this.peer_status = {};
      this.peers = {};
      this.initialized = false;
      message_handler = (function(_this) {
        return function(msg) {
          var peer;
          if (msg.room !== _this.id) {
            return;
          }
          switch (msg.type) {
            case 'room_update':
              if (msg.status == null) {
                console.log("Invalid message");
                return;
              }
              _this.status = msg.status;
              return _this.emit('status_changed', _this.status);
            case 'room_peer_add':
              if ((msg.user == null) || (msg.pending == null) || (msg.status == null)) {
                console.log("Invalid message");
                return;
              }
              return _this.addPeer(msg.user, msg.status, msg.pending, true);
            case 'room_peer_rm':
              console.log('removing');
              if (msg.user == null) {
                console.log("Invalid message");
                return;
              }
              peer = _this.peers[msg.user];
              if (peer == null) {
                console.log("Unknown peer accepted");
                return;
              }
              delete _this.peers[msg.user];
              peer.accepted_d.reject("User left");
              console.log('removed', _this.peers);
              _this.emit('peer_left', peer);
              return peer.emit('left');
            case 'room_peer_update':
              if (msg.user == null) {
                console.log("Invalid message");
                return;
              }
              peer = _this.peers[msg.user];
              if (peer == null) {
                console.log("Unknown peer accepted");
                return;
              }
              if (msg.status != null) {
                peer.status = msg.status;
                _this.emit('peer_status_changed', peer, peer.status);
                peer.emit('status_changed', peer.status);
              }
              if ((msg.pending != null) && msg.pending === false) {
                peer.pending = false;
                peer.accepted_d.resolve();
                _this.emit('peer_accepted');
                return peer.emit('accepted');
              }
              break;
            case 'room_peer_from':
              if ((msg.user == null) || (msg.event == null)) {
                console.log("Invalid message", msg);
                return;
              }
              peer = _this.peers[msg.user];
              if (peer == null) {
                console.log("Unknown peer accepted");
                return;
              }
              _this.emit('peer_left');
              return peer.emit(msg.event, msg.data);
          }
        };
      })(this);
      this.calling.channel.on('message', message_handler);
      this.on('left', (function(_this) {
        return function() {
          return _this.calling.channel.removeListener('message', message_handler);
        };
      })(this));
    }

    CallingSignaling.prototype.init = function(data) {
      var entry, ref1, user;
      if (this.initialized) {
        throw new Error("Room is already initialized");
      }
      if ((data.room == null) || (data.peers == null) || (data.status == null)) {
        console.log(data);
        throw new Error("Invalid initialization data");
      }
      this.id = data.room;
      this.status = data.status;
      ref1 = data.peers;
      for (user in ref1) {
        entry = ref1[user];
        this.addPeer(user, entry.status, entry.pending, false);
      }
      return this.initialized = true;
    };

    CallingSignaling.prototype.connect = function() {
      if (this.connect_p == null) {
        this.connect_p = new Promise((function(_this) {
          return function(resolve, reject) {
            return _this.connect_fun(_this.peer_status, function(err, res) {
              if (err != null) {
                return reject(err);
              } else {
                if (res != null) {
                  _this.init(res);
                }
                if (!_this.initialized) {
                  reject(new Error("Missing information from connect response"));
                  return;
                }
                return resolve();
              }
            });
          };
        })(this));
      }
      return this.connect_p;
    };

    CallingSignaling.prototype.addPeer = function(id, status, pending, first) {
      var peer;
      peer = new CallingSignalingPeer(this, id, status, pending, first);
      this.peers[id] = peer;
      this.emit('peer_joined', peer);
      return peer;
    };

    CallingSignaling.prototype.leave = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.calling.request({
            type: 'room_leave',
            room: _this.id
          }, function(err) {
            var _, peer, ref1;
            _this.emit('left');
            ref1 = _this.peers;
            for (_ in ref1) {
              peer = ref1[_];
              peer.emit('left');
              peer.accepted_d.reject("You left the room");
            }
            return resolve();
          });
        };
      })(this));
    };

    CallingSignaling.prototype.setStatus = function(status) {
      this.peer_status = status;
      if (this.connect_p != null) {
        return this.calling.request({
          type: 'room_peer_status',
          room: this.id,
          status: status
        });
      } else {
        return Promise.resolve();
      }
    };

    CallingSignaling.prototype.invite = function(user, data) {
      if (data == null) {
        data = {};
      }
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.calling.request({
            type: 'invite_send',
            room: _this.id,
            user: user.id,
            data: data
          }, function(err, res) {
            var invitation;
            if (err != null) {
              return reject(err);
            } else {
              if (res.handle == null) {
                reject(new Error("Invalid response"));
                return;
              }
              invitation = new CallingOutInvitation(_this.calling, res.handle, user);
              return resolve(invitation);
            }
          });
        };
      })(this));
    };

    CallingSignaling.prototype.setRoomStatusSafe = function(key, value, previous) {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.calling.request({
            type: 'room_status',
            room: _this.id,
            key: key,
            value: value,
            check: true,
            previous: previous
          }, function(err) {
            if (err) {
              reject(err);
              return;
            }
            _this.status[key] = value;
            _this.emit('status_changed', _this.status);
            return resolve();
          });
        };
      })(this));
    };

    CallingSignaling.prototype.setRoomStatus = function(key, value) {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.calling.request({
            type: 'room_status',
            room: _this.id,
            key: key,
            value: value
          }, function(err) {
            if (err) {
              reject(err);
              return;
            }
            _this.status[key] = value;
            _this.emit('status_changed', _this.status);
            return resolve();
          });
        };
      })(this));
    };

    CallingSignaling.prototype.register = function(namespace) {
      return this.calling.request({
        type: 'ns_room_register',
        namespace: namespace,
        room: this.id
      });
    };

    CallingSignaling.prototype.unregister = function(namespace) {
      return this.calling.request({
        type: 'ns_room_unregister',
        namespace: namespace,
        room: this.id
      });
    };

    return CallingSignaling;

  })(EventEmitter);

  CallingSignalingPeer = (function(superClass) {
    extend1(CallingSignalingPeer, superClass);

    function CallingSignalingPeer(room1, id1, status1, pending1, first1) {
      this.room = room1;
      this.id = id1;
      this.status = status1;
      this.pending = pending1;
      this.first = first1;
      this.accepted_d = new Deferred();
      if (!this.pending) {
        this.accepted_d.resolve();
      }
      return;
    }

    CallingSignalingPeer.prototype.accepted = function() {
      return this.accepted_d.promise;
    };

    CallingSignalingPeer.prototype.send = function(event, data) {
      return this.room.calling.request({
        type: 'room_peer_to',
        room: this.room.id,
        user: this.id,
        event: event,
        data: data
      });
    };

    return CallingSignalingPeer;

  })(EventEmitter);

  CallingInInvitation = (function(superClass) {
    extend1(CallingInInvitation, superClass);

    function CallingInInvitation(calling, handle, sender, data1) {
      var message_handler;
      this.calling = calling;
      this.handle = handle;
      this.sender = sender;
      this.data = data1;
      this.cancelled = false;
      message_handler = (function(_this) {
        return function(msg) {
          if (msg.handle !== _this.handle) {
            return;
          }
          switch (msg.type) {
            case 'invite_cancelled':
              _this.cancelled = true;
              _this.emit('cancelled');
              return _this.emit('handled', false);
          }
        };
      })(this);
      this.calling.channel.on('message', message_handler);
      this.on('handled', (function(_this) {
        return function() {
          return _this.calling.channel.removeListener('message', message_handler);
        };
      })(this));
      return;
    }

    CallingInInvitation.prototype.signaling = function() {
      return new CallingSignaling(this.calling, (function(_this) {
        return function(status, cb) {
          _this.emit('handled', true);
          return _this.calling.request({
            type: 'invite_accept',
            handle: _this.handle,
            status: status
          }, cb);
        };
      })(this));
    };

    CallingInInvitation.prototype.deny = function() {
      this.emit('handled', false);
      return this.calling.request({
        type: 'invite_deny',
        handle: this.handle
      });
    };

    return CallingInInvitation;

  })(EventEmitter);

  CallingOutInvitation = (function() {
    function CallingOutInvitation(calling, handle, user1) {
      var cleanup, message_handler;
      this.calling = calling;
      this.handle = handle;
      this.user = user1;
      this.defer = new Deferred();
      this.pending = true;
      message_handler = (function(_this) {
        return function(msg) {
          if (msg.handle !== _this.handle) {
            return;
          }
          switch (msg.type) {
            case 'invite_response':
              if (msg.accepted == null) {
                console.log("Invalid message");
                return;
              }
              _this.pending = false;
              return _this.defer.resolve(msg.accepted);
          }
        };
      })(this);
      this.calling.channel.on('message', message_handler);
      cleanup = (function(_this) {
        return function() {
          return _this.calling.channel.removeListener('message', message_handler);
        };
      })(this);
      this.defer.promise.then(cleanup, cleanup);
      return;
    }

    CallingOutInvitation.prototype.response = function() {
      return this.defer.promise;
    };

    CallingOutInvitation.prototype.cancel = function() {
      this.pending = false;
      return this.calling.request({
        type: 'invite_cancel',
        handle: this.handle
      }).then((function(_this) {
        return function() {
          _this.defer.reject(new Error("Invitation cancelled"));
        };
      })(this));
    };

    return CallingOutInvitation;

  })();

  CallingRoom = (function(superClass) {
    extend1(CallingRoom, superClass);

    function CallingRoom(signaling, options) {
      options = extend({
        auto_connect: false
      }, options);
      CallingRoom.__super__.constructor.call(this, signaling, options);
    }

    CallingRoom.prototype.createPeer = function(pc, signaling) {
      return new CallingPeer(pc, signaling, this.local, this.options);
    };

    CallingRoom.prototype.invite = function(user) {
      return this.signaling.invite(user);
    };

    CallingRoom.prototype.register = function(nsid) {
      return this.signaling.register(nsid);
    };

    CallingRoom.prototype.unregister = function(nsid) {
      return this.signaling.unregister(nsid);
    };

    return CallingRoom;

  })(Room);

  CallingInvitationRoom = (function(superClass) {
    extend1(CallingInvitationRoom, superClass);

    function CallingInvitationRoom(invitation1, options, sender_id, data1) {
      this.invitation = invitation1;
      this.sender_id = sender_id;
      this.data = data1;
      CallingInvitationRoom.__super__.constructor.call(this, this.invitation.signaling(), options);
      this.invitation.on('cancelled', (function(_this) {
        return function() {
          return _this.emit('cancelled');
        };
      })(this));
      this.invitation.on('handled', (function(_this) {
        return function(accepted) {
          return _this.emit('handled', accepted);
        };
      })(this));
    }

    CallingInvitationRoom.prototype.sender = function() {
      return this.peers[this.sender_id];
    };

    CallingInvitationRoom.prototype.deny = function() {
      return this.invitation.deny();
    };

    return CallingInvitationRoom;

  })(CallingRoom);

  CallingPeer = (function(superClass) {
    extend1(CallingPeer, superClass);

    function CallingPeer(pc, signaling, local, options) {
      CallingPeer.__super__.constructor.call(this, pc, signaling, local, options);
    }

    CallingPeer.prototype.connect = function() {
      return this.signaling.accepted().then((function(_this) {
        return function() {
          return CallingPeer.__super__.connect.call(_this);
        };
      })(this));
    };

    return CallingPeer;

  })(RemotePeer);

  module.exports = {
    Calling: Calling,
    CallingNamespace: CallingNamespace,
    CallingNamespaceUser: CallingNamespaceUser,
    CallingNamespaceRoom: CallingNamespaceRoom,
    CallingNamespaceRoomPeer: CallingNamespaceRoomPeer,
    CallingSignaling: CallingSignaling,
    CallingSignalingPeer: CallingSignalingPeer,
    CallingInInvitation: CallingInInvitation,
    CallingOutInvitation: CallingOutInvitation
  };

}).call(this);

},{"../internal/promise":8,"../remote_peer":14,"../room":15,"events":1,"extend":4}],17:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter, Signaling, SignalingPeer, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('../internal/promise').Deferred;

  ref = require('./signaling'), Signaling = ref.Signaling, SignalingPeer = ref.SignalingPeer;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.signaling
   */


  /**
   * Signaling peer for multi user chats.
  #
   * For a detailed description of the signaling protocol see `rtc.signaling.MucSignaling`
  #
   * @extends rtc.signaling.SignalingPeer
   * @class rtc.signaling.MucSignalingPeer
  #
   * @constructor
   * @param {rtc.signaling.Channel} channel The channel to the siganling server
   * @param {String} peer_id The id of the remote peer
   * @param {Object} status The status of the remote peer
   * @param {Boolean} first Whether the local peer was in the room before the remote peer
   */

  exports.MucSignalingPeer = (function(superClass) {
    extend(MucSignalingPeer, superClass);


    /**
     * The id of the remote peer
     * @property id
     * @type String
     */

    function MucSignalingPeer(channel, id, status1, first) {
      var recv_msg;
      this.channel = channel;
      this.id = id;
      this.status = status1;
      this.first = first;
      recv_msg = (function(_this) {
        return function(data) {
          if (data.peer !== _this.id) {
            return;
          }
          if (data.type == null) {
            return;
          }
          switch (data.type) {
            case 'from':
              if ((data.event == null) || (data.data == null)) {
                return;
              }
              return _this.emit(data.event, data.data);
            case 'peer_left':
              _this.emit('left');
              return _this.channel.removeListener('message', recv_msg);
            case 'peer_status':
              _this.status = data.status;
              return _this.emit('status_changed', _this.status);
          }
        };
      })(this);
      this.channel.on('message', recv_msg);
    }

    MucSignalingPeer.prototype.send = function(event, data) {
      if (data == null) {
        data = {};
      }
      return this.channel.send({
        type: 'to',
        peer: this.id,
        event: event,
        data: data
      });
    };

    return MucSignalingPeer;

  })(SignalingPeer);


  /**
   * Signaling for multi user chats
  #
   * The following messages are sent to the server:
  #
   *     // join the room. has to be sent before any other message.
   *     // response will be 'joined' on success
   *     // other peers in the room will get 'peer_joined'
   *     {
   *       "type": "join",
   *       "status": { .. status .. }
   *     }
  #
   *     // leave the room. server will close the connectino.
   *     {
   *       "type": "leave"
   *     }
  #
   *     // update status object
   *     // other peers will get 'peer_status'
   *     {
   *       "type": "status",
   *       "status": { .. status .. }
   *     }
  #
   *     // send message to a peer. will be received as 'from'
   *     {
   *       "type": "to",
   *       "peer": "peer_id",
   *       "event": "event_id",
   *       "data": { .. custom data .. }
   *     }
  #
   * The following messages are received form the server:
  #
   *     // joined the room. is the response to 'join'
   *     {
   *       "type": "joined",
   *       "id": "own_id",
   *       "peers": {
   *         "peer_id": { .. status .. }
   *       }
   *     }
  #
   *     // another peer joined the room.
   *     {
   *       "type": "peer_joined",
   *       "peer": "peer_id",
   *       "status": { .. status .. }
   *     }
  #
   *     // anosther peer updated its status object using 'status'
   *     {
   *       "type": "peer_status",
   *       "peer": "peer_id",
   *       "status": { .. status .. }
   *     }
  #
   *     // another peer left the room
   *     {
   *       "type": "peer_left",
   *       "peer": "peer_id"
   *     }
  #
   *     // message from another peer sent by 'to'
   *     {
   *       "type": "from",
   *       "peer": "peer_id",
   *       "event": "event_id",
   *       "data": { .. custom data .. }
   *     }
  #
   * The messages transmitted in the `to`/`from` messages are emitted as events in `MucSignalingPeer`
  #
   * @extends rtc.signaling.Signaling
   * @class rtc.signaling.MucSignaling
  #
   * @constructor
   * @param {rtc.signaling.Channel} channel The channel to the signaling server
   */

  exports.MucSignaling = (function(superClass) {
    extend(MucSignaling, superClass);


    /**
     * The id of the local peer. Only available after joining.
     * @property id
     * @type String
     */

    function MucSignaling(channel) {
      var join_d;
      this.channel = channel;
      this.status = {};
      join_d = new Deferred();
      this.join_p = join_d.promise;
      this.channel.on('closed', (function(_this) {
        return function() {
          return _this.emit('closed');
        };
      })(this));
      this.channel.on('message', (function(_this) {
        return function(data) {
          var peer, peer_id, ref1, status;
          if (data.type == null) {
            return;
          }
          switch (data.type) {
            case 'joined':
              if (data.peers == null) {
                return;
              }
              ref1 = data.peers;
              for (peer_id in ref1) {
                status = ref1[peer_id];
                peer = new exports.MucSignalingPeer(_this.channel, peer_id, status, false);
                _this.emit('peer_joined', peer);
              }
              _this.id = data.id;
              return join_d.resolve();
            case 'peer_joined':
              if (data.peer == null) {
                return;
              }
              peer = new exports.MucSignalingPeer(_this.channel, data.peer, data.status, true);
              return _this.emit('peer_joined', peer);
          }
        };
      })(this));
    }

    MucSignaling.prototype.connect = function() {
      if (this.connect_p == null) {
        this.connect_p = this.channel.connect().then((function(_this) {
          return function() {
            return _this.channel.send({
              type: 'join',
              status: _this.status
            });
          };
        })(this)).then((function(_this) {
          return function() {
            return _this.join_d;
          };
        })(this));
      }
      return this.connect_p;
    };

    MucSignaling.prototype.setStatus = function(status) {
      this.status = status;
      if (this.connect_p) {
        return this.connect_p.then((function(_this) {
          return function() {
            return _this.channel.send({
              type: 'status',
              status: status
            });
          };
        })(this));
      }
    };

    MucSignaling.prototype.leave = function() {
      return this.channel.send({
        type: 'leave'
      }).then(function() {
        return this.channel.close();
      });
    };

    return MucSignaling;

  })(Signaling);

}).call(this);

},{"../internal/promise":8,"./signaling":19,"events":1}],18:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, Signaling, SignalingPeer, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('../internal/promise').Deferred;

  ref = require('./signaling'), Signaling = ref.Signaling, SignalingPeer = ref.SignalingPeer;


  /**
   * @module rtc.signaling
   */


  /**
   * Signaling peer compatible with the framing of palava signaling
   * @class rtc.signaling.PalavaSignalingPeer
   * @extends rtc.signaling.SignalingPeer
   */

  exports.PalavaSignalingPeer = (function(superClass) {
    extend(PalavaSignalingPeer, superClass);

    function PalavaSignalingPeer(channel, id, status1, first) {
      var recv_msg;
      this.channel = channel;
      this.id = id;
      this.status = status1;
      this.first = first;
      recv_msg = (function(_this) {
        return function(data) {
          if (data.sender_id !== _this.id) {
            return;
          }
          if (data.event == null) {
            _this.send('error', "Invalid message");
            return;
          }
          return _this.emit(data.event, data.data);
        };
      })(this);
      this.channel.on('message', recv_msg);
      this.on('peer_updated_status', (function(_this) {
        return function(status) {
          return _this.emit('status_changed', status);
        };
      })(this));
      this.on('peer_left', (function(_this) {
        return function() {
          _this.emit('closed');
          return _this.channel.removeListener('message', recv_msg);
        };
      })(this));
    }

    PalavaSignalingPeer.prototype.send = function(event, data) {
      if (data == null) {
        data = {};
      }
      return this.channel.send({
        event: 'send_to_peer',
        peer_id: this.id,
        data: {
          event: event,
          data: data
        }
      });
    };

    return PalavaSignalingPeer;

  })(SignalingPeer);


  /**
   * Signaling implementation compatible with the framing of palava signaling
   * @class rtc.signaling.PalavaSignaling
   * @extends rtc.signaling.Signaling
   */

  exports.PalavaSignaling = (function(superClass) {
    extend(PalavaSignaling, superClass);

    function PalavaSignaling(channel, room1, status1) {
      var join_d;
      this.channel = channel;
      this.room = room1;
      this.status = status1;
      this.peers = {};
      this.joined = false;
      join_d = new Deferred();
      this.join_p = join_d.promise;
      this.channel.on('closed', (function(_this) {
        return function() {
          return _this.emit('closed');
        };
      })(this));
      this.channel.on('message', (function(_this) {
        return function(data) {
          var i, peer, ref1;
          if (data.event == null) {
            return;
          }
          switch (data.event) {
            case 'joined_room':
              if ((data.peers == null) || (data.own_id == null)) {
                return;
              }
              ref1 = data.peers;
              for (i in ref1) {
                data = ref1[i];
                peer = new exports.PalavaSignalingPeer(_this.channel, data.peer_id, data.status, false);
                _this.peers[data.peer_id] = peer;
                _this.emit('peer_joined', peer);
              }
              return join_d.resolve();
            case 'new_peer':
              if (data.peer_id == null) {
                return;
              }
              peer = new exports.PalavaSignalingPeer(_this.channel, data.peer_id, data.status, true);
              _this.peers[data.peer] = peer;
              return _this.emit('peer_joined', peer);
          }
        };
      })(this));
    }

    PalavaSignaling.prototype.connect = function() {
      if (this.connect_p == null) {
        this.connect_p = this.channel.connect().then((function(_this) {
          return function() {
            return _this.channel.send({
              event: 'join_room',
              room_id: room,
              status: status
            });
          };
        })(this));
      }
      return this.connect_p;
    };

    PalavaSignaling.prototype.set_status = function(status) {
      return this.channel.send({
        event: 'update_status',
        status: status
      });
    };

    PalavaSignaling.prototype.leave = function() {
      return this.channel.close();
    };

    return PalavaSignaling;

  })(Signaling);

}).call(this);

},{"../internal/promise":8,"./signaling":19}],19:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.signaling
   */


  /**
   * Concept of a class implementing signaling. Might use a `rtc.signaling.Channel` to abstract the connection to the server.
  #
   * You do not have to extend this claass, just implement the functionality.
  #
   * @extends events.EventEmitter
   * @class rtc.signaling.Signaling
   */

  exports.Signaling = (function(superClass) {
    extend(Signaling, superClass);

    function Signaling() {
      return Signaling.__super__.constructor.apply(this, arguments);
    }


    /**
     * A new peer joined the room
     * @event peer_joined
     * @param {rtc.signaling.SignalingPeer} peer The new peer
     */


    /**
     * The connection to the signaling server was closed
     * @event closed
     */


    /**
     * Establishes the connection with the signaling server
     * @method connect
     * @return {Promise} Promise which is resolved when the connection is established
     */

    Signaling.prototype.connect = function() {
      throw new Error("Not implemented");
    };


    /**
     * Closes the connection to the signaling server
     * @method close
     */

    Signaling.prototype.close = function() {
      throw new Error("Not implemented");
    };


    /**
     * Sets the local status object and broadcasts the change to the peers
     * @method setStatus
     * @param {Object} obj New status object
     */

    Signaling.prototype.setStatus = function(obj) {
      throw new Error("Not implemented");
    };

    return Signaling;

  })(EventEmitter);


  /**
   * Concept of a class implementing a signaling connection to a peer.
  #
   * You do not have to extend this class, just implement the functionality.
  #
   * @extends events.EventEmitter
   * @class rtc.signaling.SignalingPeer
   */

  exports.SignalingPeer = (function(superClass) {
    extend(SignalingPeer, superClass);

    function SignalingPeer() {
      return SignalingPeer.__super__.constructor.apply(this, arguments);
    }


    /**
     * The remote peer left the room
     * @event left
     */


    /**
     * Received a message from the remote peer
     * @event message
     * @param {String} event ID of the event
     * @param {Obejct} data Payload of the event
     */


    /**
     * The status object of the remote peer was updated
     * @event status_changed
     * @param {Object} status The new status
     */


    /**
     * The status object of the remote peer
     * @property status
     * @type Object
     * @readonly
     */


    /**
     * Whether the local user was in the room before the remote user (used to determine which peer will initiate the connection)
     * @property first
     * @type Boolean
     * @readonly
     */


    /**
     * Sends the event with the given payload to the remote peer
     * @method send
     * @param {String} event The id of the event
     * @param {Object} data The payload of the event
     * @return {Promise} Promise which will be resolved once the message is sent
     */

    SignalingPeer.prototype.send = function(event, data) {
      if (data == null) {
        data = {};
      }
      throw new Error("Not implemented");
    };

    return SignalingPeer;

  })(EventEmitter);


  /**
   * Concept of a class implementing a signaling channel. Might be used by signaling implementations to connect to a signaling server.
  #
   * You do not have to extend this class, just implement the functionality.
  #
   * @extends events.EventEmitter
   * @class rtc.signaling.Channel
   */

  exports.Channel = (function(superClass) {
    extend(Channel, superClass);

    function Channel() {
      return Channel.__super__.constructor.apply(this, arguments);
    }


    /**
     * A message was received from the signaling server
     * @event message
     * @param {Object} msg The received message
     */


    /**
     * The connection to the signaling server was closed
     * @event closed
     */


    /**
     * Establishes the connection with the signaling server
     * @method connect
     * @return {Promise} Promise which is resolved when the connection is established
     */

    Channel.prototype.connect = function() {
      throw new Error("Not implemented");
    };


    /**
     * Sends a message to the signaling server
     * @method send
     * @param {Object} msg The message to send
     * @return {Promise} Promise which is resolved when the message is sent
     */

    Channel.prototype.send = function(msg) {
      throw new Error("Not implemented");
    };


    /**
     * Closes the connection to the signaling server
     * @method close
     */

    Channel.prototype.close = function() {
      throw new Error("Not implemented");
    };

    return Channel;

  })(EventEmitter);

}).call(this);

},{"events":1}],20:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Channel, Promise,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  Promise = require('../internal/promise').Promise;

  Channel = require('./signaling').Channel;


  /**
   * @module rtc.signaling
   */


  /**
   * @class rtc.signaling.WebSocketChannel
   * @extends rtc.signaling.Channel
   */

  exports.WebSocketChannel = (function(superClass) {
    extend(WebSocketChannel, superClass);

    function WebSocketChannel() {
      var address, i, len, part, parts;
      address = arguments[0], parts = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      this.address = address;
      if (parts.length > 0) {
        while (this.address.endsWith('/')) {
          this.address = this.address.substr(0, this.address.length - 1);
        }
        for (i = 0, len = parts.length; i < len; i++) {
          part = parts[i];
          this.address += '/' + encodeUriComponent(part);
        }
      }
    }

    WebSocketChannel.prototype.connect = function() {
      if (this.connect_p == null) {
        this.connect_p = new Promise((function(_this) {
          return function(resolve, reject) {
            var socket;
            socket = new WebSocket(_this.address);
            socket.onopen = function() {
              _this.socket = socket;
              return resolve();
            };
            socket.onerror = function(err) {
              delete _this.socket;
              _this.emit('error', err);
              return reject(new Error("Unable to connect to socket"));
            };
            socket.onmessage = function(event) {
              var data;
              try {
                data = JSON.parse(event.data);
              } catch (_error) {
                _this.emit('error', "Unable to parse incoming message");
                return;
              }
              return _this.emit('message', data);
            };
            return socket.onclose = function() {
              return _this.emit('closed');
            };
          };
        })(this));
      }
      return this.connect_p;
    };

    WebSocketChannel.prototype.send = function(msg) {
      var err;
      if (this.socket != null) {
        try {
          this.socket.send(JSON.stringify(msg));
          return Promise.resolve();
        } catch (_error) {
          err = _error;
          return Promise.reject(err);
        }
      } else {
        return Promise.reject(new Error("Trying to send on WebSocket without being connected"));
      }
    };

    WebSocketChannel.prototype.close = function() {
      var err;
      if (this.socket != null) {
        try {
          this.socket.close();
          return Promise.resolve();
        } catch (_error) {
          err = _error;
          return Promise.reject(err);
        }
      } else {
        return Promise.reject(new Error("Trying to close WebSocket without being connected"));
      }
    };

    return WebSocketChannel;

  })(Channel);

}).call(this);

},{"../internal/promise":8,"./signaling":19}],21:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter, compat,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  compat = require('./compat').compat;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc
   */


  /**
   * A wrapper around an HTML5 MediaStream
   * @class rtc.Stream
  #
   * @constructor
   * @param {RTCDataStream} stream The native stream
   */

  exports.Stream = (function(superClass) {
    extend(Stream, superClass);


    /**
     * Emitted when tracks are muted or unmuted. Only triggered when changes are
     * made through this objects mute functions.
     * @event mute_changed
     * @param {'audio' | 'video' | 'both'} type The type of tracks which changed
     * @param {Boolean} muted `true` if tracks were muted, `false` if they were unmuted
     */

    function Stream(stream) {
      this.stream = stream;
    }


    /**
     * Get the id of the stream. This is neither user defined nor human readable.
     * @method id
     * @return {String} The id of the underlying stream
     */

    Stream.prototype.id = function() {
      return this.stream.id;
    };


    /**
     * Checks whether the stream has any tracks of the given type
     * @method hasTracks
     * @param {'audio' | 'video' | 'both'} [type='both'] The type of track to check for
     * @return {Number} The amount of tracks of the given type
     */

    Stream.prototype.hasTracks = function(type) {
      return this.getTracks(type).length;
    };


    /**
     * Gets the tracks of the given type
     * @method getTracks
     * @param {'audio' | 'video' | 'both'} [type='both'] The type of tracks to get
     * @return {Array} An Array of the tracks
     */

    Stream.prototype.getTracks = function(type) {
      var vaudio, video;
      type = type.toLowerCase();
      if (type === 'audio') {
        return this.stream.getAudioTracks();
      } else if (type === 'video') {
        return this.stream.getVideoTracks();
      } else if (type === 'both') {
        video = this.stream.getVideoTracks();
        vaudio = this.stream.getAudioTracks();
        return video.concat(audio);
      } else {
        throw new Error("Invalid stream part '" + type + "'");
      }
    };


    /**
     * Checks whether a type of track is muted. If there are no tracks of the
     * specified type they will be considered muted
     * @param {'audio' | 'video' | 'both'} [type='audio'] The type of tracks
     * @return {Boolean} Whether the tracks are muted
     */

    Stream.prototype.muted = function(type) {
      var ref, tracks;
      if (type == null) {
        type = 'audio';
      }
      tracks = this.getTracks(type);
      if (tracks.length < 1) {
        return true;
      }
      return !((ref = tracks[0]) != null ? ref.enabled : void 0);
    };


    /**
     * Mutes or unmutes tracks of the stream
     * @method mute
     * @param {Boolean} [muted=true] Mute on `true` and unmute on `false`
     * @param {'audio' | 'video' | 'both'} [type='audio'] The type of tracks to mute or unmute
     * @return {Boolean} Whether the tracks were muted or unmuted
     */

    Stream.prototype.mute = function(muted, type) {
      var i, len, ref, track;
      if (muted == null) {
        muted = true;
      }
      if (type == null) {
        type = 'audio';
      }
      ref = this.getTracks(type);
      for (i = 0, len = ref.length; i < len; i++) {
        track = ref[i];
        track.enabled = !muted;
      }
      this.emit('mute_changed', type, muted);
      return muted;
    };


    /**
     * Toggles the mute state of tracks of the stream
     * @method toggleMute
     * @param {'audio' | 'video' | 'both'} [type='audio'] The type of tracks to mute or unmute
     * @return {Boolean} Whether the tracks were muted or unmuted
     */

    Stream.prototype.toggleMute = function(type) {
      var i, len, muted, ref, track, tracks;
      if (type == null) {
        type = 'audio';
      }
      tracks = this.getTracks(type);
      if (tracks.length < 1) {
        return true;
      }
      muted = !((ref = tracks[0]) != null ? ref.enabled : void 0);
      for (i = 0, len = tracks.length; i < len; i++) {
        track = tracks[i];
        track.enabled = !muted;
      }
      this.emit('mute_changed', type, muted);
      return muted;
    };


    /**
     * Stops the stream
     * @method stop
     */

    Stream.prototype.stop = function() {
      var i, len, ref, results, track;
      if (this.stream.getTracks != null) {
        ref = this.stream.getTracks();
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          track = ref[i];
          results.push(track.stop());
        }
        return results;
      } else {
        return this.stream.stop();
      }
    };


    /**
     * Clones the stream. You can change both streams independently, for example
     * mute tracks. You will have to `stop()` both streams individually when you
     * are done.
    #
     * This is currently not supported in Firefox and expected to be implemented
     * in version 47. Use `Stream.canClone()` to check whether cloning is supported by
     * your browser.
    #
     * @method clone
     * @return {rtc.Stream} A clone of the stream
     */

    Stream.prototype.clone = function() {
      if (this.stream.clone == null) {
        throw new Error("Your browser does not support stream cloning. Firefox is expected to implement it in version 47.");
      }
      return new Stream(this.stream.clone());
    };


    /**
     * Checks whether cloning stream is supported by the browser. See `clone()`
     * for details
     * @static
     * @method canClone
     * @return {Boolean} `true` if cloning is supported, `false` otherwise
     */

    Stream.canClone = function() {
      return compat.MediaStream.prototype.clone != null;
    };


    /**
     * Creates a stream using `getUserMedia()`
     * @method createStream
     * @static
     * @param {Object} [config={audio: true, video: true}] The configuration to pass to `getUserMedia()`
     * @return {Promise -> rtc.Stream} Promise to the stream
    #
     * @example
     *     var stream = rtc.Stream.createStream({audio: true, video: false});
     *     rtc.MediaDomElement($('video'), stream);
     */

    Stream.createStream = function(config) {
      if (config == null) {
        config = {
          audio: true,
          video: true
        };
      }
      return new Promise(function(resolve, reject) {
        var success;
        success = function(native_stream) {
          return resolve(new Stream(native_stream));
        };
        return compat.getUserMedia(config, success, reject);
      });
    };

    return Stream;

  })(EventEmitter);

}).call(this);

},{"./compat":5,"events":1}],22:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Peer, Stream;

  Stream = require('./stream').Stream;

  Peer = require('./peer').Peer;


  /**
   * @module rtc
   */


  /**
   * @class rtc.MediaDomElement
   */

  exports.MediaDomElement = (function() {
    function MediaDomElement(dom, data) {
      this.dom = dom;
      if (this.dom.jquery != null) {
        this.dom = this.dom[0];
      }
      this.attach(data);
    }

    MediaDomElement.prototype.attach = function(data) {
      if (data == null) {
        delete this.stream;
        this.dom.pause();
        return this.dom.src = null;
      } else if (data instanceof Stream) {
        this.stream = data;
        if (typeof mozGetUserMedia !== "undefined" && mozGetUserMedia !== null) {
          this.dom.mozSrcObject = data.stream;
        } else {
          this.dom.src = URL.createObjectURL(data.stream);
        }
        return this.dom.play();
      } else if (data instanceof Peer) {
        if (data.isLocal()) {
          this.mute();
        }
        return this.attach(data.stream());
      } else if ((data != null ? data.then : void 0) != null) {
        return data.then((function(_this) {
          return function(res) {
            return _this.attach(res);
          };
        })(this))["catch"]((function(_this) {
          return function(err) {
            return _this.error(err);
          };
        })(this));
      } else {
        return this.error("Tried to attach invalid data");
      }
    };

    MediaDomElement.prototype.error = function(err) {
      return console.log(err);
    };

    MediaDomElement.prototype.clear = function() {
      return this.attach();
    };

    MediaDomElement.prototype.mute = function(muted) {
      if (muted == null) {
        muted = true;
      }
      return this.dom.muted = muted;
    };

    MediaDomElement.prototype.toggleMute = function() {
      return this.dom.muted = !this.dom.muted;
    };

    return MediaDomElement;

  })();

}).call(this);

},{"./peer":12,"./stream":21}]},{},[10])(10)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCJzcmMvY29tcGF0LmNvZmZlZSIsInNyYy9kYXRhX2NoYW5uZWwuY29mZmVlIiwic3JjL2ludGVybmFsL2NoYW5uZWxfY29sbGVjdGlvbi5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvcHJvbWlzZS5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24uY29mZmVlIiwic3JjL2xpYi5jb2ZmZWUiLCJzcmMvbG9jYWxfcGVlci5jb2ZmZWUiLCJzcmMvcGVlci5jb2ZmZWUiLCJzcmMvcGVlcl9jb25uZWN0aW9uLmNvZmZlZSIsInNyYy9yZW1vdGVfcGVlci5jb2ZmZWUiLCJzcmMvcm9vbS5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL2NhbGxpbmdfc2lnbmFsaW5nLmNvZmZlZSIsInNyYy9zaWduYWxpbmcvbXVjX3NpZ25hbGluZy5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwuY29mZmVlIiwic3JjL3N0cmVhbS5jb2ZmZWUiLCJzcmMvdmlkZW9fZWxlbWVudC5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3Y4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdDhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyohXG4gKiBAb3ZlcnZpZXcgZXM2LXByb21pc2UgLSBhIHRpbnkgaW1wbGVtZW50YXRpb24gb2YgUHJvbWlzZXMvQSsuXG4gKiBAY29weXJpZ2h0IENvcHlyaWdodCAoYykgMjAxNCBZZWh1ZGEgS2F0eiwgVG9tIERhbGUsIFN0ZWZhbiBQZW5uZXIgYW5kIGNvbnRyaWJ1dG9ycyAoQ29udmVyc2lvbiB0byBFUzYgQVBJIGJ5IEpha2UgQXJjaGliYWxkKVxuICogQGxpY2Vuc2UgICBMaWNlbnNlZCB1bmRlciBNSVQgbGljZW5zZVxuICogICAgICAgICAgICBTZWUgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2pha2VhcmNoaWJhbGQvZXM2LXByb21pc2UvbWFzdGVyL0xJQ0VOU0VcbiAqIEB2ZXJzaW9uICAgMy4wLjJcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJyB8fCAodHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGwpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbic7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc01heWJlVGhlbmFibGUoeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5O1xuICAgIGlmICghQXJyYXkuaXNBcnJheSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheSA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5ID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9IDA7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm47XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuXSA9IGNhbGxiYWNrO1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2xpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gKyAxXSA9IGFyZztcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gKz0gMjtcbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID09PSAyKSB7XG4gICAgICAgIC8vIElmIGxlbiBpcyAyLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAgICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAgICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgICAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2goKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0QXNhcChhc2FwRm4pIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwID0gYXNhcEZuO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgfHwge307XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSA9IHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7XG5cbiAgICAvLyB0ZXN0IGZvciB3ZWIgd29ya2VyIGJ1dCBub3QgaW4gSUUxMFxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNXb3JrZXIgPSB0eXBlb2YgVWludDhDbGFtcGVkQXJyYXkgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICB0eXBlb2YgaW1wb3J0U2NyaXB0cyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7XG5cbiAgICAvLyBub2RlXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU5leHRUaWNrKCkge1xuICAgICAgLy8gbm9kZSB2ZXJzaW9uIDAuMTAueCBkaXNwbGF5cyBhIGRlcHJlY2F0aW9uIHdhcm5pbmcgd2hlbiBuZXh0VGljayBpcyB1c2VkIHJlY3Vyc2l2ZWx5XG4gICAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2N1am9qcy93aGVuL2lzc3Vlcy80MTAgZm9yIGRldGFpbHNcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyB2ZXJ0eFxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VWZXJ0eFRpbWVyKCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0KGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuICAgICAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICAgICAgdmFyIG9ic2VydmVyID0gbmV3IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlcihsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gICAgICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBub2RlLmRhdGEgPSAoaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDIpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyB3ZWIgd29ya2VyXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU1lc3NhZ2VDaGFubmVsKCkge1xuICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICAgIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNldFRpbWVvdXQobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoLCAxKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZSA9IG5ldyBBcnJheSgxMDAwKTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2goKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW47IGkrPTIpIHtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2ldO1xuICAgICAgICB2YXIgYXJnID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2krMV07XG5cbiAgICAgICAgY2FsbGJhY2soYXJnKTtcblxuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpKzFdID0gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXR0ZW1wdFZlcnR4KCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIHIgPSByZXF1aXJlO1xuICAgICAgICB2YXIgdmVydHggPSByKCd2ZXJ0eCcpO1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0ID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VWZXJ0eFRpbWVyKCk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoO1xuICAgIC8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG4gICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc05vZGUpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU5leHRUaWNrKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU11dGF0aW9uT2JzZXJ2ZXIoKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc1dvcmtlcikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTWVzc2FnZUNoYW5uZWwoKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93ID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGF0dGVtcHRWZXJ0eCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCgpIHt9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAgID0gdm9pZCAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgPSAxO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCAgPSAyO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKHByb21pc2UpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW47XG4gICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yID0gZXJyb3I7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlUaGVuKHRoZW4sIHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUsIHRoZW4pIHtcbiAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHZhciBzZWFsZWQgPSBmYWxzZTtcbiAgICAgICAgdmFyIGVycm9yID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB0aGVuYWJsZSwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2VhbGVkKSB7IHJldHVybjsgfVxuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0sICdTZXR0bGU6ICcgKyAocHJvbWlzZS5fbGFiZWwgfHwgJyB1bmtub3duIHByb21pc2UnKSk7XG5cbiAgICAgICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gICAgICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSkge1xuICAgICAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgdGhlbiA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGdldFRoZW4obWF5YmVUaGVuYWJsZSk7XG5cbiAgICAgICAgaWYgKHRoZW4gPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSk7XG4gICAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkb2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgICAgIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaChwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHsgcmV0dXJuOyB9XG5cbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHZhbHVlO1xuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQ7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRDtcbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIGxlbmd0aCA9IHN1YnNjcmliZXJzLmxlbmd0aDtcblxuICAgICAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGggKyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRF0gID0gb25SZWplY3Rpb247XG5cbiAgICAgIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoLCBwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSkge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG4gICAgICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gICAgICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgICB2YXIgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICAgICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpIHtcbiAgICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IgPSBuZXcgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGU7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICAgICAgdmFyIGhhc0NhbGxiYWNrID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gICAgICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICAgICAgdmFsdWUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKTtcblxuICAgICAgICBpZiAodmFsdWUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgZXJyb3IgPSB2YWx1ZS5lcnJvcjtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRjYW5ub3RSZXR1cm5Pd24oKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gZGV0YWlsO1xuICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgLy8gbm9vcFxuICAgICAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW5pdGlhbGl6ZVByb21pc2UocHJvbWlzZSwgcmVzb2x2ZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKXtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICBlbnVtZXJhdG9yLl9pbnN0YW5jZUNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG4gICAgICBlbnVtZXJhdG9yLnByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG5cbiAgICAgIGlmIChlbnVtZXJhdG9yLl92YWxpZGF0ZUlucHV0KGlucHV0KSkge1xuICAgICAgICBlbnVtZXJhdG9yLl9pbnB1dCAgICAgPSBpbnB1dDtcbiAgICAgICAgZW51bWVyYXRvci5sZW5ndGggICAgID0gaW5wdXQubGVuZ3RoO1xuICAgICAgICBlbnVtZXJhdG9yLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cbiAgICAgICAgZW51bWVyYXRvci5faW5pdCgpO1xuXG4gICAgICAgIGlmIChlbnVtZXJhdG9yLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwoZW51bWVyYXRvci5wcm9taXNlLCBlbnVtZXJhdG9yLl9yZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVudW1lcmF0b3IubGVuZ3RoID0gZW51bWVyYXRvci5sZW5ndGggfHwgMDtcbiAgICAgICAgICBlbnVtZXJhdG9yLl9lbnVtZXJhdGUoKTtcbiAgICAgICAgICBpZiAoZW51bWVyYXRvci5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKGVudW1lcmF0b3IucHJvbWlzZSwgZW51bWVyYXRvci5fcmVzdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChlbnVtZXJhdG9yLnByb21pc2UsIGVudW1lcmF0b3IuX3ZhbGlkYXRpb25FcnJvcigpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3ZhbGlkYXRlSW5wdXQgPSBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheShpbnB1dCk7XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fdmFsaWRhdGlvbkVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuICAgIH07XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcjtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIHZhciBsZW5ndGggID0gZW51bWVyYXRvci5sZW5ndGg7XG4gICAgICB2YXIgcHJvbWlzZSA9IGVudW1lcmF0b3IucHJvbWlzZTtcbiAgICAgIHZhciBpbnB1dCAgID0gZW51bWVyYXRvci5faW5wdXQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAmJiBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZW51bWVyYXRvci5fZWFjaEVudHJ5KGlucHV0W2ldLCBpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbihlbnRyeSwgaSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuICAgICAgdmFyIGMgPSBlbnVtZXJhdG9yLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuXG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc01heWJlVGhlbmFibGUoZW50cnkpKSB7XG4gICAgICAgIGlmIChlbnRyeS5jb25zdHJ1Y3RvciA9PT0gYyAmJiBlbnRyeS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgICBlbnRyeS5fb25lcnJvciA9IG51bGw7XG4gICAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGVudHJ5Ll9zdGF0ZSwgaSwgZW50cnkuX3Jlc3VsdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bWVyYXRvci5fd2lsbFNldHRsZUF0KGMucmVzb2x2ZShlbnRyeSksIGkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnVtZXJhdG9yLl9yZW1haW5pbmctLTtcbiAgICAgICAgZW51bWVyYXRvci5fcmVzdWx0W2ldID0gZW50cnk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24oc3RhdGUsIGksIHZhbHVlKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG4gICAgICB2YXIgcHJvbWlzZSA9IGVudW1lcmF0b3IucHJvbWlzZTtcblxuICAgICAgaWYgKHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3JlbWFpbmluZy0tO1xuXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVudW1lcmF0b3IuX3Jlc3VsdFtpXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChlbnVtZXJhdG9yLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCBlbnVtZXJhdG9yLl9yZXN1bHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3dpbGxTZXR0bGVBdCA9IGZ1bmN0aW9uKHByb21pc2UsIGkpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHByb21pc2UsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCwgaSwgcmVhc29uKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRhbGwoZW50cmllcykge1xuICAgICAgcmV0dXJuIG5ldyBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkZGVmYXVsdCh0aGlzLCBlbnRyaWVzKS5wcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRhbGw7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkcmFjZShlbnRyaWVzKSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG5cbiAgICAgIGlmICghbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJykpO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGxlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuXG4gICAgICBmdW5jdGlvbiBvbkZ1bGZpbGxtZW50KHZhbHVlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBvblJlamVjdGlvbihyZWFzb24pIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAmJiBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKENvbnN0cnVjdG9yLnJlc29sdmUoZW50cmllc1tpXSksIHVuZGVmaW5lZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRyYWNlO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJHJlc29sdmUob2JqZWN0KSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICAgICAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IENvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICB9XG5cbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCBvYmplY3QpO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkcmVzb2x2ZTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJHJlamVjdChyZWFzb24pIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRyZWplY3Q7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGNvdW50ZXIgPSAwO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzUmVzb2x2ZXIoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzTmV3KCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZTtcbiAgICAvKipcbiAgICAgIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcbiAgICAgIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gICAgICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cbiAgICAgIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBUZXJtaW5vbG9neVxuICAgICAgLS0tLS0tLS0tLS1cblxuICAgICAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cbiAgICAgIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgICAgIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cbiAgICAgIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuICAgICAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAgICAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cbiAgICAgIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblxuICAgICAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgICAgIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcbiAgICAgIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXG4gICAgICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgICAgIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3NcbiAgICAgIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuICAgICAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICAgICAgaXRzZWxmIGZ1bGZpbGwuXG5cblxuICAgICAgQmFzaWMgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgYGBganNcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAgICAgLy8gb24gZmFpbHVyZVxuICAgICAgICByZWplY3QocmVhc29uKTtcbiAgICAgIH0pO1xuXG4gICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAvLyBvbiByZWplY3Rpb25cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIFVzYWdlOlxuICAgICAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcbiAgICAgIGBYTUxIdHRwUmVxdWVzdGBzLlxuXG4gICAgICBgYGBqc1xuICAgICAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG4gICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICB4aHIuc2VuZCgpO1xuXG4gICAgICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblxuICAgICAgYGBganNcbiAgICAgIFByb21pc2UuYWxsKFtcbiAgICAgICAgZ2V0SlNPTignL3Bvc3RzJyksXG4gICAgICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gICAgICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG4gICAgICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cbiAgICAgICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAY2xhc3MgUHJvbWlzZVxuICAgICAgQHBhcmFtIHtmdW5jdGlvbn0gcmVzb2x2ZXJcbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEBjb25zdHJ1Y3RvclxuICAgICovXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UocmVzb2x2ZXIpIHtcbiAgICAgIHRoaXMuX2lkID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGNvdW50ZXIrKztcbiAgICAgIHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fcmVzdWx0ID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AgIT09IHJlc29sdmVyKSB7XG4gICAgICAgIGlmICghbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHJlc29sdmVyKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc1Jlc29sdmVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UpKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzTmV3KCk7XG4gICAgICAgIH1cblxuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbml0aWFsaXplUHJvbWlzZSh0aGlzLCByZXNvbHZlcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuYWxsID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnJhY2UgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnJlc29sdmUgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnJlamVjdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fc2V0U2NoZWR1bGVyID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldFNjaGVkdWxlcjtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fc2V0QXNhcCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRBc2FwO1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9hc2FwID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXA7XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5wcm90b3R5cGUgPSB7XG4gICAgICBjb25zdHJ1Y3RvcjogbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UsXG5cbiAgICAvKipcbiAgICAgIFRoZSBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLFxuICAgICAgd2hpY2ggcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGVcbiAgICAgIHJlYXNvbiB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgLy8gdXNlciBpcyBhdmFpbGFibGVcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHVzZXIgaXMgdW5hdmFpbGFibGUsIGFuZCB5b3UgYXJlIGdpdmVuIHRoZSByZWFzb24gd2h5XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBDaGFpbmluZ1xuICAgICAgLS0tLS0tLS1cblxuICAgICAgVGhlIHJldHVybiB2YWx1ZSBvZiBgdGhlbmAgaXMgaXRzZWxmIGEgcHJvbWlzZS4gIFRoaXMgc2Vjb25kLCAnZG93bnN0cmVhbSdcbiAgICAgIHByb21pc2UgaXMgcmVzb2x2ZWQgd2l0aCB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmaXJzdCBwcm9taXNlJ3MgZnVsZmlsbG1lbnRcbiAgICAgIG9yIHJlamVjdGlvbiBoYW5kbGVyLCBvciByZWplY3RlZCBpZiB0aGUgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiB1c2VyLm5hbWU7XG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHJldHVybiAnZGVmYXVsdCBuYW1lJztcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHVzZXJOYW1lKSB7XG4gICAgICAgIC8vIElmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgdXNlck5hbWVgIHdpbGwgYmUgdGhlIHVzZXIncyBuYW1lLCBvdGhlcndpc2UgaXRcbiAgICAgICAgLy8gd2lsbCBiZSBgJ2RlZmF1bHQgbmFtZSdgXG4gICAgICB9KTtcblxuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknKTtcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jyk7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIGlmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgcmVhc29uYCB3aWxsIGJlICdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScuXG4gICAgICAgIC8vIElmIGBmaW5kVXNlcmAgcmVqZWN0ZWQsIGByZWFzb25gIHdpbGwgYmUgJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknLlxuICAgICAgfSk7XG4gICAgICBgYGBcbiAgICAgIElmIHRoZSBkb3duc3RyZWFtIHByb21pc2UgZG9lcyBub3Qgc3BlY2lmeSBhIHJlamVjdGlvbiBoYW5kbGVyLCByZWplY3Rpb24gcmVhc29ucyB3aWxsIGJlIHByb3BhZ2F0ZWQgZnVydGhlciBkb3duc3RyZWFtLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBQZWRhZ29naWNhbEV4Y2VwdGlvbignVXBzdHJlYW0gZXJyb3InKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gVGhlIGBQZWRnYWdvY2lhbEV4Y2VwdGlvbmAgaXMgcHJvcGFnYXRlZCBhbGwgdGhlIHdheSBkb3duIHRvIGhlcmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFzc2ltaWxhdGlvblxuICAgICAgLS0tLS0tLS0tLS0tXG5cbiAgICAgIFNvbWV0aW1lcyB0aGUgdmFsdWUgeW91IHdhbnQgdG8gcHJvcGFnYXRlIHRvIGEgZG93bnN0cmVhbSBwcm9taXNlIGNhbiBvbmx5IGJlXG4gICAgICByZXRyaWV2ZWQgYXN5bmNocm9ub3VzbHkuIFRoaXMgY2FuIGJlIGFjaGlldmVkIGJ5IHJldHVybmluZyBhIHByb21pc2UgaW4gdGhlXG4gICAgICBmdWxmaWxsbWVudCBvciByZWplY3Rpb24gaGFuZGxlci4gVGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIHRoZW4gYmUgcGVuZGluZ1xuICAgICAgdW50aWwgdGhlIHJldHVybmVkIHByb21pc2UgaXMgc2V0dGxlZC4gVGhpcyBpcyBjYWxsZWQgKmFzc2ltaWxhdGlvbiouXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgICAgLy8gVGhlIHVzZXIncyBjb21tZW50cyBhcmUgbm93IGF2YWlsYWJsZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgSWYgdGhlIGFzc2ltbGlhdGVkIHByb21pc2UgcmVqZWN0cywgdGhlbiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgYWxzbyByZWplY3QuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCBmdWxmaWxscywgd2UnbGwgaGF2ZSB0aGUgdmFsdWUgaGVyZVxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIHJlamVjdHMsIHdlJ2xsIGhhdmUgdGhlIHJlYXNvbiBoZXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBTaW1wbGUgRXhhbXBsZVxuICAgICAgLS0tLS0tLS0tLS0tLS1cblxuICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICB2YXIgcmVzdWx0O1xuXG4gICAgICB0cnkge1xuICAgICAgICByZXN1bHQgPSBmaW5kUmVzdWx0KCk7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH1cbiAgICAgIGBgYFxuXG4gICAgICBFcnJiYWNrIEV4YW1wbGVcblxuICAgICAgYGBganNcbiAgICAgIGZpbmRSZXN1bHQoZnVuY3Rpb24ocmVzdWx0LCBlcnIpe1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgUHJvbWlzZSBFeGFtcGxlO1xuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICBmaW5kUmVzdWx0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBZHZhbmNlZCBFeGFtcGxlXG4gICAgICAtLS0tLS0tLS0tLS0tLVxuXG4gICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIHZhciBhdXRob3IsIGJvb2tzO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhdXRob3IgPSBmaW5kQXV0aG9yKCk7XG4gICAgICAgIGJvb2tzICA9IGZpbmRCb29rc0J5QXV0aG9yKGF1dGhvcik7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH1cbiAgICAgIGBgYFxuXG4gICAgICBFcnJiYWNrIEV4YW1wbGVcblxuICAgICAgYGBganNcblxuICAgICAgZnVuY3Rpb24gZm91bmRCb29rcyhib29rcykge1xuXG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGZhaWx1cmUocmVhc29uKSB7XG5cbiAgICAgIH1cblxuICAgICAgZmluZEF1dGhvcihmdW5jdGlvbihhdXRob3IsIGVycil7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmaW5kQm9vb2tzQnlBdXRob3IoYXV0aG9yLCBmdW5jdGlvbihib29rcywgZXJyKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGZvdW5kQm9va3MoYm9va3MpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgICBmYWlsdXJlKHJlYXNvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgUHJvbWlzZSBFeGFtcGxlO1xuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICBmaW5kQXV0aG9yKCkuXG4gICAgICAgIHRoZW4oZmluZEJvb2tzQnlBdXRob3IpLlxuICAgICAgICB0aGVuKGZ1bmN0aW9uKGJvb2tzKXtcbiAgICAgICAgICAvLyBmb3VuZCBib29rc1xuICAgICAgfSkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBtZXRob2QgdGhlblxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25GdWxmaWxsZWRcbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWRcbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICAgKi9cbiAgICAgIHRoZW46IGZ1bmN0aW9uKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzO1xuICAgICAgICB2YXIgc3RhdGUgPSBwYXJlbnQuX3N0YXRlO1xuXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEICYmICFvbkZ1bGZpbGxtZW50IHx8IHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCAmJiAhb25SZWplY3Rpb24pIHtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGlsZCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgICB2YXIgcmVzdWx0ID0gcGFyZW50Ll9yZXN1bHQ7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW3N0YXRlIC0gMV07XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHN0YXRlLCBjaGlsZCwgY2FsbGJhY2ssIHJlc3VsdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGlsZDtcbiAgICAgIH0sXG5cbiAgICAvKipcbiAgICAgIGBjYXRjaGAgaXMgc2ltcGx5IHN1Z2FyIGZvciBgdGhlbih1bmRlZmluZWQsIG9uUmVqZWN0aW9uKWAgd2hpY2ggbWFrZXMgaXQgdGhlIHNhbWVcbiAgICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuICAgICAgfVxuXG4gICAgICAvLyBzeW5jaHJvbm91c1xuICAgICAgdHJ5IHtcbiAgICAgICAgZmluZEF1dGhvcigpO1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH1cblxuICAgICAgLy8gYXN5bmMgd2l0aCBwcm9taXNlc1xuICAgICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIGNhdGNoXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gICAgICB9XG4gICAgfTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJHBvbHlmaWxsKCkge1xuICAgICAgdmFyIGxvY2FsO1xuXG4gICAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBsb2NhbCA9IGdsb2JhbDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbG9jYWwgPSBzZWxmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHlmaWxsIGZhaWxlZCBiZWNhdXNlIGdsb2JhbCBvYmplY3QgaXMgdW5hdmFpbGFibGUgaW4gdGhpcyBlbnZpcm9ubWVudCcpO1xuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIFAgPSBsb2NhbC5Qcm9taXNlO1xuXG4gICAgICBpZiAoUCAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoUC5yZXNvbHZlKCkpID09PSAnW29iamVjdCBQcm9taXNlXScgJiYgIVAuY2FzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxvY2FsLlByb21pc2UgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdDtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkcG9seWZpbGw7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZSA9IHtcbiAgICAgICdQcm9taXNlJzogbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQsXG4gICAgICAncG9seWZpbGwnOiBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHRcbiAgICB9O1xuXG4gICAgLyogZ2xvYmFsIGRlZmluZTp0cnVlIG1vZHVsZTp0cnVlIHdpbmRvdzogdHJ1ZSAqL1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZVsnYW1kJ10pIHtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlWydleHBvcnRzJ10pIHtcbiAgICAgIG1vZHVsZVsnZXhwb3J0cyddID0gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpc1snRVM2UHJvbWlzZSddID0gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTtcbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHQoKTtcbn0pLmNhbGwodGhpcyk7XG5cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIGlzQXJyYXkoYXJyKSB7XG5cdGlmICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KGFycik7XG5cdH1cblxuXHRyZXR1cm4gdG9TdHIuY2FsbChhcnIpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuXHRpZiAoIW9iaiB8fCB0b1N0ci5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc093bkNvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcblx0dmFyIGhhc0lzUHJvdG90eXBlT2YgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuXHQvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG5cdGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc093bkNvbnN0cnVjdG9yICYmICFoYXNJc1Byb3RvdHlwZU9mKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG5cdC8vIGlmIGxhc3Qgb25lIGlzIG93biwgdGhlbiBhbGwgcHJvcGVydGllcyBhcmUgb3duLlxuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBvYmopIHsvKiovfVxuXG5cdHJldHVybiB0eXBlb2Yga2V5ID09PSAndW5kZWZpbmVkJyB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0dmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1swXSxcblx0XHRpID0gMSxcblx0XHRsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuXHRcdGRlZXAgPSBmYWxzZTtcblxuXHQvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG5cdGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnYm9vbGVhbicpIHtcblx0XHRkZWVwID0gdGFyZ2V0O1xuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcblx0XHQvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG5cdFx0aSA9IDI7XG5cdH0gZWxzZSBpZiAoKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnICYmIHR5cGVvZiB0YXJnZXQgIT09ICdmdW5jdGlvbicpIHx8IHRhcmdldCA9PSBudWxsKSB7XG5cdFx0dGFyZ2V0ID0ge307XG5cdH1cblxuXHRmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1tpXTtcblx0XHQvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG5cdFx0aWYgKG9wdGlvbnMgIT0gbnVsbCkge1xuXHRcdFx0Ly8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuXHRcdFx0Zm9yIChuYW1lIGluIG9wdGlvbnMpIHtcblx0XHRcdFx0c3JjID0gdGFyZ2V0W25hbWVdO1xuXHRcdFx0XHRjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuXHRcdFx0XHQvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG5cdFx0XHRcdGlmICh0YXJnZXQgIT09IGNvcHkpIHtcblx0XHRcdFx0XHQvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcblx0XHRcdFx0XHRpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IGlzQXJyYXkoY29weSkpKSkge1xuXHRcdFx0XHRcdFx0aWYgKGNvcHlJc0FycmF5KSB7XG5cdFx0XHRcdFx0XHRcdGNvcHlJc0FycmF5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuXHRcdFx0XHRcdC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjb3B5ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gY29weTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuXHRyZXR1cm4gdGFyZ2V0O1xufTtcblxuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuXG4vKipcbiAqIENvcmUgZnVuY3Rpb25hbGl0eVxuICogQG1vZHVsZSBydGNcbiAqIEBtYWluIHJ0Y1xuICovXG5cblxuLyoqXG4gKiBTaWduYWxpbmcgYW5kIHNpZ25hbGluZyBjaGFubmVsc1xuICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gKiBAbWFpbiBydGMuc2lnbmFsaW5nXG4gKi9cblxuXG4vKipcbiAqIEludGVybmFsIGhlbHBlcnNcbiAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gKiBAbWFpbiBydGMuaW50ZXJuYWxcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBiaW5kSGVscGVyLCBjb21wYXQ7XG5cbiAgYmluZEhlbHBlciA9IGZ1bmN0aW9uKG9iaiwgZnVuKSB7XG4gICAgaWYgKGZ1biA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybiBmdW4uYmluZChvYmopO1xuICB9O1xuXG4gIGV4cG9ydHMuY29tcGF0ID0gY29tcGF0ID0ge1xuICAgIFBlZXJDb25uZWN0aW9uOiB3aW5kb3cuUGVlckNvbm5lY3Rpb24gfHwgd2luZG93LndlYmtpdFBlZXJDb25uZWN0aW9uMDAgfHwgd2luZG93LndlYmtpdFJUQ1BlZXJDb25uZWN0aW9uIHx8IHdpbmRvdy5tb3pSVENQZWVyQ29ubmVjdGlvbixcbiAgICBJY2VDYW5kaWRhdGU6IHdpbmRvdy5SVENJY2VDYW5kaWRhdGUgfHwgd2luZG93Lm1velJUQ0ljZUNhbmRpZGF0ZSxcbiAgICBTZXNzaW9uRGVzY3JpcHRpb246IHdpbmRvdy5tb3pSVENTZXNzaW9uRGVzY3JpcHRpb24gfHwgd2luZG93LlJUQ1Nlc3Npb25EZXNjcmlwdGlvbixcbiAgICBNZWRpYVN0cmVhbTogd2luZG93Lk1lZGlhU3RyZWFtIHx8IHdpbmRvdy5tb3pNZWRpYVN0cmVhbSB8fCB3aW5kb3cud2Via2l0TWVkaWFTdHJlYW0sXG4gICAgZ2V0VXNlck1lZGlhOiBiaW5kSGVscGVyKG5hdmlnYXRvciwgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhKSxcbiAgICBzdXBwb3J0ZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIChjb21wYXQuUGVlckNvbm5lY3Rpb24gIT0gbnVsbCkgJiYgKGNvbXBhdC5JY2VDYW5kaWRhdGUgIT0gbnVsbCkgJiYgKGNvbXBhdC5TZXNzaW9uRGVzY3JpcHRpb24gIT0gbnVsbCkgJiYgKGNvbXBhdC5nZXRVc2VyTWVkaWEgIT0gbnVsbCk7XG4gICAgfVxuICB9O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9wcm9taXNlJyksIERlZmVycmVkID0gcmVmLkRlZmVycmVkLCBQcm9taXNlID0gcmVmLlByb21pc2U7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBmb3IgUlRDRGF0YUNoYW5uZWwuIFVzZWQgdG8gdHJhbnNmZXIgY3VzdG9tIGRhdGEgYmV0d2VlbiBwZWVycy5cbiAgICogQGNsYXNzIHJ0Yy5EYXRhQ2hhbm5lbFxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JUQ0RhdGFDaGFubmVsfSBjaGFubmVsIFRoZSB3cmFwcGVkIG5hdGl2ZSBkYXRhIGNoYW5uZWxcbiAgICogQHBhcmFtIHtOdW1iZXJ9IFttYXhfYnVmZmVyXSBUaGUgc2l6ZSBvZiB0aGUgc2VuZCBidWZmZXIgYWZ0ZXIgd2hpY2ggd2Ugd2lsbCBkZWxheSBzZW5kaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuRGF0YUNoYW5uZWwgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChEYXRhQ2hhbm5lbCwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IG1lc3NhZ2VzIHdhcyByZWNlaXZlZC4gVHJpZ2dlcnMgb25seSBhZnRlciBgY29ubmVjdCgpYCB3YXMgY2FsbGVkXG4gICAgICogQGV2ZW50IG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBkYXRhIFRoZSBkYXRhIHJlY2VpdmVkXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBjaGFubmVsIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBEYXRhQ2hhbm5lbChjaGFubmVsLCBtYXhfYnVmZmVyKSB7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5tYXhfYnVmZmVyID0gbWF4X2J1ZmZlciAhPSBudWxsID8gbWF4X2J1ZmZlciA6IDEwMjQgKiAxMDtcbiAgICAgIHRoaXMuX2Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5fY29ubmVjdF9xdWV1ZSA9IFtdO1xuICAgICAgdGhpcy5fc2VuZF9idWZmZXIgPSBbXTtcbiAgICAgIHRoaXMuY2hhbm5lbC5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICAgIHRoaXMuY2hhbm5lbC5vbm1lc3NhZ2UgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKCFfdGhpcy5fY29ubmVjdGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RfcXVldWUucHVzaChldmVudC5kYXRhKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ21lc3NhZ2UnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbmNsb3NlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbmVycm9yID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRvIHRoZSBEYXRhQ2hhbm5lbC4gWW91IHdpbGwgcmVjZWl2ZSBtZXNzYWdlcyBhbmQgd2lsbCBiZSBhYmxlIHRvIHNlbmQgYWZ0ZXIgY2FsbGluZyB0aGlzLlxuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggcmVzb2x2ZXMgYXMgc29vbiBhcyB0aGUgRGF0YUNoYW5uZWwgaXMgb3BlblxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkYXRhLCBpLCBsZW4sIHJlZjE7XG4gICAgICB0aGlzLl9jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgcmVmMSA9IHRoaXMuX2Nvbm5lY3RfcXVldWU7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByZWYxLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGRhdGEgPSByZWYxW2ldO1xuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0X3F1ZXVlO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH07XG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hhbm5lbC5jbG9zZSgpO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBsYWJlbCBvZiB0aGUgRGF0YUNoYW5uZWwgdXNlZCB0byBkaXN0aW5ndWlzaCBtdWx0aXBsZSBjaGFubmVsc1xuICAgICAqIEBtZXRob2QgbGFiZWxcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSBsYWJlbFxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmxhYmVsID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmxhYmVsO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNlbmQgZGF0YSB0byB0aGUgcGVlciB0aHJvdWdoIHRoZSBEYXRhQ2hhbm5lbFxuICAgICAqIEBtZXRob2Qgc2VuZFxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIGJlIHRyYW5zZmVycmVkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIHdoZW4gdGhlIGRhdGEgd2FzIHBhc3NlZCB0byB0aGUgbmF0aXZlIGRhdGEgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgZGVmZXI7XG4gICAgICBpZiAoIXRoaXMuX2Nvbm5lY3RlZCkge1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTZW5kaW5nIHdpdGhvdXQgYmVpbmcgY29ubmVjdGVkLiBQbGVhc2UgY2FsbCBjb25uZWN0KCkgb24gdGhlIGRhdGEgY2hhbm5lbCB0byBzdGFydCB1c2luZyBpdC5cIik7XG4gICAgICB9XG4gICAgICBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5fc2VuZF9idWZmZXIucHVzaChbZGF0YSwgZGVmZXJdKTtcbiAgICAgIGlmICh0aGlzLl9zZW5kX2J1ZmZlci5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgdGhpcy5fYWN0dWFsU2VuZCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTWV0aG9kIHdoaWNoIGFjdHVhbGx5IHNlbmRzIHRoZSBkYXRhLiBJbXBsZW1lbnRzIGJ1ZmZlcmluZ1xuICAgICAqIEBtZXRob2QgX2FjdHVhbFNlbmRcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLl9hY3R1YWxTZW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGF0YSwgZGVmZXIsIHJlZjEsIHJlZjIsIHJlc3VsdHM7XG4gICAgICBpZiAodGhpcy5jaGFubmVsLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICB3aGlsZSAodGhpcy5fc2VuZF9idWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKHRoaXMuY2hhbm5lbC5idWZmZXJlZEFtb3VudCA+PSB0aGlzLm1heF9idWZmZXIpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQodGhpcy5fYWN0dWFsU2VuZC5iaW5kKHRoaXMpLCAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVmMSA9IHRoaXMuX3NlbmRfYnVmZmVyWzBdLCBkYXRhID0gcmVmMVswXSwgZGVmZXIgPSByZWYxWzFdO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNoYW5uZWwuc2VuZChkYXRhKTtcbiAgICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQodGhpcy5fYWN0dWFsU2VuZC5iaW5kKHRoaXMpLCAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xuICAgICAgICAgIHRoaXMuX3NlbmRfYnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlbmRfYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICAgIHJlZjIgPSB0aGlzLl9zZW5kX2J1ZmZlci5zaGlmdCgpLCBkYXRhID0gcmVmMlswXSwgZGVmZXIgPSByZWYyWzFdO1xuICAgICAgICAgIHJlc3VsdHMucHVzaChkZWZlci5yZWplY3QobmV3IEVycm9yKFwiRGF0YUNoYW5uZWwgY2xvc2VkXCIpKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhQ2hhbm5lbDtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9wcm9taXNlJyksIERlZmVycmVkID0gcmVmLkRlZmVycmVkLCBQcm9taXNlID0gcmVmLlByb21pc2U7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEhlbHBlciB3aGljaCBoYW5kbGVzIERhdGFDaGFubmVsIG5lZ290aWF0aW9uIGZvciBSZW1vdGVQZWVyXG4gICAqIEBjbGFzcyBydGMuaW50ZXJuYWwuQ2hhbm5lbENvbGxlY3Rpb25cbiAgICovXG5cbiAgZXhwb3J0cy5DaGFubmVsQ29sbGVjdGlvbiA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKENoYW5uZWxDb2xsZWN0aW9uLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgZGF0YSBjaGFubmVsIGlzIGF2YWlsYWJsZVxuICAgICAqIEBldmVudCBkYXRhX2NoYW5uZWxfYWRkZWRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBjaGFubmVsXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIG9mIHRoZSBjaGFubmVsXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBDaGFubmVsQ29sbGVjdGlvbigpIHtcbiAgICAgIHRoaXMuY2hhbm5lbHMgPSB7fTtcbiAgICAgIHRoaXMuZGVmZXJzID0ge307XG4gICAgICB0aGlzLnBlbmRpbmcgPSB7fTtcbiAgICAgIHRoaXMud2FpdF9kID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLndhaXRfcCA9IHRoaXMud2FpdF9kLnByb21pc2U7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGxvY2FsIGNoYW5uZWwgZGVzY3JpcHRpb24uXG4gICAgICogQG1ldGhvZCBzZXRMb2NhbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIE9iamVjdCBkZXNjcmliaW5nIGVhY2ggb2ZmZXJlZCBEYXRhQ2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLnNldExvY2FsID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdGhpcy5sb2NhbCA9IGRhdGE7XG4gICAgICBpZiAodGhpcy5yZW1vdGUgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByZW1vdGUgY2hhbm5lbCBkZXNjcmlwdGlvbi5cbiAgICAgKiBAbWV0aG9kIHNldFJlbW90ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIE9iamVjdCBkZXNjcmliaW5nIGVhY2ggb2ZmZXJlZCBEYXRhQ2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLnNldFJlbW90ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHRoaXMucmVtb3RlID0gZGF0YTtcbiAgICAgIGlmICh0aGlzLmxvY2FsICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VwZGF0ZSgpO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE1hdGNoZXMgcmVtb3RlIGFuZCBsb2NhbCBkZXNjcmlwdGlvbnMgYW5kIGNyZWF0ZXMgcHJvbWlzZXMgY29tbW9uIERhdGFDaGFubmVsc1xuICAgICAqIEBtZXRob2QgX3VwZGF0ZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNoYW5uZWwsIGNvbmZpZywgZGVmZXIsIG5hbWUsIHJlZjE7XG4gICAgICByZWYxID0gdGhpcy5yZW1vdGU7XG4gICAgICBmb3IgKG5hbWUgaW4gcmVmMSkge1xuICAgICAgICBjb25maWcgPSByZWYxW25hbWVdO1xuICAgICAgICBpZiAodGhpcy5sb2NhbFtuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuY2hhbm5lbHNbbmFtZV0gIT0gbnVsbCkge1xuXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBlbmRpbmdbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY2hhbm5lbCA9IHRoaXMucGVuZGluZ1tuYW1lXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbbmFtZV07XG4gICAgICAgICAgICB0aGlzLmNoYW5uZWxzW25hbWVdID0gUHJvbWlzZS5yZXNvbHZlKGNoYW5uZWwpO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdkYXRhX2NoYW5uZWxfYWRkZWQnLCBuYW1lLCB0aGlzLmNoYW5uZWxzW25hbWVdKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbbmFtZV0gPSBkZWZlci5wcm9taXNlO1xuICAgICAgICAgICAgdGhpcy5kZWZlcnNbbmFtZV0gPSBkZWZlcjtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgdGhpcy5jaGFubmVsc1tuYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiRGF0YUNoYW5uZWwgb2ZmZXJlZCBieSByZW1vdGUgYnV0IG5vdCBieSBsb2NhbFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChuYW1lIGluIHRoaXMubG9jYWwpIHtcbiAgICAgICAgaWYgKHRoaXMucmVtb3RlW25hbWVdID09IG51bGwpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkRhdGFDaGFubmVsIG9mZmVyZWQgYnkgbG9jYWwgYnV0IG5vdCBieSByZW1vdGVcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLndhaXRfZC5yZXNvbHZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZXMgcHJvbWlzZXMgd2FpdGluZyBmb3IgdGhlIGdpdmVuIERhdGFDaGFubmVsXG4gICAgICogQG1ldGhvZCByZXNvbHZlXG4gICAgICogQHBhcmFtIHtEYXRhQ2hhbm5lbH0gY2hhbm5lbCBUaGUgbmV3IGNoYW5uZWxcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAgdmFyIGxhYmVsO1xuICAgICAgbGFiZWwgPSBjaGFubmVsLmxhYmVsKCk7XG4gICAgICBpZiAodGhpcy5kZWZlcnNbbGFiZWxdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZWZlcnNbbGFiZWxdLnJlc29sdmUoY2hhbm5lbCk7XG4gICAgICAgIHJldHVybiBkZWxldGUgdGhpcy5kZWZlcnNbbGFiZWxdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGVuZGluZ1tsYWJlbF0gPSBjaGFubmVsO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBhIHByb21pc2UgdG8gYSBEYXRhQ2hhbm5lbC4gV2lsbCByZXNvbHZlIGlmIERhdGFDaGFubmVsIHdhcyBvZmZlcmVkIGFuZCBnZXRzIGluaXRpYXRlZC4gTWlnaHQgcmVqZWN0IGFmdGVyIHJlbW90ZSBhbmQgbG9jYWwgZGVzY3JpcHRpb24gYXJlIHByb2Nlc3NlZC5cbiAgICAgKiBAbWV0aG9kIGdldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBsYWJlbCBvZiB0aGUgY2hhbm5lbCB0byBnZXRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IERhdGFDaGFubmVsfSBQcm9taXNlIGZvciB0aGUgRGF0YUNoYW5uZWxcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy53YWl0X3AudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChfdGhpcy5jaGFubmVsc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbHNbbmFtZV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRhdGFDaGFubmVsIG5vdCBuZWdvdGlhdGVkXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENoYW5uZWxDb2xsZWN0aW9uO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG5cbi8qKlxuICogQG1vZHVsZSBydGMuaW50ZXJuYWxcbiAqL1xuXG5cbi8qKlxuICogQWxpYXMgZm9yIG5hdGl2ZSBwcm9taXNlcyBvciBhIHBvbHlmaWxsIGlmIG5vdCBzdXBwb3J0ZWRcbiAqIEBjbGFzcyBydGMuaW50ZXJuYWwuUHJvbWlzZVxuICovXG5cbihmdW5jdGlvbigpIHtcbiAgZXhwb3J0cy5Qcm9taXNlID0gZ2xvYmFsLlByb21pc2UgfHwgcmVxdWlyZSgnZXM2LXByb21pc2UnKS5Qcm9taXNlO1xuXG5cbiAgLyoqXG4gICAqIEhlbHBlciB0byBpbXBsZW1lbnQgZGVmZXJyZWQgZXhlY3V0aW9uIHdpdGggcHJvbWlzZXNcbiAgICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5EZWZlcnJlZFxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyB0aGUgcHJvbWlzZVxuICAgKiBAbWV0aG9kIHJlc29sdmVcbiAgICogQHBhcmFtIFtkYXRhXSBUaGUgcGF5bG9hZCB0byB3aGljaCB0aGUgcHJvbWlzZSB3aWxsIHJlc29sdmVcbiAgI1xuICAgKiBAZXhhbXBsZVxuICAgKiAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKClcbiAgICogICAgIGRlZmVyLnJlc29sdmUoNDIpO1xuICAgKiAgICAgZGVmZXIucHJvbWlzZS50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgKiAgICAgICBjb25zb2xlLmxvZyhyZXMpOyAgIC8vIDQyXG4gICAqICAgICB9XG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJlamVjdCB0aGUgcHJvbWlzZVxuICAgKiBAbWV0aG9kIHJlamVjdFxuICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJvciBUaGUgcGF5bG9hZCB0byB3aGljaCB0aGUgcHJvbWlzZSB3aWxsIHJlc29sdmVcbiAgI1xuICAgKiBAZXhhbXBsZVxuICAgKiAgICAgdmFyIGRlZmVyID0gbmV3IERlZmVycmVkKClcbiAgICogICAgIGRlZmVyLnJlamVjdChuZXcgRXJyb3IoXCJSZWplY3QgYmVjYXVzZSB3ZSBjYW4hXCIpKTtcbiAgICogICAgIGRlZmVyLnByb21pc2UudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAqICAgICAgIC8vIHdvbnQgaGFwcGVuXG4gICAqICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICogICAgICAgLy8gd2lsbCBoYXBwZW5cbiAgICogICAgIH1cbiAgICovXG5cblxuICAvKipcbiAgICogVGhlIHByb21pc2Ugd2hpY2ggd2lsbCBnZXQgcmVzb2x2ZWQgb3IgcmVqZWN0ZWQgYnkgdGhpcyBkZWZlcnJlZFxuICAgKiBAcHJvcGVydHkge1Byb21pc2V9IHByb21pc2VcbiAgICovXG5cbiAgZXhwb3J0cy5EZWZlcnJlZCA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBEZWZlcnJlZCgpIHtcbiAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBleHBvcnRzLlByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICBfdGhpcy5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucmVqZWN0ID0gcmVqZWN0O1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIHJldHVybiBEZWZlcnJlZDtcblxuICB9KSgpO1xuXG5cbiAgLyoqXG4gICAqIEFkZHMgYSB0aW1lb3V0IHRvIGEgcHJvbWlzZS4gVGhlIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCBpZiB0aW1lb3V0IGlzXG4gICAqIHJlYWNoZWQuIEl0IHdpbGwgYWN0IGxpa2UgdGhlIHVuZGVybHlpbmcgcHJvbWlzZSBpZiBpdCBpcyByZXNvbHZlZCBvclxuICAgKiByZWplY3RlZCBiZWZvcmUgdGhlIHRpbWVvdXQgaXMgcmVhY2hlZC5cbiAgICogQHBhcmFtIHtQcm9tc2V9IHByb21pc2UgVGhlIHVuZGVybHlpbmcgcHJvbWlzZVxuICAgKiBAcGFyYW0ge251bWJlcn0gdGltZSBUaW1lb3V0IGluIG1zXG4gICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2UgYWN0aW5nIGxpa2UgdGhlIHVuZGVybHlpbmcgcHJvbWlzZSBvciB0aW1lb3V0XG4gICAqL1xuXG4gIGV4cG9ydHMudGltZW91dCA9IGZ1bmN0aW9uKHByb21pc2UsIHRpbWUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcignT3BlcmF0aW9uIHRpbWVkIG91dCcpKTtcbiAgICAgIH0sIHRpbWUpO1xuICAgIH0pO1xuICB9O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIEV2ZW50RW1pdHRlcixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIERlZmVycmVkID0gcmVxdWlyZSgnLi9wcm9taXNlJykuRGVmZXJyZWQ7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEhlbHBlciBoYW5kbGluZyB0aGUgbWFwcGluZyBvZiBzdHJlYW1zIGZvciBSZW1vdGVQZWVyXG4gICAqIEBjbGFzcyBydGMuaW50ZXJuYWwuU3RyZWFtQ29sbGVjdGlvblxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cblxuICBleHBvcnRzLlN0cmVhbUNvbGxlY3Rpb24gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChTdHJlYW1Db2xsZWN0aW9uLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgc3RyZWFtIHdhcyBhZGRlZCB0byB0aGUgY29sbGVjdGlvblxuICAgICAqIEBldmVudCBzdGVhbV9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSB1c2VyIGRlZmluZWQgbmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIHRvIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFN0cmVhbUNvbGxlY3Rpb24oKSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogQ29udGFpbnMgdGhlIHByb21pc2VzIHdoaWNoIHdpbGwgcmVzb2x2ZSB0byB0aGUgc3RyZWFtc1xuICAgICAgICogQHByb3BlcnR5IHtPYmplY3R9IHN0cmVhbXNcbiAgICAgICAqL1xuICAgICAgdGhpcy5zdHJlYW1zID0ge307XG4gICAgICB0aGlzLl9kZWZlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSB7fTtcbiAgICAgIHRoaXMuX3BlbmRpbmcgPSB7fTtcbiAgICAgIHRoaXMud2FpdF9kID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLndhaXRfcCA9IHRoaXMud2FpdF9kLnByb21pc2U7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgc3RyZWFtIGRlc2NyaXB0aW9uIGFuZCBnZW5lcmF0ZSBwcm9taXNlc1xuICAgICAqIEBtZXRob2QgdXBkYXRlXG4gICAgICogQHBhcmFtIGRhdGEge09iamVjdH0gQW4gb2JqZWN0IG1hcHBpbmcgdGhlIHN0cmVhbSBpZHMgdG8gc3RyZWFtIG5hbWVzXG4gICAgICovXG5cbiAgICBTdHJlYW1Db2xsZWN0aW9uLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgZGVmZXIsIGksIGlkLCBsZW4sIG1lbWJlcnMsIG5hbWUsIHJlZiwgc3RyZWFtLCBzdHJlYW1fcDtcbiAgICAgIG1lbWJlcnMgPSBbXTtcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSB7fTtcbiAgICAgIHJlZiA9IHRoaXMuc3RyZWFtcztcbiAgICAgIGZvciAoc3RyZWFtX3AgPSBpID0gMCwgbGVuID0gcmVmLmxlbmd0aDsgaSA8IGxlbjsgc3RyZWFtX3AgPSArK2kpIHtcbiAgICAgICAgbmFtZSA9IHJlZltzdHJlYW1fcF07XG4gICAgICAgIGlmIChkYXRhW25hbWVdID09IG51bGwpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5zdHJlYW1zW25hbWVdO1xuICAgICAgICAgIHRoaXMuZW1pdCgnc3RyZWFtX3JlbW92ZWQnLCBuYW1lKTtcbiAgICAgICAgICBpZiAoc3RyZWFtX3AuaXNGdWxsZmlsbGVkKCkpIHtcbiAgICAgICAgICAgIHN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzdHJlYW0uY2xvc2UoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc3RyZWFtX3AuaXNQZW5kaW5nKCkpIHtcbiAgICAgICAgICAgIHN0cmVhbV9wLnJlamVjdChuZXcgRXJyb3IoXCJTdHJlYW0gcmVtb3ZlZCBiZWZvcmUgYmVpbmcgZXN0YWJsaXNoZWRcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChuYW1lIGluIGRhdGEpIHtcbiAgICAgICAgaWQgPSBkYXRhW25hbWVdO1xuICAgICAgICBpZiAodGhpcy5zdHJlYW1zW25hbWVdID09IG51bGwpIHtcbiAgICAgICAgICBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICAgIHRoaXMuc3RyZWFtc1tuYW1lXSA9IGRlZmVyLnByb21pc2U7XG4gICAgICAgICAgdGhpcy5fZGVmZXJzW25hbWVdID0gZGVmZXI7XG4gICAgICAgICAgdGhpcy5lbWl0KCdzdHJlYW1fYWRkZWQnLCBuYW1lLCBkZWZlci5wcm9taXNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZGVmZXJzW25hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAodGhpcy5fcGVuZGluZ1tpZF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgc3RyZWFtID0gdGhpcy5fcGVuZGluZ1tpZF07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fcGVuZGluZ1tpZF07XG4gICAgICAgICAgICB0aGlzLl9kZWZlcnNbbmFtZV0ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2RlZmVyc1tuYW1lXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fd2FpdGluZ1tpZF0gPSBuYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMud2FpdF9kLnJlc29sdmUoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgc3RyZWFtIHRvIHRoZSBjb2xsZWN0aW9uIGFuZCByZXNvbHZlIHByb21pc2VzIHdhaXRpbmcgZm9yIGl0XG4gICAgICogQG1ldGhvZCByZXNvbHZlXG4gICAgICogQHBhcmFtIHtydGMuU3RyZWFtfSBzdHJlYW1cbiAgICAgKi9cblxuICAgIFN0cmVhbUNvbGxlY3Rpb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHZhciBpZCwgbmFtZTtcbiAgICAgIGlkID0gc3RyZWFtLmlkKCk7XG4gICAgICBpZiAoaWQgPT09ICdkZWZhdWx0Jykge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXModGhpcy5zdHJlYW1zKS5sZW5ndGggPT09IDEgJiYgT2JqZWN0LmtleXModGhpcy5fd2FpdGluZykubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJXb3JraW5nIGFyb3VuZCBpbmNvbXBhdGliaWxpdHkgYmV0d2VlbiBGaXJlZm94IGFuZCBDaHJvbWUgY29uY2VybmluZyBzdHJlYW0gaWRlbnRpZmljYXRpb25cIik7XG4gICAgICAgICAgaWQgPSBPYmplY3Qua2V5cyh0aGlzLl93YWl0aW5nKVswXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIlVuYWJsZSB0byB3b3JrIGFyb3VuZCBpbmNvbXBhdGliaWxpdHkgYmV0d2VlbiBGaXJlZm94IGFuZCBDaHJvbWUgY29uY2VybmluZyBzdHJlYW0gaWRlbnRpZmljYXRpb25cIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl93YWl0aW5nW2lkXSAhPSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLl93YWl0aW5nW2lkXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3dhaXRpbmdbaWRdO1xuICAgICAgICB0aGlzLl9kZWZlcnNbbmFtZV0ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICByZXR1cm4gZGVsZXRlIHRoaXMuX2RlZmVyc1tuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wZW5kaW5nW2lkXSA9IHN0cmVhbTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGEgcHJvbWlzZSBmb3IgYSBzdHJlYW0gd2l0aCB0aGUgZ2l2ZW4gbmFtZS4gTWlnaHQgYmUgcmVqZWN0ZWQgYWZ0ZXIgYHVwZGF0ZSgpYFxuICAgICNcbiAgICAgKiBAbWV0aG9kIGdldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gVGhlIHByb21pc2UgZm9yIHRoZSBgcnRjLlN0cmVhbWBcbiAgICAgKi9cblxuICAgIFN0cmVhbUNvbGxlY3Rpb24ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiB0aGlzLndhaXRfcC50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKF90aGlzLnN0cmVhbXNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLnN0cmVhbXNbbmFtZV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlN0cmVhbSBub3Qgb2ZmZXJlZFwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBTdHJlYW1Db2xsZWN0aW9uO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBleHBvcnRzLCBleHRlbmQ7XG5cbiAgZXh0ZW5kID0gZnVuY3Rpb24ocm9vdCwgb2JqKSB7XG4gICAgdmFyIGtleSwgdmFsdWU7XG4gICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgcm9vdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBleHBvcnRzO1xuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IHtcbiAgICBpbnRlcm5hbDoge30sXG4gICAgc2lnbmFsaW5nOiB7fVxuICB9O1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3BlZXInKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vcmVtb3RlX3BlZXInKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vbG9jYWxfcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9wZWVyX2Nvbm5lY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vc3RyZWFtJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL2NvbXBhdCcpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9yb29tJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3ZpZGVvX2VsZW1lbnQnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvY2hhbm5lbF9jb2xsZWN0aW9uJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLmludGVybmFsLCByZXF1aXJlKCcuL2ludGVybmFsL3Byb21pc2UnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuc2lnbmFsaW5nLCByZXF1aXJlKCcuL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuc2lnbmFsaW5nLCByZXF1aXJlKCcuL3NpZ25hbGluZy9wYWxhdmFfc2lnbmFsaW5nJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLnNpZ25hbGluZywgcmVxdWlyZSgnLi9zaWduYWxpbmcvY2FsbGluZ19zaWduYWxpbmcnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuc2lnbmFsaW5nLCByZXF1aXJlKCcuL3NpZ25hbGluZy9tdWNfc2lnbmFsaW5nJykpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgUGVlciwgU3RyZWFtLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cbiAgU3RyZWFtID0gcmVxdWlyZSgnLi9zdHJlYW0nKS5TdHJlYW07XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgbG9jYWwgdXNlciBvZiB0aGUgcm9vbVxuICAgKiBAY2xhc3MgcnRjLkxvY2FsUGVlclxuICAgKiBAZXh0ZW5kcyBydGMuUGVlclxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cblxuICBleHBvcnRzLkxvY2FsUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKExvY2FsUGVlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBMb2NhbFBlZXIoKSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogQ29udGFpbnMgcHJvbWlzZXMgb2YgdGhlIGxvY2FsIHN0cmVhbXMgb2ZmZXJlZCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICAgKiBAcHJvcGVydHkgc3RyZWFtc1xuICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgKi9cbiAgICAgIHRoaXMuc3RyZWFtcyA9IHt9O1xuXG4gICAgICAvKipcbiAgICAgICAqIENvbnRhaW5zIGFsbCBEYXRhQ2hhbm5lbCBjb25maWd1cmF0aW9ucyBuZWdvdGlhdGVkIHdpdGggYWxsIHJlbW90ZSBwZWVyc1xuICAgICAgICogQHByb3BlcnR5IGNoYW5uZWxzXG4gICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAqL1xuICAgICAgdGhpcy5jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5fc3RhdHVzID0ge307XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYW4gaXRlbSBvZiB0aGUgc3RhdHVzIHRyYW5zZmVycmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUuIFdpbGwgcmV0dXJuXG4gICAgICogQHJldHVybiBUaGUgdmFsdWUgYXNzb2NpYXRlZCB3aXRoIHRoZSBrZXlcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogU2V0IGFuIGl0ZW0gb2YgdGhlIHN0YXR1cyB0cmFuc2ZlcnJlZCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBzdGF0dXNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHZhbHVlLiBXaWxsIHJldHVyblxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc3RvcmVcbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuc3RhdHVzID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fc3RhdHVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHRoaXMuX3N0YXR1cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzW2tleV07XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGRhdGEgY2hhbm5lbCB3aGljaCB3aWxsIGJlIG5lZ290aWF0ZWQgd2l0aCBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nZGF0YSddIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGVzYz17b3JkZXJlZDogdHJ1ZX1dIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENEYXRhQ2hhbm5lbC5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5hZGREYXRhQ2hhbm5lbCA9IGZ1bmN0aW9uKG5hbWUsIGRlc2MpIHtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGVzYyA9IG5hbWU7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfQ0hBTk5FTDtcbiAgICAgIH1cbiAgICAgIGlmIChkZXNjID09IG51bGwpIHtcbiAgICAgICAgZGVzYyA9IHtcbiAgICAgICAgICBvcmRlcmVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLmNoYW5uZWxzW25hbWVdID0gZGVzYztcbiAgICAgIHRoaXMuZW1pdCgnY29uZmlndXJhdGlvbl9jaGFuZ2VkJyk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGxvY2FsIHN0cmVhbSB0byBiZSBzZW50IHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIGFkZFN0cmVhbVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nc3RyZWFtJ10gTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW0gfCBydGMuU3RyZWFtIHwgT2JqZWN0fSBzdHJlYW0gVGhlIHN0cmVhbSwgYSBwcm9taXNlIHRvIHRoZSBzdHJlYW0gb3IgdGhlIGNvbmZpZ3VyYXRpb24gdG8gY3JlYXRlIGEgc3RyZWFtIHdpdGggYHJ0Yy5TdHJlYW0uY3JlYXRlU3RyZWFtKClgXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIG9mIHRoZSBzdHJlYW0gd2hpY2ggd2FzIGFkZGVkXG4gICAgICovXG5cbiAgICBMb2NhbFBlZXIucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUsIG9iaikge1xuICAgICAgdmFyIHNhdmVTdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgc2F2ZVN0cmVhbSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RyZWFtX3ApIHtcbiAgICAgICAgICBfdGhpcy5zdHJlYW1zW25hbWVdID0gc3RyZWFtX3A7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY29uZmlndXJhdGlvbl9jaGFuZ2VkJyk7XG4gICAgICAgICAgcmV0dXJuIHN0cmVhbV9wO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIG9iaiA9IG5hbWU7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgaWYgKChvYmogIT0gbnVsbCA/IG9iai50aGVuIDogdm9pZCAwKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKG9iaik7XG4gICAgICB9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIFN0cmVhbSkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShQcm9taXNlLnJlc29sdmUob2JqKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHJlYW1fcCA9IFN0cmVhbS5jcmVhdGVTdHJlYW0ob2JqKTtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oc3RyZWFtX3ApO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBsb2NhbCBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nc3RyZWFtJ10gTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuc3RyZWFtID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0cmVhbXNbbmFtZV07XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHBlZXIgaXMgdGhlIGxvY2FsIHBlZXIuIFJldHVybnMgYWx3YXlzIGB0cnVlYCBvbiB0aGlzXG4gICAgICogY2xhc3MuXG4gICAgICogQG1ldGhvZCBpc0xvY2FsXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWBcbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuaXNMb2NhbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIHJldHVybiBMb2NhbFBlZXI7XG5cbiAgfSkoUGVlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQSB1c2VyIGluIHRoZSByb29tXG4gICAqIEBjbGFzcyBydGMuUGVlclxuICAgKi9cblxuICBleHBvcnRzLlBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBlZXIoKSB7XG4gICAgICByZXR1cm4gUGVlci5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGF0dXMgb2YgdGhlIHBlZXIgaGFzIGNoYW5nZWRcbiAgICAgKiBAZXZlbnQgc3RhdHVzX2NoYW5nZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIFRoZSBuZXcgc3RhdHVzIG9iamVjdFxuICAgICAqL1xuXG4gICAgUGVlci5wcm90b3R5cGUuREVGQVVMVF9DSEFOTkVMID0gJ2RhdGEnO1xuXG4gICAgUGVlci5wcm90b3R5cGUuREVGQVVMVF9TVFJFQU0gPSAnc3RyZWFtJztcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgdmFsdWUgb2YgdGhlIHN0YXR1cyBvYmplY3RcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBcbiAgICAgKiBAcmV0dXJuIFRoZSB2YWx1ZVxuICAgICAqL1xuXG4gICAgUGVlci5wcm90b3R5cGUuc3RhdHVzID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEYXRhQ2hhbm5lbCwgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgU3RyZWFtLCBjb21wYXQsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZCwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuICBEYXRhQ2hhbm5lbCA9IHJlcXVpcmUoJy4vZGF0YV9jaGFubmVsJykuRGF0YUNoYW5uZWw7XG5cbiAgY29tcGF0ID0gcmVxdWlyZSgnLi9jb21wYXQnKS5jb21wYXQ7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgbmF0aXZlIFJUQ1BlZXJDb25uZWN0aW9uXG4gICNcbiAgICogUHJvdmlkZXMgZXZlbnRzIGZvciBuZXcgc3RyZWFtcyBhbmQgZGF0YSBjaGFubmVscy4gU2lnbmFsaW5nIGluZm9ybWF0aW9uIGhhc1xuICAgKiB0byBiZSBmb3J3YXJkZWQgZnJvbSBldmVudHMgZW1pdHRlZCBieSB0aGlzIG9iamVjdCB0byB0aGUgcmVtb3RlXG4gICAqIFBlZXJDb25uZWN0aW9uLlxuICAjXG4gICAqIEBjbGFzcyBydGMuUGVlckNvbm5lY3Rpb25cbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9mZmVyaW5nIFRydWUgaWYgdGhlIGxvY2FsIHBlZXIgc2hvdWxkIGluaXRpYXRlIHRoZSBjb25uZWN0aW9uXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIE9wdGlvbnMgb2JqZWN0IHBhc3NlZCBvbiBmcm9tIGBSb29tYFxuICAgKi9cblxuICBleHBvcnRzLlBlZXJDb25uZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGVlckNvbm5lY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBOZXcgbG9jYWwgSUNFIGNhbmRpZGF0ZSB3aGljaCBzaG91bGQgYmUgc2lnbmFsZWQgdG8gcmVtb3RlIHBlZXJcbiAgICAgKiBAZXZlbnQgaWNlX2NhbmRpYXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNhbmRpZGF0ZSBUaGUgaWNlIGNhbmRpZGF0ZVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBOZXcgcmVtb3RlIHN0cmVhbSB3YXMgYWRkZWQgdG8gdGhlIFBlZXJDb25uZWN0aW9uXG4gICAgICogQGV2ZW50IHN0cmVhbV9hZGRlZFxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtIFRoZSBzdHJlYW1cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogTmV3IERhdGFDaGFubmVsIHRvIHRoZSByZW1vdGUgcGVlciBpcyByZWFkeSB0byBiZSB1c2VkXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9yZWFkeVxuICAgICAqIEBwYXJhbSB7cnRjLkRhdGFDaGFubmVsfSBjaGFubmVsIFRoZSBkYXRhIGNoYW5uZWxcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogTmV3IG9mZmVyIG9yIGFuc3dlciB3aGljaCBzaG91bGQgYmUgc2lnbmFsZWQgdG8gdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQGV2ZW50IHNpZ25hbGluZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIHNpZ25hbGluZyBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBQZWVyQ29ubmVjdGlvbiB3YXMgY2xvc2VkXG4gICAgICogQGV2ZW50IGNsb3NlZFxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gUGVlckNvbm5lY3Rpb24ob2ZmZXJpbmcsIG9wdGlvbnMxKSB7XG4gICAgICB2YXIgaWNlX3NlcnZlcnM7XG4gICAgICB0aGlzLm9mZmVyaW5nID0gb2ZmZXJpbmc7XG4gICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zMTtcbiAgICAgIGljZV9zZXJ2ZXJzID0gW107XG4gICAgICB0aGlzLm5vX2djX2J1Z2ZpeCA9IFtdO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdHVuICE9IG51bGwpIHtcbiAgICAgICAgaWNlX3NlcnZlcnMucHVzaCh7XG4gICAgICAgICAgdXJsOiB0aGlzLm9wdGlvbnMuc3R1blxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudHVybiAhPSBudWxsKSB7XG4gICAgICAgIGljZV9zZXJ2ZXJzLnB1c2godGhpcy5vcHRpb25zLnR1cm4pO1xuICAgICAgfVxuICAgICAgdGhpcy5wYyA9IG5ldyBjb21wYXQuUGVlckNvbm5lY3Rpb24oe1xuICAgICAgICBpY2VTZXJ2ZXJzOiBpY2Vfc2VydmVyc1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuY29ubmVjdF9kLnByb21pc2VbXCJjYXRjaFwiXShmdW5jdGlvbigpIHt9KTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nX3BlbmRpbmcgPSBbXTtcbiAgICAgIHRoaXMucGMub25pY2VjYW5kaWRhdGUgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2ljZV9jYW5kaWRhdGUnLCBldmVudC5jYW5kaWRhdGUpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uYWRkc3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdHJlYW1fYWRkZWQnLCBuZXcgU3RyZWFtKGV2ZW50LnN0cmVhbSkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uZGF0YWNoYW5uZWwgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChldmVudC5jaGFubmVsKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25yZW1vdmVzdHJlYW0gPSBmdW5jdGlvbihldmVudCkge307XG4gICAgICB0aGlzLnBjLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKCdvbm5lZ290aWF0aW9ubmVlZGVkIGNhbGxlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcmVmMTtcbiAgICAgICAgICBpZiAoX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZmFpbGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0RXJyb3IobmV3IEVycm9yKFwiVW5hYmxlIHRvIGVzdGFibGlzaCBJQ0UgY29ubmVjdGlvblwiKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChfdGhpcy5wYy5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdjbG9zZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY29ubmVjdF9kLnJlamVjdChuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gd2FzIGNsb3NlZCcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKChyZWYxID0gX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlKSA9PT0gJ2Nvbm5lY3RlZCcgfHwgcmVmMSA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jb25uZWN0X2QucmVzb2x2ZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5wYy5vbnNpZ25hbGluZ3N0YXRlY2hhbmdlID0gZnVuY3Rpb24oZXZlbnQpIHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQWRkIG5ldyBzaWduYWxpbmcgaW5mb3JtYXRpb24gcmVjZWl2ZWQgZnJvbSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2Qgc2lnbmFsaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIHNpZ25hbGluZyBpbmZvcm1hdGlvblxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLnNpZ25hbGluZyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBzZHA7XG4gICAgICBzZHAgPSBuZXcgY29tcGF0LlNlc3Npb25EZXNjcmlwdGlvbihkYXRhKTtcbiAgICAgIHJldHVybiB0aGlzLl9zZXRSZW1vdGVEZXNjcmlwdGlvbihzZHApLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnb2ZmZXInICYmIF90aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9hbnN3ZXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgcmVtb3RlIElDRSBjYW5kaWRhdGVcbiAgICAgKiBAbWV0aG9kIGFkZEljZUNhbmRpZGF0ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjIFRoZSBjYW5kaWRhdGVcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRJY2VDYW5kaWRhdGUgPSBmdW5jdGlvbihkZXNjKSB7XG4gICAgICB2YXIgY2FuZGlkYXRlO1xuICAgICAgaWYgKChkZXNjICE9IG51bGwgPyBkZXNjLmNhbmRpZGF0ZSA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICBjYW5kaWRhdGUgPSBuZXcgY29tcGF0LkljZUNhbmRpZGF0ZShkZXNjKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGMuYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY29uc29sZS5sb2coXCJJQ0UgdHJpY2tsaW5nIHN0b3BwZWRcIik7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgb3B0aW9ucyBmb3IgdGhlIG9mZmVyL2Fuc3dlclxuICAgICAqIEBtZXRob2QgX29hT3B0aW9uc1xuICAgICAqIEBwcml2YXRlXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9vYU9wdGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wdGlvbmFsOiBbXSxcbiAgICAgICAgbWFuZGF0b3J5OiB7XG4gICAgICAgICAgT2ZmZXJUb1JlY2VpdmVBdWRpbzogdHJ1ZSxcbiAgICAgICAgICBPZmZlclRvUmVjZWl2ZVZpZGVvOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByZW1vdGUgZGVzY3JpcHRpb25cbiAgICAgKiBAbWV0aG9kIF9zZXRSZW1vdGVEZXNjcmlwdGlvblxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNkcCBUaGUgcmVtb3RlIFNEUFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCBiZSByZXNvbHZlZCBvbmNlIHRoZSByZW1vdGUgZGVzY3JpcHRpb24gd2FzIHNldCBzdWNjZXNzZnVsbHlcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fc2V0UmVtb3RlRGVzY3JpcHRpb24gPSBmdW5jdGlvbihzZHApIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHZhciBkZXNjcmlwdGlvbjtcbiAgICAgICAgICBkZXNjcmlwdGlvbiA9IG5ldyBjb21wYXQuU2Vzc2lvbkRlc2NyaXB0aW9uKHNkcCk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLnNldFJlbW90ZURlc2NyaXB0aW9uKHNkcCwgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgb2ZmZXIsIHNldCBpdCBvbiBsb2NhbCBkZXNjcmlwdGlvbiBhbmQgZW1pdCBpdFxuICAgICAqIEBtZXRob2QgX29mZmVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fb2ZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5jcmVhdGVPZmZlcihyZXNvbHZlLCByZWplY3QsIF90aGlzLl9vYU9wdGlvbnMoKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNkcCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fcHJvY2Vzc0xvY2FsU2RwKHNkcCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuc3dlciwgc2V0IGl0IG9uIGxvY2FsIGRlc2NyaXB0aW9uIGFuZCBlbWl0IGl0XG4gICAgICogQG1ldGhvZCBfb2ZmZXJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9hbnN3ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5jcmVhdGVBbnN3ZXIocmVzb2x2ZSwgcmVqZWN0LCBfdGhpcy5fb2FPcHRpb25zKCkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzZHApIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX3Byb2Nlc3NMb2NhbFNkcChzZHApO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpW1wiY2F0Y2hcIl0oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RFcnJvcihlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNldCBsb2NhbCBkZXNjcmlwdGlvbiBhbmQgZW1pdCBpdFxuICAgICAqIEBtZXRob2QgX3Byb2Nlc3NMb2NhbFNkcFxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNkcCBUaGUgbG9jYWwgU0RQXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIGxvY2FsIGRlc2NyaXB0aW9uIHdhcyBzZXQgc3VjY2Vzc2Z1bGx5XG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX3Byb2Nlc3NMb2NhbFNkcCA9IGZ1bmN0aW9uKHNkcCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgdmFyIHN1Y2Nlc3M7XG4gICAgICAgICAgc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGRhdGE7XG4gICAgICAgICAgICBkYXRhID0ge1xuICAgICAgICAgICAgICBzZHA6IHNkcC5zZHAsXG4gICAgICAgICAgICAgIHR5cGU6IHNkcC50eXBlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgX3RoaXMuZW1pdCgnc2lnbmFsaW5nJywgZGF0YSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShzZHApO1xuICAgICAgICAgIH07XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLnNldExvY2FsRGVzY3JpcHRpb24oc2RwLCBzdWNjZXNzLCByZWplY3QpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE1hcmsgY29ubmVjdGlvbiBhdHRlbXB0IGFzIGZhaWxlZFxuICAgICAqIEBtZXRob2QgX2Nvbm5lY3RFcnJvclxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyIEVycm9yIGNhdXNpbmcgY29ubmVjdGlvbiB0byBmYWlsXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Nvbm5lY3RFcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgdGhpcy5jb25uZWN0X2QucmVqZWN0KGVycik7XG4gICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIGFkZFN0cmVhbVxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtIFRoZSBsb2NhbCBzdHJlYW1cbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHJldHVybiB0aGlzLnBjLmFkZFN0cmVhbShzdHJlYW0uc3RyZWFtKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgbG9jYWwgc3RyZWFtXG4gICAgICogQG1ldGhvZCByZW1vdmVTdHJlYW1cbiAgICAgKiBAcGFyYW0ge3J0Yy5TdHJlYW19IHN0cmVhbSBUaGUgbG9jYWwgc3RyZWFtXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUucmVtb3ZlU3JlYW0gPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHJldHVybiB0aGlzLnBjLnJlbW92ZVN0cmVhbShzdHJlYW0uc3RyZWFtKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgRGF0YUNoYW5uZWwuIFdpbGwgb25seSBhY3R1YWxseSBkbyBzb21ldGhpbmcgaWYgYG9mZmVyaW5nYCBpcyBgdHJ1ZWAuXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENQZWVyQ29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmFkZERhdGFDaGFubmVsID0gZnVuY3Rpb24obmFtZSwgb3B0aW9ucykge1xuICAgICAgdmFyIGNoYW5uZWw7XG4gICAgICBpZiAodGhpcy5vZmZlcmluZykge1xuICAgICAgICBjaGFubmVsID0gdGhpcy5wYy5jcmVhdGVEYXRhQ2hhbm5lbChuYW1lLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5ub19nY19idWdmaXgucHVzaChjaGFubmVsKTtcbiAgICAgICAgcmV0dXJuIGNoYW5uZWwub25vcGVuID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChjaGFubmVsKSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogRXN0YWJsaXNoIGNvbm5lY3Rpb24gd2l0aCByZW1vdGUgcGVlci4gQ29ubmVjdGlvbiB3aWxsIGJlIGVzdGFibGlzaGVkIG9uY2UgYm90aCBwZWVycyBoYXZlIGNhbGxlZCB0aGlzIGZ1bmN0aW9cbiAgICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgb25jZSB0aGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZFxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghdGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgICAgaWYgKHRoaXMub2ZmZXJpbmcpIHtcbiAgICAgICAgICB0aGlzLl9vZmZlcigpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGMuc2lnbmFsaW5nU3RhdGUgPT09ICdoYXZlLXJlbW90ZS1vZmZlcicpIHtcbiAgICAgICAgICB0aGlzLl9hbnN3ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY29ubmVjdF9kLnByb21pc2UpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlIHRoZSBjb25uZWN0aW9uIHRvIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wYy5jbG9zZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyQ29ubmVjdGlvbjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQ2hhbm5lbENvbGxlY3Rpb24sIFBlZXIsIFByb21pc2UsIFN0cmVhbUNvbGxlY3Rpb24sIG1lcmdlLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgUHJvbWlzZSA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLlByb21pc2U7XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cbiAgU3RyZWFtQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24nKS5TdHJlYW1Db2xsZWN0aW9uO1xuXG4gIENoYW5uZWxDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKS5DaGFubmVsQ29sbGVjdGlvbjtcblxuICBtZXJnZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcnJheSwgaSwga2V5LCBsZW4sIHJlcywgdmFsdWU7XG4gICAgcmVzID0ge307XG4gICAgZm9yIChpID0gMCwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBhcnJheSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoa2V5IGluIGFycmF5KSB7XG4gICAgICAgIHZhbHVlID0gYXJyYXlba2V5XTtcbiAgICAgICAgcmVzW2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgcmVtb3RlIHVzZXIgb2YgdGhlIHJvb21cbiAgICogQGNsYXNzIHJ0Yy5SZW1vdGVQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLlBlZXJDb25uZWN0aW9ufSBwZWVyX2Nvbm5lY3Rpb24gVGhlIHVuZGVybHlpbmcgcGVlciBjb25uZWN0aW9uXG4gICAqIEBwYXJhbSB7cnRjLlNpZ25hbGluZ1BlZXJ9IHNpZ25hbGluZyBUaGUgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICogQHBhcmFtIHtydGMuTG9jYWxQZWVyfSBsb2NhbCBUaGUgbG9jYWwgcGVlclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBUaGUgb3B0aW9ucyBvYmplY3QgYXMgcGFzc2VkIHRvIGBSb29tYFxuICAgKi9cblxuICBleHBvcnRzLlJlbW90ZVBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChSZW1vdGVQZWVyLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogTWVzc2FnZSByZWNlaXZlZCBmcm9tIHBlZXIgdGhyb3VnaCBzaWduYWxpbmdcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkIG9mIHRoZSBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW1vdGUgcGVlciBsZWZ0IG9yIHNpZ25hbGluZyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBzdHJlYW0gaXMgYXZhaWxhYmxlIGZyb20gdGhlIHBlZXJcbiAgICAgKiBAZXZlbnQgc3RyZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgZGF0YSBjaGFubmVsIGlzIGF2YWlsYWJsZSBmcm9tIHRoZSBwZWVyXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLkRhdGFDaGFubmVsfSBjaGFubmVsIFByb21pc2Ugb2YgdGhlIGNoYW5uZWxcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXIgc3VwcGxpZWQgYnkgdGhlIHNpZ25hbGluZyBpbXBsZW1lbnRhdGlvblxuICAgICAqIEBwcm9wZXJ0eSBzaWduYWxpbmdcbiAgICAgKiBAdHlwZSBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1BlZXJcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFJlbW90ZVBlZXIocGVlcl9jb25uZWN0aW9uLCBzaWduYWxpbmcsIGxvY2FsLCBvcHRpb25zMSkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24gPSBwZWVyX2Nvbm5lY3Rpb247XG4gICAgICB0aGlzLnNpZ25hbGluZyA9IHNpZ25hbGluZztcbiAgICAgIHRoaXMubG9jYWwgPSBsb2NhbDtcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMxO1xuICAgICAgdGhpcy5wcml2YXRlX3N0cmVhbXMgPSB7fTtcbiAgICAgIHRoaXMucHJpdmF0ZV9jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbiA9IG5ldyBTdHJlYW1Db2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLnN0cmVhbXMgPSB0aGlzLnN0cmVhbV9jb2xsZWN0aW9uLnN0cmVhbXM7XG4gICAgICB0aGlzLnN0cmVhbXNfZGVzYyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihuYW1lLCBzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RyZWFtX2FkZGVkJywgbmFtZSwgc3RyZWFtKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uID0gbmV3IENoYW5uZWxDb2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLmNoYW5uZWxzID0gdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uY2hhbm5lbHM7XG4gICAgICB0aGlzLmNoYW5uZWxzX2Rlc2MgPSB7fTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLm9uKCdkYXRhX2NoYW5uZWxfYWRkZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUsIGNoYW5uZWwpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgY2hhbm5lbCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtX2NvbGxlY3Rpb24ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2RhdGFfY2hhbm5lbF9yZWFkeScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24ucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBkYXRhLnN0cmVhbXMgPSBfdGhpcy5zdHJlYW1zX2Rlc2M7XG4gICAgICAgICAgZGF0YS5jaGFubmVscyA9IF90aGlzLmNoYW5uZWxzX2Rlc2M7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnNpZ25hbGluZy5zZW5kKCdzaWduYWxpbmcnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBfdGhpcy5zdHJlYW1fY29sbGVjdGlvbi51cGRhdGUoZGF0YS5zdHJlYW1zKTtcbiAgICAgICAgICBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uc2V0UmVtb3RlKGRhdGEuY2hhbm5lbHMpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uc2lnbmFsaW5nKGRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2ljZV9jYW5kaWRhdGUnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zaWduYWxpbmcuc2VuZCgnaWNlX2NhbmRpZGF0ZScsIGNhbmRpZGF0ZSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbignaWNlX2NhbmRpZGF0ZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBlZXJfY29ubmVjdGlvbi5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzdGF0dXNfY2hhbmdlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdsZWZ0JywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbGVmdCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2Nvbm5lY3RlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7fTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdjbG9zZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge307XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICBpZiAoKHRoaXMub3B0aW9ucy5hdXRvX2Nvbm5lY3QgPT0gbnVsbCkgfHwgdGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCkge1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5zdGF0dXNba2V5XTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGEgbWVzc2FnZSB0byB0aGUgcGVlciB0aHJvdWdoIHNpZ25hbGluZ1xuICAgICAqIEBtZXRob2QgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBkYXRhIHdhcyBzZW50XG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5tZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLnNlbmQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRvIHRoZSByZW1vdGUgcGVlciB0byBleGNoYW5nZSBzdHJlYW1zIGFuZCBjcmVhdGUgZGF0YSBjaGFubmVsc1xuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCByZXNvbHZlZCB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbmFtZSwgcHJvbWlzZSwgcmVmLCBzdHJlYW0sIHN0cmVhbV9wcm9taXNlcztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHN0cmVhbV9wcm9taXNlcyA9IFtdO1xuICAgICAgICByZWYgPSBtZXJnZSh0aGlzLmxvY2FsLnN0cmVhbXMsIHRoaXMucHJpdmF0ZV9zdHJlYW1zKTtcbiAgICAgICAgZm9yIChuYW1lIGluIHJlZikge1xuICAgICAgICAgIHN0cmVhbSA9IHJlZltuYW1lXTtcbiAgICAgICAgICBwcm9taXNlID0gc3RyZWFtLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgICByZXR1cm4gW25hbWUsIHN0cmVhbV07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc3RyZWFtX3Byb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBQcm9taXNlLmFsbChzdHJlYW1fcHJvbWlzZXMpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbXMpIHtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIG9wdGlvbnMsIHJlZjEsIHJlZjI7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBzdHJlYW1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgIHJlZjEgPSBzdHJlYW1zW2ldLCBuYW1lID0gcmVmMVswXSwgc3RyZWFtID0gcmVmMVsxXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZFN0cmVhbShzdHJlYW0pO1xuICAgICAgICAgICAgICBfdGhpcy5zdHJlYW1zX2Rlc2NbbmFtZV0gPSBzdHJlYW0uaWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlZjIgPSBtZXJnZShfdGhpcy5sb2NhbC5jaGFubmVscywgX3RoaXMucHJpdmF0ZV9jaGFubmVscyk7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gcmVmMikge1xuICAgICAgICAgICAgICBvcHRpb25zID0gcmVmMltuYW1lXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZERhdGFDaGFubmVsKG5hbWUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICBfdGhpcy5jaGFubmVsc19kZXNjW25hbWVdID0gb3B0aW9ucztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5zZXRMb2NhbChfdGhpcy5jaGFubmVsc19kZXNjKTtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY29ubmVjdCgpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKiBAbWV0aG9kIGNsb3NlXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzdHJlYW0gZnJvbSB0aGUgcGVlci4gSGFzIHRvIGJlIHNlbnQgYnkgdGhlIHJlbW90ZSBwZWVyIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gUHJvbWlzZSBvZiB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdHJlYW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtX2NvbGxlY3Rpb24uZ2V0KG5hbWUpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW0gdG8gYmUgc2VudCB0byB0aGlzIHJlbW90ZSBwZWVyXG4gICAgI1xuICAgICAqIElmIHlvdSB1c2UgdGhpcyBtZXRob2QgeW91IGhhdmUgdG8gc2V0IGBhdXRvX2Nvbm5lY3RgIHRvIGBmYWxzZWAgaW4gdGhlIG9wdGlvbnMgb2JqZWN0IGFuZCBjYWxsIGBjb25uZWN0KClgIG1hbnVhbGx5IG9uIGFsbCByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgICAqIEBtZXRob2QgYWRkU3RyZWFtXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdzdHJlYW0nXSBOYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbSB8IHJ0Yy5TdHJlYW0gfCBPYmplY3R9IHN0cmVhbSBUaGUgc3RyZWFtLCBhIHByb21pc2UgdG8gdGhlIHN0cmVhbSBvciB0aGUgY29uZmlndXJhdGlvbiB0byBjcmVhdGUgYSBzdHJlYW0gd2l0aCBgcnRjLlN0cmVhbS5jcmVhdGVTdHJlYW0oKWBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2Ugb2YgdGhlIHN0cmVhbSB3aGljaCB3YXMgYWRkZWRcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUsIG9iaikge1xuICAgICAgdmFyIHNhdmVTdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgaWYgKCEodGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcIlVuYWJsZSB0byBhZGQgc3RyZWFtcyBkaXJlY3RseSB0byByZW1vdGUgcGVlcnMgd2l0aG91dCAnYXV0b19jb25uZWN0JyBvcHRpb24gc2V0IHRvICdmYWxzZSdcIik7XG4gICAgICB9XG4gICAgICBzYXZlU3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW1fcCkge1xuICAgICAgICAgIF90aGlzLnByaXZhdGVfc3RyZWFtc1tuYW1lXSA9IHN0cmVhbV9wO1xuICAgICAgICAgIHJldHVybiBzdHJlYW1fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIGlmICgob2JqICE9IG51bGwgPyBvYmoudGhlbiA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShvYmopO1xuICAgICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oUHJvbWlzZS5yZXNvbHZlKG9iaikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyZWFtX3AgPSBTdHJlYW0uY3JlYXRlU3RyZWFtKG9iaik7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKHN0cmVhbV9wKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBkYXRhIGNoYW5uZWwgdG8gdGhlIHJlbW90ZSBwZWVyLiBIYXMgdG8gYmUgYWRkZWQgYnkgbG9jYWwgYW5kIHJlbW90ZSBzaWRlIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBjaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdkYXRhJ10gTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuRGF0YUNoYW5uZWx9IFByb21pc2Ugb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuY2hhbm5lbCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9DSEFOTkVMO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLmdldChuYW1lKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgZGF0YSBjaGFubmVsIHdoaWNoIHdpbGwgYmUgbmVnb3RpYXRlZCB3aXRoIHRoaXMgcmVtb3RlIHBlZXJcbiAgICAjXG4gICAgICogSWYgeW91IHVzZSB0aGlzIG1ldGhvZCB5b3UgaGF2ZSB0byBzZXQgYGF1dG9fY29ubmVjdGAgdG8gYGZhbHNlYCBpbiB0aGUgb3B0aW9ucyBvYmplY3QgYW5kIGNhbGwgYGNvbm5lY3QoKWAgbWFudWFsbHkgb24gYWxsIHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nZGF0YSddIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGVzYz17b3JkZXJlZDogdHJ1ZX1dIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENEYXRhQ2hhbm5lbC5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuYWRkRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihuYW1lLCBkZXNjKSB7XG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuYXV0b19jb25uZWN0ID09PSBmYWxzZSkpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFwiVW5hYmxlIHRvIGFkZCBjaGFubmVscyBkaXJlY3RseSB0byByZW1vdGUgcGVlcnMgd2l0aG91dCAnYXV0b19jb25uZWN0JyBvcHRpb24gc2V0IHRvICdmYWxzZSdcIik7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2MgPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX0NIQU5ORUw7XG4gICAgICB9XG4gICAgICBpZiAoZGVzYyA9PSBudWxsKSB7XG4gICAgICAgIGRlc2MgPSB7XG4gICAgICAgICAgb3JkZXJlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5wcml2YXRlX2NoYW5uZWxzW25hbWVdID0gZGVzYztcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwobmFtZSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHBlZXIgaXMgdGhlIGxvY2FsIHBlZXIuIFJldHVybnMgYWx3YXlzIGBmYWxzZWAgb24gdGhpc1xuICAgICAqIGNsYXNzLlxuICAgICAqIEBtZXRob2QgaXNMb2NhbFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFJldHVybnMgYGZhbHNlYFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuaXNMb2NhbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gUmVtb3RlUGVlcjtcblxuICB9KShQZWVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlciwgTG9jYWxQZWVyLCBNdWNTaWduYWxpbmcsIFBlZXJDb25uZWN0aW9uLCBSZW1vdGVQZWVyLCBXZWJTb2NrZXRDaGFubmVsLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIFdlYlNvY2tldENoYW5uZWwgPSByZXF1aXJlKCcuL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwnKS5XZWJTb2NrZXRDaGFubmVsO1xuXG4gIE11Y1NpZ25hbGluZyA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nL211Y19zaWduYWxpbmcnKS5NdWNTaWduYWxpbmc7XG5cbiAgUmVtb3RlUGVlciA9IHJlcXVpcmUoJy4vcmVtb3RlX3BlZXInKS5SZW1vdGVQZWVyO1xuXG4gIExvY2FsUGVlciA9IHJlcXVpcmUoJy4vbG9jYWxfcGVlcicpLkxvY2FsUGVlcjtcblxuICBQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vcGVlcl9jb25uZWN0aW9uJykuUGVlckNvbm5lY3Rpb247XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQSB2aXJ0dWFsIHJvb20gd2hpY2ggY29ubmVjdHMgbXVsdGlwbGUgUGVlcnNcbiAgICogQGNsYXNzIHJ0Yy5Sb29tXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSByb29tLiBXaWxsIGJlIHBhc3NlZCBvbiB0byBzaWduYWxpbmdcbiAgICogQHBhcmFtIHtydGMuU2lnbmFsaW5nIHwgU3RyaW5nfSBzaWduYWxpbmcgVGhlIHNpZ25hbGluZyB0byBiZSB1c2VkLiBJZiB5b3UgcGFzcyBhIHN0cmluZyBpdCB3aWxsIGJlIGludGVycHJldGVkIGFzIGEgd2Vic29ja2V0IGFkZHJlc3MgYW5kIGEgcGFsYXZhIHNpZ25hbGluZyBjb25uZWN0aW9uIHdpbGwgYmUgZXN0YWJsaXNoZWQgd2l0aCBpdC5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBWYXJpb3VzIG9wdGlvbnMgdG8gYmUgdXNlZCBpbiBjb25uZWN0aW9ucyBjcmVhdGVkIGJ5IHRoaXMgcm9vbVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmF1dG9fY29ubmVjdD10cnVlXSBXaGV0aGVyIHJlbW90ZSBwZWVycyBhcmUgY29ubmVjdGVkIGF1dG9tYXRpY2FsbHkgb3IgYW4gZXhwbGljaXQgYFJlbW90ZVBlZXIuY29ubmVjdCgpYCBjYWxsIGlzIG5lZWRlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMuc3R1bl0gVGhlIFVSSSBvZiB0aGUgU1RVTiBzZXJ2ZXIgdG8gdXNlXG4gICAqIEBwYXJhbSB7cnRjLkxvY2FsUGVlcn0gW29wdGlvbnMubG9jYWxdIFRoZSBsb2NhbCB1c2VyXG4gICAqL1xuXG4gIGV4cG9ydHMuUm9vbSA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFJvb20sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBwZWVyIGlzIGVuY291bnRlcmVkIGluIHRoZSByb29tLiBGaXJlcyBvbiBuZXcgcmVtb3RlIHBlZXJzIGFmdGVyIGpvaW5pbmcgYW5kIGZvciBhbGwgcGVlcnMgaW4gdGhlIHJvb20gd2hlbiBqb2luaW5nLlxuICAgICAqIEBldmVudCBwZWVyX2pvcGluZWRcbiAgICAgKiBAcGFyYW0ge3J0Yy5SZW1vdGVQZWVyfSBwZWVyIFRoZSBuZXcgcGVlclxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIHBlZXIgbGVmdCB0aGUgcm9vbS5cbiAgICAgKiBAZXZlbnQgcGVlcl9sZWZ0XG4gICAgICogQHBhcmFtIHtydGMuUmVtb3RlUGVlcn0gcGVlciBUaGUgcGVlciB3aGljaCBsZWZ0XG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIEEgcGVlciBjaGFuZ2VkIGl0cyBzdGF0dXMuXG4gICAgICogQGV2ZW50IHBlZXJfc3RhdHVzX2NoYW5nZWRcbiAgICAgKiBAcGFyYW0ge3J0Yy5SZW1vdGVQZWVyfSBwZWVyIFRoZSBwZWVyIHdoaWNoIGNoYW5nZWQgaXRzIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0dXMgVGhlIG5ldyBzdGF0dXNcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHJvb20gd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHVuZGVybHlpbmcgc2lnbmFsaW5nIGltcGxlbWVudGF0aW9uIGFzIHByb3ZpZGVkIGluIGNvbnN0cnVjdG9yXG4gICAgICogQHByb3BlcnR5IHNpZ25hbGluZ1xuICAgICAqIEB0eXBlIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBsb2NhbCBwZWVyXG4gICAgICogQHByb3BlcnR5IGxvY2FsXG4gICAgICogQHR5cGUgcnRjLkxvY2FsUGVlclxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gUm9vbShzaWduYWxpbmcsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjaGFubmVsO1xuICAgICAgdGhpcy5zaWduYWxpbmcgPSBzaWduYWxpbmc7XG4gICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zICE9IG51bGwgPyBvcHRpb25zIDoge307XG4gICAgICBpZiAodHlwZW9mIHRoaXMuc2lnbmFsaW5nID09PSAnc3RyaW5nJyB8fCB0aGlzLnNpZ25hbGluZyBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgICAgICBjaGFubmVsID0gbmV3IFdlYlNvY2tldENoYW5uZWwodGhpcy5zaWduYWxpbmcpO1xuICAgICAgICB0aGlzLnNpZ25hbGluZyA9IG5ldyBNdWNTaWduYWxpbmcoY2hhbm5lbCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsID0gdGhpcy5vcHRpb25zLmxvY2FsIHx8IG5ldyBMb2NhbFBlZXIoKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLnNldFN0YXR1cyh0aGlzLmxvY2FsLl9zdGF0dXMpO1xuICAgICAgdGhpcy5sb2NhbC5vbignc3RhdHVzX2NoYW5nZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zaWduYWxpbmcuc2V0U3RhdHVzKF90aGlzLmxvY2FsLl9zdGF0dXMpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ3BlZXJfam9pbmVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzaWduYWxpbmdfcGVlcikge1xuICAgICAgICAgIHZhciBwYywgcGVlcjtcbiAgICAgICAgICBwYyA9IG5ldyBQZWVyQ29ubmVjdGlvbihzaWduYWxpbmdfcGVlci5maXJzdCwgX3RoaXMub3B0aW9ucyk7XG4gICAgICAgICAgcGVlciA9IF90aGlzLmNyZWF0ZVBlZXIocGMsIHNpZ25hbGluZ19wZWVyKTtcbiAgICAgICAgICBwZWVyLm9uKCdzdGF0dXNfY2hhbmdlZCcsIGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3BlZXJfc3RhdHVzX2NoYW5nZWQnLCBwZWVyLCBzdGF0dXMpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHBlZXIub24oJ2xlZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5wZWVyc1tzaWduYWxpbmdfcGVlci5pZF07XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgncGVlcl9sZWZ0JywgcGVlcik7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdID0gcGVlcjtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgIHJldHVybiBwZWVyLm9uKCdjbG9zZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWxldGUgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogSm9pbnMgdGhlIHJvb20uIEluaXRpYXRlcyBjb25uZWN0aW9uIHRvIHNpZ25hbGluZyBzZXJ2ZXIgaWYgbm90IGRvbmUgYmVmb3JlLlxuICAgICAqIEBtZXRob2Qgam9pblxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIHJvb20gd2FzIGpvaW5lZFxuICAgICAqL1xuXG4gICAgUm9vbS5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuam9pbl9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5qb2luX3AgPSB0aGlzLnNpZ25hbGluZy5jb25uZWN0KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5qb2luX3A7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTGVhdmVzIHRoZSByb29tIGFuZCBjbG9zZXMgYWxsIGVzdGFibGlzaGVkIHBlZXIgY29ubmVjdGlvbnNcbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLmxlYXZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xlYW5zIHVwIGFsbCByZXNvdXJjZXMgdXNlZCBieSB0aGUgcm9vbS5cbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcubGVhdmUoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgcmVtb3RlIHBlZXIuIE92ZXJ3cml0ZSB0byB1c2UgeW91ciBvd24gY2xhc3MgZm9yIHBlZXJzLlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQG1ldGhvZCBjcmVhdGVfcGVlclxuICAgICAqIEBwYXJhbSB7cnRjLlBlZXJDb25uZWN0aW9ufSBwYyBUaGUgUGVlckNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKiBAcGFyYW0ge3J0Yy5TaWduYWxpbmdQZWVyfSBzaWduYWxpbmdfcGVlciBUaGUgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKi9cblxuICAgIFJvb20ucHJvdG90eXBlLmNyZWF0ZVBlZXIgPSBmdW5jdGlvbihwYywgc2lnbmFsaW5nX3BlZXIpIHtcbiAgICAgIHJldHVybiBuZXcgUmVtb3RlUGVlcihwYywgc2lnbmFsaW5nX3BlZXIsIHRoaXMubG9jYWwsIHRoaXMub3B0aW9ucyk7XG4gICAgfTtcblxuICAgIHJldHVybiBSb29tO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBDYWxsaW5nLCBDYWxsaW5nSW5JbnZpdGF0aW9uLCBDYWxsaW5nSW52aXRhdGlvblJvb20sIENhbGxpbmdOYW1lc3BhY2UsIENhbGxpbmdOYW1lc3BhY2VSb29tLCBDYWxsaW5nTmFtZXNwYWNlUm9vbVBlZXIsIENhbGxpbmdOYW1lc3BhY2VVc2VyLCBDYWxsaW5nT3V0SW52aXRhdGlvbiwgQ2FsbGluZ1BlZXIsIENhbGxpbmdSb29tLCBDYWxsaW5nU2lnbmFsaW5nLCBDYWxsaW5nU2lnbmFsaW5nUGVlciwgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgUmVtb3RlUGVlciwgUm9vbSwgZXh0ZW5kLCByZWYsXG4gICAgZXh0ZW5kMSA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKSwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZDtcblxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKTtcblxuICBSb29tID0gcmVxdWlyZSgnLi4vcm9vbScpLlJvb207XG5cbiAgUmVtb3RlUGVlciA9IHJlcXVpcmUoJy4uL3JlbW90ZV9wZWVyJykuUmVtb3RlUGVlcjtcblxuICBDYWxsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmcsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZyhjaGFubmVsLCByb29tX29wdGlvbnMpIHtcbiAgICAgIHZhciBoZWxsb19kO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMucm9vbV9vcHRpb25zID0gcm9vbV9vcHRpb25zO1xuICAgICAgdGhpcy5uZXh0X3RpZCA9IDA7XG4gICAgICB0aGlzLmFuc3dlcnMgPSB7fTtcbiAgICAgIGhlbGxvX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuaGVsbG9fcCA9IGhlbGxvX2QucHJvbWlzZTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgdmFyIGFuc3dlciwgaW52aXRhdGlvbiwgcm9vbTtcbiAgICAgICAgICBfdGhpcy5yZXNldFBpbmcoKTtcbiAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdoZWxsbyc6XG4gICAgICAgICAgICAgIF90aGlzLmlkID0gbXNnLmlkO1xuICAgICAgICAgICAgICByZXR1cm4gaGVsbG9fZC5yZXNvbHZlKG1zZy5zZXJ2ZXIpO1xuICAgICAgICAgICAgY2FzZSAnYW5zd2VyJzpcbiAgICAgICAgICAgICAgaWYgKG1zZy50aWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdNaXNzaW5nIHRyYW5zYWN0aW9uIGlkIGluIGFuc3dlcicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhbnN3ZXIgPSBfdGhpcy5hbnN3ZXJzW21zZy50aWRdO1xuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMuYW5zd2Vyc1ttc2cudGlkXTtcbiAgICAgICAgICAgICAgaWYgKGFuc3dlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Fuc3dlciB3aXRob3V0IGV4cGVjdGluZyBpdCcpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoYW5zd2VyLnJlc29sdmUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChtc2cuZXJyb3IgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGFuc3dlci5yZWplY3QobmV3IEVycm9yKG1zZy5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYW5zd2VyLnJlc29sdmUobXNnLmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobXNnLmVycm9yICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBhbnN3ZXIobmV3IEVycm9yKG1zZy5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYW5zd2VyKHZvaWQgMCwgbXNnLmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2ludml0ZV9pbmNvbWluZyc6XG4gICAgICAgICAgICAgIGlmICgobXNnLmhhbmRsZSA9PSBudWxsKSB8fCAobXNnLnNlbmRlciA9PSBudWxsKSB8fCAhbXNnLnJvb20gfHwgKG1zZy5zdGF0dXMgPT0gbnVsbCkgfHwgKG1zZy5wZWVycyA9PSBudWxsKSB8fCAobXNnLmRhdGEgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkludmFsaWQgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW52aXRhdGlvbiA9IG5ldyBDYWxsaW5nSW5JbnZpdGF0aW9uKF90aGlzLCBtc2cuaGFuZGxlKTtcbiAgICAgICAgICAgICAgcm9vbSA9IG5ldyBDYWxsaW5nSW52aXRhdGlvblJvb20oaW52aXRhdGlvbiwgX3RoaXMucm9vbV9vcHRpb25zLCBtc2cuc2VuZGVyLCBtc2cuZGF0YSk7XG4gICAgICAgICAgICAgIHJvb20uc2lnbmFsaW5nLmluaXQobXNnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2ludml0YXRpb24nLCByb29tKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgaWYgKF90aGlzLnBpbmdfaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoX3RoaXMucGluZ19pbnRlcnZhbCk7XG4gICAgICAgICAgICByZXR1cm4gZGVsZXRlIF90aGlzLnBpbmdfaW50ZXJ2YWw7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIENhbGxpbmcucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuY29ubmVjdCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5yZXNldFBpbmcoKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuaGVsbG9fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucmVxdWVzdCA9IGZ1bmN0aW9uKG1zZywgY2IpIHtcbiAgICAgIHZhciBkZWZlcjtcbiAgICAgIG1zZy50aWQgPSB0aGlzLm5leHRfdGlkKys7XG4gICAgICB0aGlzLmNoYW5uZWwuc2VuZChtc2cpO1xuICAgICAgdGhpcy5yZXNldFBpbmcoKTtcbiAgICAgIGlmIChjYiAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuYW5zd2Vyc1ttc2cudGlkXSA9IGNiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5hbnN3ZXJzW21zZy50aWRdID0gZGVmZXI7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDYWxsaW5nLnByb3RvdHlwZS5waW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHtcbiAgICAgICAgdHlwZTogJ3BpbmcnXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucmVzZXRQaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5waW5nX3RpbWVvdXQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucGluZ190aW1lb3V0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnBpbmdfdGltZW91dCA9IHNldFRpbWVvdXQoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5waW5nKCk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnJlc2V0UGluZygpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyksIDIgKiA2MCAqIDEwMDApO1xuICAgIH07XG5cbiAgICBDYWxsaW5nLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihuc2lkKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucmVxdWVzdCh7XG4gICAgICAgICAgICB0eXBlOiAnbnNfc3Vic2NyaWJlJyxcbiAgICAgICAgICAgIG5hbWVzcGFjZTogbnNpZFxuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIGlkLCBuYW1lc3BhY2UsIHJlZjEsIHJlZjIsIHJvb20sIHN0YXR1cztcbiAgICAgICAgICAgIGlmIChlcnIgIT0gbnVsbCkge1xuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuYW1lc3BhY2UgPSBuZXcgQ2FsbGluZ05hbWVzcGFjZShfdGhpcywgbnNpZCk7XG4gICAgICAgICAgICAgIHJlZjEgPSBkYXRhLnVzZXJzO1xuICAgICAgICAgICAgICBmb3IgKGlkIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSByZWYxW2lkXTtcbiAgICAgICAgICAgICAgICBuYW1lc3BhY2UuYWRkVXNlcihpZCwgc3RhdHVzKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZWYyID0gZGF0YS5yb29tcztcbiAgICAgICAgICAgICAgZm9yIChpZCBpbiByZWYyKSB7XG4gICAgICAgICAgICAgICAgcm9vbSA9IHJlZjJbaWRdO1xuICAgICAgICAgICAgICAgIG5hbWVzcGFjZS5hZGRSb29tKGlkLCByb29tLnN0YXR1cywgcm9vbS5wZWVycyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUobmFtZXNwYWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbihuYW1lc3BhY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAnbnNfdXNlcl9yZWdpc3RlcicsXG4gICAgICAgIG5hbWVzcGFjZTogbmFtZXNwYWNlXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUudW5yZWdpc3RlciA9IGZ1bmN0aW9uKG5hbWVzcGFjZSkge1xuICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICduc191c2VyX3VucmVnaXN0ZXInLFxuICAgICAgICBuYW1lc3BhY2U6IG5hbWVzcGFjZVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIENhbGxpbmcucHJvdG90eXBlLnJvb20gPSBmdW5jdGlvbihyb29tLCBvcHRpb25zKSB7XG4gICAgICB2YXIgc2lnbmFsaW5nO1xuICAgICAgc2lnbmFsaW5nID0gdGhpcy5yb29tX3NpZ25hbGluZyhyb29tKTtcbiAgICAgIHJldHVybiBuZXcgQ2FsbGluZ1Jvb20oc2lnbmFsaW5nLCBvcHRpb25zIHx8IHRoaXMucm9vbV9vcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucm9vbV9zaWduYWxpbmcgPSBmdW5jdGlvbihyb29tKSB7XG4gICAgICByZXR1cm4gbmV3IENhbGxpbmdTaWduYWxpbmcodGhpcywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdGF0dXMsIGNiKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ3Jvb21fam9pbicsXG4gICAgICAgICAgICByb29tOiByb29tLFxuICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgICAgICB9LCBjYik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIENhbGxpbmcucHJvdG90eXBlLnNldFN0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICdzdGF0dXMnLFxuICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIENhbGxpbmcucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmNsb3NlKCk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWxsaW5nO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbiAgQ2FsbGluZ05hbWVzcGFjZSA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nTmFtZXNwYWNlLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdOYW1lc3BhY2UoY2FsbGluZywgaWQxKSB7XG4gICAgICB2YXIgbWVzc2FnZV9oYW5kbGVyO1xuICAgICAgdGhpcy5jYWxsaW5nID0gY2FsbGluZztcbiAgICAgIHRoaXMuaWQgPSBpZDE7XG4gICAgICB0aGlzLnVzZXJzID0ge307XG4gICAgICB0aGlzLnJvb21zID0ge307XG4gICAgICBtZXNzYWdlX2hhbmRsZXIgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgIHZhciBwZWVyLCByb29tLCB1c2VyO1xuICAgICAgICAgIGlmIChtc2cubmFtZXNwYWNlICE9PSBfdGhpcy5pZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICduc191c2VyX2FkZCc6XG4gICAgICAgICAgICAgIGlmICgobXNnLnVzZXIgPT0gbnVsbCkgfHwgKG1zZy5zdGF0dXMgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5hZGRVc2VyKG1zZy51c2VyLCBtc2cuc3RhdHVzKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3VzZXJfdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cudXNlciA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdXNlciA9IF90aGlzLnVzZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdVbmtub3duIHVzZXIgaW4gc3RhdHVzIGNoYW5nZScpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB1c2VyLnN0YXR1cyA9IG1zZy5zdGF0dXM7XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3VzZXJfY2hhbmdlZCcsIHVzZXIpO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCd1c2VyX3N0YXR1c19jaGFuZ2VkJywgdXNlciwgdXNlci5zdGF0dXMpO1xuICAgICAgICAgICAgICByZXR1cm4gdXNlci5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHVzZXIuc3RhdHVzKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3VzZXJfcm0nOlxuICAgICAgICAgICAgICBpZiAobXNnLnVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdXNlciA9IF90aGlzLnVzZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdVbmtub3duIHVzZXIgbGVhdmluZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMudXNlcnNbbXNnLnVzZXJdO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCd1c2VyX2NoYW5nZWQnLCB1c2VyKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgndXNlcl9sZWZ0JywgdXNlcik7XG4gICAgICAgICAgICAgIHJldHVybiB1c2VyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3Jvb21fYWRkJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cucm9vbSA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSB8fCAobXNnLnBlZXJzID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgbWVzc2FnZScpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuYWRkUm9vbShtc2cucm9vbSwgbXNnLnN0YXR1cywgbXNnLnBlZXJzKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3Jvb21fdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cucm9vbSA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcm9vbSA9IF90aGlzLnJvb21zW21zZy5yb29tXTtcbiAgICAgICAgICAgICAgaWYgKHJvb20gPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIHJvb20nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcm9vbS5zdGF0dXMgPSBtc2cuc3RhdHVzO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX2NoYW5nZWQnLCByb29tKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9zdGF0dXNfY2hhbmdlZCcsIHJvb20sIHJvb20uc3RhdHVzKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJvb20uZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCByb29tLnN0YXR1cyk7XG4gICAgICAgICAgICBjYXNlICduc19yb29tX3JtJzpcbiAgICAgICAgICAgICAgaWYgKG1zZy5yb29tID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJvb20gPSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIGlmIChyb29tID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCByb29tJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3Jvb21fY2hhbmdlZCcsIHJvb20pO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX2Nsb3NlZCcpO1xuICAgICAgICAgICAgICByZXR1cm4gcm9vbS5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3Jvb21fcGVlcl9hZGQnOlxuICAgICAgICAgICAgICBpZiAoKG1zZy5yb29tID09IG51bGwpIHx8IChtc2cudXNlciA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSB8fCAobXNnLnBlbmRpbmcgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJvb20gPSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIGlmIChyb29tID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCByb29tJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSByb29tLmFkZFBlZXIobXNnLnVzZXIsIG1zZy5zdGF0dXMsIG1zZy5wZW5kaW5nKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9jaGFuZ2VkJywgcm9vbSk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdyb29tX3BlZXJfam9pbmVkJywgcm9vbSwgcGVlcik7XG4gICAgICAgICAgICBjYXNlICduc19yb29tX3BlZXJfdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cucm9vbSA9PSBudWxsKSB8fCAobXNnLnVzZXIgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJvb20gPSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIHBlZXIgPSByb29tICE9IG51bGwgPyByb29tLnBlZXJzW21zZy51c2VyXSA6IHZvaWQgMDtcbiAgICAgICAgICAgICAgaWYgKHBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIHBlZXInKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG1zZy5zdGF0dXMgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHBlZXIuc3RhdHVzID0gbXNnLnN0YXR1cztcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX2NoYW5nZWQnLCByb29tKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX3BlZXJfc3RhdHVzX2NoYW5nZWQnLCByb29tLCBwZWVyLCBwZWVyLnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgcGVlci5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHBlZXIuc3RhdHVzKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoKG1zZy5wZW5kaW5nICE9IG51bGwpICYmIG1zZy5wZW5kaW5nID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHBlZXIucGVuZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHBlZXIuYWNjZXB0ZWRfZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9jaGFuZ2VkJywgcm9vbSk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9hY2NlcHRlZCcsIHBlZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwZWVyLmVtaXQoJ2FjY2VwdGVkJyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICduc19yb29tX3BlZXJfcm0nOlxuICAgICAgICAgICAgICBpZiAoKG1zZy5yb29tID09IG51bGwpIHx8IChtc2cudXNlciA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcm9vbSA9IF90aGlzLnJvb21zW21zZy5yb29tXTtcbiAgICAgICAgICAgICAgcGVlciA9IHJvb20gIT0gbnVsbCA/IHJvb20ucGVlcnNbbXNnLnVzZXJdIDogdm9pZCAwO1xuICAgICAgICAgICAgICBpZiAocGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgcGVlcicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMucm9vbXNbbXNnLnJvb21dLnBlZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9jaGFuZ2VkJywgcm9vbSk7XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3Jvb21fcGVlcl9sZWZ0Jywgcm9vbSwgcGVlcik7XG4gICAgICAgICAgICAgIHJldHVybiBwZWVyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGluZy5jaGFubmVsLm9uKCdtZXNzYWdlJywgbWVzc2FnZV9oYW5kbGVyKTtcbiAgICAgIHRoaXMub24oJ3Vuc3Vic2NyaWJlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNhbGxpbmcuY2hhbm5lbC5yZW1vdmVMaXN0ZW5lcignbWVzc2FnZScsIG1lc3NhZ2VfaGFuZGxlcik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgQ2FsbGluZ05hbWVzcGFjZS5wcm90b3R5cGUuYWRkVXNlciA9IGZ1bmN0aW9uKGlkLCBzdGF0dXMpIHtcbiAgICAgIHZhciB1c2VyO1xuICAgICAgdXNlciA9IG5ldyBDYWxsaW5nTmFtZXNwYWNlVXNlcihpZCwgc3RhdHVzKTtcbiAgICAgIHRoaXMudXNlcnNbaWRdID0gdXNlcjtcbiAgICAgIHRoaXMuZW1pdCgndXNlcl9jaGFuZ2VkJywgdXNlcik7XG4gICAgICB0aGlzLmVtaXQoJ3VzZXJfcmVnaXN0ZXJlZCcsIHVzZXIpO1xuICAgICAgcmV0dXJuIHVzZXI7XG4gICAgfTtcblxuICAgIENhbGxpbmdOYW1lc3BhY2UucHJvdG90eXBlLmFkZFJvb20gPSBmdW5jdGlvbihpZCwgc3RhdHVzLCBwZWVycykge1xuICAgICAgdmFyIHBlZXIsIHBlZXJfaWQsIHJvb207XG4gICAgICByb29tID0gbmV3IENhbGxpbmdOYW1lc3BhY2VSb29tKGlkLCBzdGF0dXMpO1xuICAgICAgZm9yIChwZWVyX2lkIGluIHBlZXJzKSB7XG4gICAgICAgIHBlZXIgPSBwZWVyc1twZWVyX2lkXTtcbiAgICAgICAgcm9vbS5hZGRQZWVyKHBlZXJfaWQsIHBlZXIuc3RhdHVzLCBwZWVyLnBlbmRpbmcpO1xuICAgICAgfVxuICAgICAgdGhpcy5yb29tc1tpZF0gPSByb29tO1xuICAgICAgdGhpcy5lbWl0KCdyb29tX2NoYW5nZWQnLCByb29tKTtcbiAgICAgIHRoaXMuZW1pdCgncm9vbV9yZWdpc3RlcmVkJywgcm9vbSk7XG4gICAgICByZXR1cm4gcm9vbTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ05hbWVzcGFjZS5wcm90b3R5cGUudW5zdWJzY3JpYmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ25zX3Vuc3Vic2NyaWJlJyxcbiAgICAgICAgICAgIG5hbWVzcGFjZTogX3RoaXMuaWRcbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHZhciBfLCByZWYxLCB1c2VyO1xuICAgICAgICAgICAgaWYgKGVyciAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlZjEgPSBfdGhpcy51c2VycztcbiAgICAgICAgICAgICAgZm9yIChfIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICB1c2VyID0gcmVmMVtfXTtcbiAgICAgICAgICAgICAgICB1c2VyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy51c2VycyA9IHt9O1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCd1bnN1YnNjcmliZWQnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdOYW1lc3BhY2U7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nTmFtZXNwYWNlVXNlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nTmFtZXNwYWNlVXNlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBDYWxsaW5nTmFtZXNwYWNlVXNlcihpZDEsIHN0YXR1czEsIHBlbmRpbmcxKSB7XG4gICAgICB0aGlzLmlkID0gaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZW5kaW5nID0gcGVuZGluZzE7XG4gICAgfVxuXG4gICAgcmV0dXJuIENhbGxpbmdOYW1lc3BhY2VVc2VyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbiAgQ2FsbGluZ05hbWVzcGFjZVJvb20gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZDEoQ2FsbGluZ05hbWVzcGFjZVJvb20sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ05hbWVzcGFjZVJvb20oaWQxLCBzdGF0dXMxKSB7XG4gICAgICB0aGlzLmlkID0gaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgIH1cblxuICAgIENhbGxpbmdOYW1lc3BhY2VSb29tLnByb3RvdHlwZS5hZGRQZWVyID0gZnVuY3Rpb24oaWQsIHN0YXR1cywgcGVuZGluZykge1xuICAgICAgdmFyIHBlZXI7XG4gICAgICBwZWVyID0gbmV3IENhbGxpbmdOYW1lc3BhY2VSb29tUGVlcihpZCwgc3RhdHVzLCBwZW5kaW5nKTtcbiAgICAgIHRoaXMucGVlcnNbaWRdID0gcGVlcjtcbiAgICAgIHRoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgIHJldHVybiBwZWVyO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ05hbWVzcGFjZVJvb207XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nTmFtZXNwYWNlUm9vbVBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZDEoQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdOYW1lc3BhY2VSb29tUGVlcihpZDEsIHN0YXR1czEsIHBlbmRpbmcxKSB7XG4gICAgICB0aGlzLmlkID0gaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZW5kaW5nID0gcGVuZGluZzE7XG4gICAgICB0aGlzLmFjY2VwdGVkX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIGlmICghdGhpcy5wZW5kaW5nKSB7XG4gICAgICAgIHRoaXMuYWNjZXB0ZWRfZC5yZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLm9uKCdsZWZ0JywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuYWNjZXB0ZWRfZC5yZWplY3QoXCJQZWVyIGxlZnRcIik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyLnByb3RvdHlwZS5hY2NlcHRlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuYWNjZXB0ZWRfZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbiAgQ2FsbGluZ1NpZ25hbGluZyA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdTaWduYWxpbmcoY2FsbGluZywgY29ubmVjdF9mdW4pIHtcbiAgICAgIHZhciBtZXNzYWdlX2hhbmRsZXI7XG4gICAgICB0aGlzLmNhbGxpbmcgPSBjYWxsaW5nO1xuICAgICAgdGhpcy5jb25uZWN0X2Z1biA9IGNvbm5lY3RfZnVuO1xuICAgICAgdGhpcy5wZWVyX3N0YXR1cyA9IHt9O1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgICAgbWVzc2FnZV9oYW5kbGVyID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICB2YXIgcGVlcjtcbiAgICAgICAgICBpZiAobXNnLnJvb20gIT09IF90aGlzLmlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ3Jvb21fdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKG1zZy5zdGF0dXMgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy5zdGF0dXMgPSBtc2cuc3RhdHVzO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCBfdGhpcy5zdGF0dXMpO1xuICAgICAgICAgICAgY2FzZSAncm9vbV9wZWVyX2FkZCc6XG4gICAgICAgICAgICAgIGlmICgobXNnLnVzZXIgPT0gbnVsbCkgfHwgKG1zZy5wZW5kaW5nID09IG51bGwpIHx8IChtc2cuc3RhdHVzID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJJbnZhbGlkIG1lc3NhZ2VcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5hZGRQZWVyKG1zZy51c2VyLCBtc2cuc3RhdHVzLCBtc2cucGVuZGluZywgdHJ1ZSk7XG4gICAgICAgICAgICBjYXNlICdyb29tX3BlZXJfcm0nOlxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZpbmcnKTtcbiAgICAgICAgICAgICAgaWYgKG1zZy51c2VyID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkludmFsaWQgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGVlciA9IF90aGlzLnBlZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVW5rbm93biBwZWVyIGFjY2VwdGVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMucGVlcnNbbXNnLnVzZXJdO1xuICAgICAgICAgICAgICBwZWVyLmFjY2VwdGVkX2QucmVqZWN0KFwiVXNlciBsZWZ0XCIpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZlZCcsIF90aGlzLnBlZXJzKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9sZWZ0JywgcGVlcik7XG4gICAgICAgICAgICAgIHJldHVybiBwZWVyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgIGNhc2UgJ3Jvb21fcGVlcl91cGRhdGUnOlxuICAgICAgICAgICAgICBpZiAobXNnLnVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwZWVyID0gX3RoaXMucGVlcnNbbXNnLnVzZXJdO1xuICAgICAgICAgICAgICBpZiAocGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJVbmtub3duIHBlZXIgYWNjZXB0ZWRcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChtc2cuc3RhdHVzICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwZWVyLnN0YXR1cyA9IG1zZy5zdGF0dXM7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9zdGF0dXNfY2hhbmdlZCcsIHBlZXIsIHBlZXIuc3RhdHVzKTtcbiAgICAgICAgICAgICAgICBwZWVyLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgcGVlci5zdGF0dXMpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICgobXNnLnBlbmRpbmcgIT0gbnVsbCkgJiYgbXNnLnBlbmRpbmcgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcGVlci5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcGVlci5hY2NlcHRlZF9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2FjY2VwdGVkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBlZXIuZW1pdCgnYWNjZXB0ZWQnKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3Jvb21fcGVlcl9mcm9tJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cudXNlciA9PSBudWxsKSB8fCAobXNnLmV2ZW50ID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJJbnZhbGlkIG1lc3NhZ2VcIiwgbXNnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGVlciA9IF90aGlzLnBlZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVW5rbm93biBwZWVyIGFjY2VwdGVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2xlZnQnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHBlZXIuZW1pdChtc2cuZXZlbnQsIG1zZy5kYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGluZy5jaGFubmVsLm9uKCdtZXNzYWdlJywgbWVzc2FnZV9oYW5kbGVyKTtcbiAgICAgIHRoaXMub24oJ2xlZnQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCBtZXNzYWdlX2hhbmRsZXIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIENhbGxpbmdTaWduYWxpbmcucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgZW50cnksIHJlZjEsIHVzZXI7XG4gICAgICBpZiAodGhpcy5pbml0aWFsaXplZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSb29tIGlzIGFscmVhZHkgaW5pdGlhbGl6ZWRcIik7XG4gICAgICB9XG4gICAgICBpZiAoKGRhdGEucm9vbSA9PSBudWxsKSB8fCAoZGF0YS5wZWVycyA9PSBudWxsKSB8fCAoZGF0YS5zdGF0dXMgPT0gbnVsbCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW5pdGlhbGl6YXRpb24gZGF0YVwiKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaWQgPSBkYXRhLnJvb207XG4gICAgICB0aGlzLnN0YXR1cyA9IGRhdGEuc3RhdHVzO1xuICAgICAgcmVmMSA9IGRhdGEucGVlcnM7XG4gICAgICBmb3IgKHVzZXIgaW4gcmVmMSkge1xuICAgICAgICBlbnRyeSA9IHJlZjFbdXNlcl07XG4gICAgICAgIHRoaXMuYWRkUGVlcih1c2VyLCBlbnRyeS5zdGF0dXMsIGVudHJ5LnBlbmRpbmcsIGZhbHNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY29ubmVjdF9mdW4oX3RoaXMucGVlcl9zdGF0dXMsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIF90aGlzLmluaXQocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFfdGhpcy5pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIk1pc3NpbmcgaW5mb3JtYXRpb24gZnJvbSBjb25uZWN0IHJlc3BvbnNlXCIpKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS5hZGRQZWVyID0gZnVuY3Rpb24oaWQsIHN0YXR1cywgcGVuZGluZywgZmlyc3QpIHtcbiAgICAgIHZhciBwZWVyO1xuICAgICAgcGVlciA9IG5ldyBDYWxsaW5nU2lnbmFsaW5nUGVlcih0aGlzLCBpZCwgc3RhdHVzLCBwZW5kaW5nLCBmaXJzdCk7XG4gICAgICB0aGlzLnBlZXJzW2lkXSA9IHBlZXI7XG4gICAgICB0aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICByZXR1cm4gcGVlcjtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZy5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ3Jvb21fbGVhdmUnLFxuICAgICAgICAgICAgcm9vbTogX3RoaXMuaWRcbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHZhciBfLCBwZWVyLCByZWYxO1xuICAgICAgICAgICAgX3RoaXMuZW1pdCgnbGVmdCcpO1xuICAgICAgICAgICAgcmVmMSA9IF90aGlzLnBlZXJzO1xuICAgICAgICAgICAgZm9yIChfIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgcGVlciA9IHJlZjFbX107XG4gICAgICAgICAgICAgIHBlZXIuZW1pdCgnbGVmdCcpO1xuICAgICAgICAgICAgICBwZWVyLmFjY2VwdGVkX2QucmVqZWN0KFwiWW91IGxlZnQgdGhlIHJvb21cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS5zZXRTdGF0dXMgPSBmdW5jdGlvbihzdGF0dXMpIHtcbiAgICAgIHRoaXMucGVlcl9zdGF0dXMgPSBzdGF0dXM7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgIHR5cGU6ICdyb29tX3BlZXJfc3RhdHVzJyxcbiAgICAgICAgICByb29tOiB0aGlzLmlkLFxuICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS5pbnZpdGUgPSBmdW5jdGlvbih1c2VyLCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ2ludml0ZV9zZW5kJyxcbiAgICAgICAgICAgIHJvb206IF90aGlzLmlkLFxuICAgICAgICAgICAgdXNlcjogdXNlci5pZCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgICAgdmFyIGludml0YXRpb247XG4gICAgICAgICAgICBpZiAoZXJyICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKHJlcy5oYW5kbGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJJbnZhbGlkIHJlc3BvbnNlXCIpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW52aXRhdGlvbiA9IG5ldyBDYWxsaW5nT3V0SW52aXRhdGlvbihfdGhpcy5jYWxsaW5nLCByZXMuaGFuZGxlLCB1c2VyKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoaW52aXRhdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIENhbGxpbmdTaWduYWxpbmcucHJvdG90eXBlLnNldFJvb21TdGF0dXNTYWZlID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ3Jvb21fc3RhdHVzJyxcbiAgICAgICAgICAgIHJvb206IF90aGlzLmlkLFxuICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICBjaGVjazogdHJ1ZSxcbiAgICAgICAgICAgIHByZXZpb3VzOiBwcmV2aW91c1xuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuc3RhdHVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgX3RoaXMuc3RhdHVzKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIENhbGxpbmdTaWduYWxpbmcucHJvdG90eXBlLnNldFJvb21TdGF0dXMgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuY2FsbGluZy5yZXF1ZXN0KHtcbiAgICAgICAgICAgIHR5cGU6ICdyb29tX3N0YXR1cycsXG4gICAgICAgICAgICByb29tOiBfdGhpcy5pZCxcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlXG4gICAgICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfdGhpcy5zdGF0dXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgX3RoaXMuZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCBfdGhpcy5zdGF0dXMpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZy5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbihuYW1lc3BhY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGxpbmcucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICduc19yb29tX3JlZ2lzdGVyJyxcbiAgICAgICAgbmFtZXNwYWNlOiBuYW1lc3BhY2UsXG4gICAgICAgIHJvb206IHRoaXMuaWRcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS51bnJlZ2lzdGVyID0gZnVuY3Rpb24obmFtZXNwYWNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAnbnNfcm9vbV91bnJlZ2lzdGVyJyxcbiAgICAgICAgbmFtZXNwYWNlOiBuYW1lc3BhY2UsXG4gICAgICAgIHJvb206IHRoaXMuaWRcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ1NpZ25hbGluZztcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG4gIENhbGxpbmdTaWduYWxpbmdQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmdTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdTaWduYWxpbmdQZWVyKHJvb20xLCBpZDEsIHN0YXR1czEsIHBlbmRpbmcxLCBmaXJzdDEpIHtcbiAgICAgIHRoaXMucm9vbSA9IHJvb20xO1xuICAgICAgdGhpcy5pZCA9IGlkMTtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMucGVuZGluZyA9IHBlbmRpbmcxO1xuICAgICAgdGhpcy5maXJzdCA9IGZpcnN0MTtcbiAgICAgIHRoaXMuYWNjZXB0ZWRfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgaWYgKCF0aGlzLnBlbmRpbmcpIHtcbiAgICAgICAgdGhpcy5hY2NlcHRlZF9kLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuYWNjZXB0ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmFjY2VwdGVkX2QucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vbS5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAncm9vbV9wZWVyX3RvJyxcbiAgICAgICAgcm9vbTogdGhpcy5yb29tLmlkLFxuICAgICAgICB1c2VyOiB0aGlzLmlkLFxuICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgIGRhdGE6IGRhdGFcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ1NpZ25hbGluZ1BlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nSW5JbnZpdGF0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmdJbkludml0YXRpb24sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ0luSW52aXRhdGlvbihjYWxsaW5nLCBoYW5kbGUsIHNlbmRlciwgZGF0YTEpIHtcbiAgICAgIHZhciBtZXNzYWdlX2hhbmRsZXI7XG4gICAgICB0aGlzLmNhbGxpbmcgPSBjYWxsaW5nO1xuICAgICAgdGhpcy5oYW5kbGUgPSBoYW5kbGU7XG4gICAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcbiAgICAgIHRoaXMuZGF0YSA9IGRhdGExO1xuICAgICAgdGhpcy5jYW5jZWxsZWQgPSBmYWxzZTtcbiAgICAgIG1lc3NhZ2VfaGFuZGxlciA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgaWYgKG1zZy5oYW5kbGUgIT09IF90aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdpbnZpdGVfY2FuY2VsbGVkJzpcbiAgICAgICAgICAgICAgX3RoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgnY2FuY2VsbGVkJyk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdoYW5kbGVkJywgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jYWxsaW5nLmNoYW5uZWwub24oJ21lc3NhZ2UnLCBtZXNzYWdlX2hhbmRsZXIpO1xuICAgICAgdGhpcy5vbignaGFuZGxlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNhbGxpbmcuY2hhbm5lbC5yZW1vdmVMaXN0ZW5lcignbWVzc2FnZScsIG1lc3NhZ2VfaGFuZGxlcik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgQ2FsbGluZ0luSW52aXRhdGlvbi5wcm90b3R5cGUuc2lnbmFsaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IENhbGxpbmdTaWduYWxpbmcodGhpcy5jYWxsaW5nLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0YXR1cywgY2IpIHtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdoYW5kbGVkJywgdHJ1ZSk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNhbGxpbmcucmVxdWVzdCh7XG4gICAgICAgICAgICB0eXBlOiAnaW52aXRlX2FjY2VwdCcsXG4gICAgICAgICAgICBoYW5kbGU6IF90aGlzLmhhbmRsZSxcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgICAgfSwgY2IpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBDYWxsaW5nSW5JbnZpdGF0aW9uLnByb3RvdHlwZS5kZW55ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmVtaXQoJ2hhbmRsZWQnLCBmYWxzZSk7XG4gICAgICByZXR1cm4gdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAnaW52aXRlX2RlbnknLFxuICAgICAgICBoYW5kbGU6IHRoaXMuaGFuZGxlXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdJbkludml0YXRpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nT3V0SW52aXRhdGlvbiA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBDYWxsaW5nT3V0SW52aXRhdGlvbihjYWxsaW5nLCBoYW5kbGUsIHVzZXIxKSB7XG4gICAgICB2YXIgY2xlYW51cCwgbWVzc2FnZV9oYW5kbGVyO1xuICAgICAgdGhpcy5jYWxsaW5nID0gY2FsbGluZztcbiAgICAgIHRoaXMuaGFuZGxlID0gaGFuZGxlO1xuICAgICAgdGhpcy51c2VyID0gdXNlcjE7XG4gICAgICB0aGlzLmRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLnBlbmRpbmcgPSB0cnVlO1xuICAgICAgbWVzc2FnZV9oYW5kbGVyID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICBpZiAobXNnLmhhbmRsZSAhPT0gX3RoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2ludml0ZV9yZXNwb25zZSc6XG4gICAgICAgICAgICAgIGlmIChtc2cuYWNjZXB0ZWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5kZWZlci5yZXNvbHZlKG1zZy5hY2NlcHRlZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLmNhbGxpbmcuY2hhbm5lbC5vbignbWVzc2FnZScsIG1lc3NhZ2VfaGFuZGxlcik7XG4gICAgICBjbGVhbnVwID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuY2FsbGluZy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgbWVzc2FnZV9oYW5kbGVyKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5kZWZlci5wcm9taXNlLnRoZW4oY2xlYW51cCwgY2xlYW51cCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgQ2FsbGluZ091dEludml0YXRpb24ucHJvdG90eXBlLnJlc3BvbnNlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZWZlci5wcm9taXNlO1xuICAgIH07XG5cbiAgICBDYWxsaW5nT3V0SW52aXRhdGlvbi5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnBlbmRpbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybiB0aGlzLmNhbGxpbmcucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICdpbnZpdGVfY2FuY2VsJyxcbiAgICAgICAgaGFuZGxlOiB0aGlzLmhhbmRsZVxuICAgICAgfSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF90aGlzLmRlZmVyLnJlamVjdChuZXcgRXJyb3IoXCJJbnZpdGF0aW9uIGNhbmNlbGxlZFwiKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWxsaW5nT3V0SW52aXRhdGlvbjtcblxuICB9KSgpO1xuXG4gIENhbGxpbmdSb29tID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmdSb29tLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdSb29tKHNpZ25hbGluZywgb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IGV4dGVuZCh7XG4gICAgICAgIGF1dG9fY29ubmVjdDogZmFsc2VcbiAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgQ2FsbGluZ1Jvb20uX19zdXBlcl9fLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgc2lnbmFsaW5nLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBDYWxsaW5nUm9vbS5wcm90b3R5cGUuY3JlYXRlUGVlciA9IGZ1bmN0aW9uKHBjLCBzaWduYWxpbmcpIHtcbiAgICAgIHJldHVybiBuZXcgQ2FsbGluZ1BlZXIocGMsIHNpZ25hbGluZywgdGhpcy5sb2NhbCwgdGhpcy5vcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1Jvb20ucHJvdG90eXBlLmludml0ZSA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5pbnZpdGUodXNlcik7XG4gICAgfTtcblxuICAgIENhbGxpbmdSb29tLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uKG5zaWQpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5yZWdpc3Rlcihuc2lkKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1Jvb20ucHJvdG90eXBlLnVucmVnaXN0ZXIgPSBmdW5jdGlvbihuc2lkKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcudW5yZWdpc3Rlcihuc2lkKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdSb29tO1xuXG4gIH0pKFJvb20pO1xuXG4gIENhbGxpbmdJbnZpdGF0aW9uUm9vbSA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nSW52aXRhdGlvblJvb20sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ0ludml0YXRpb25Sb29tKGludml0YXRpb24xLCBvcHRpb25zLCBzZW5kZXJfaWQsIGRhdGExKSB7XG4gICAgICB0aGlzLmludml0YXRpb24gPSBpbnZpdGF0aW9uMTtcbiAgICAgIHRoaXMuc2VuZGVyX2lkID0gc2VuZGVyX2lkO1xuICAgICAgdGhpcy5kYXRhID0gZGF0YTE7XG4gICAgICBDYWxsaW5nSW52aXRhdGlvblJvb20uX19zdXBlcl9fLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgdGhpcy5pbnZpdGF0aW9uLnNpZ25hbGluZygpLCBvcHRpb25zKTtcbiAgICAgIHRoaXMuaW52aXRhdGlvbi5vbignY2FuY2VsbGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2FuY2VsbGVkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmludml0YXRpb24ub24oJ2hhbmRsZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGFjY2VwdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2hhbmRsZWQnLCBhY2NlcHRlZCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgQ2FsbGluZ0ludml0YXRpb25Sb29tLnByb3RvdHlwZS5zZW5kZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnBlZXJzW3RoaXMuc2VuZGVyX2lkXTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ0ludml0YXRpb25Sb29tLnByb3RvdHlwZS5kZW55ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pbnZpdGF0aW9uLmRlbnkoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdJbnZpdGF0aW9uUm9vbTtcblxuICB9KShDYWxsaW5nUm9vbSk7XG5cbiAgQ2FsbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZDEoQ2FsbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ1BlZXIocGMsIHNpZ25hbGluZywgbG9jYWwsIG9wdGlvbnMpIHtcbiAgICAgIENhbGxpbmdQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5jYWxsKHRoaXMsIHBjLCBzaWduYWxpbmcsIGxvY2FsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBDYWxsaW5nUGVlci5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLmFjY2VwdGVkKCkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBDYWxsaW5nUGVlci5fX3N1cGVyX18uY29ubmVjdC5jYWxsKF90aGlzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdQZWVyO1xuXG4gIH0pKFJlbW90ZVBlZXIpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgIENhbGxpbmc6IENhbGxpbmcsXG4gICAgQ2FsbGluZ05hbWVzcGFjZTogQ2FsbGluZ05hbWVzcGFjZSxcbiAgICBDYWxsaW5nTmFtZXNwYWNlVXNlcjogQ2FsbGluZ05hbWVzcGFjZVVzZXIsXG4gICAgQ2FsbGluZ05hbWVzcGFjZVJvb206IENhbGxpbmdOYW1lc3BhY2VSb29tLFxuICAgIENhbGxpbmdOYW1lc3BhY2VSb29tUGVlcjogQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyLFxuICAgIENhbGxpbmdTaWduYWxpbmc6IENhbGxpbmdTaWduYWxpbmcsXG4gICAgQ2FsbGluZ1NpZ25hbGluZ1BlZXI6IENhbGxpbmdTaWduYWxpbmdQZWVyLFxuICAgIENhbGxpbmdJbkludml0YXRpb246IENhbGxpbmdJbkludml0YXRpb24sXG4gICAgQ2FsbGluZ091dEludml0YXRpb246IENhbGxpbmdPdXRJbnZpdGF0aW9uXG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLCBTaWduYWxpbmcsIFNpZ25hbGluZ1BlZXIsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIERlZmVycmVkID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvcHJvbWlzZScpLkRlZmVycmVkO1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nJyksIFNpZ25hbGluZyA9IHJlZi5TaWduYWxpbmcsIFNpZ25hbGluZ1BlZXIgPSByZWYuU2lnbmFsaW5nUGVlcjtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBwZWVyIGZvciBtdWx0aSB1c2VyIGNoYXRzLlxuICAjXG4gICAqIEZvciBhIGRldGFpbGVkIGRlc2NyaXB0aW9uIG9mIHRoZSBzaWduYWxpbmcgcHJvdG9jb2wgc2VlIGBydGMuc2lnbmFsaW5nLk11Y1NpZ25hbGluZ2BcbiAgI1xuICAgKiBAZXh0ZW5kcyBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1BlZXJcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuTXVjU2lnbmFsaW5nUGVlclxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge3J0Yy5zaWduYWxpbmcuQ2hhbm5lbH0gY2hhbm5lbCBUaGUgY2hhbm5lbCB0byB0aGUgc2lnYW5saW5nIHNlcnZlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGVlcl9pZCBUaGUgaWQgb2YgdGhlIHJlbW90ZSBwZWVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0dXMgVGhlIHN0YXR1cyBvZiB0aGUgcmVtb3RlIHBlZXJcbiAgICogQHBhcmFtIHtCb29sZWFufSBmaXJzdCBXaGV0aGVyIHRoZSBsb2NhbCBwZWVyIHdhcyBpbiB0aGUgcm9vbSBiZWZvcmUgdGhlIHJlbW90ZSBwZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuTXVjU2lnbmFsaW5nUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKE11Y1NpZ25hbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgaWQgb2YgdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQHByb3BlcnR5IGlkXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBNdWNTaWduYWxpbmdQZWVyKGNoYW5uZWwsIGlkLCBzdGF0dXMxLCBmaXJzdCkge1xuICAgICAgdmFyIHJlY3ZfbXNnO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMuaWQgPSBpZDtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMuZmlyc3QgPSBmaXJzdDtcbiAgICAgIHJlY3ZfbXNnID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgaWYgKGRhdGEucGVlciAhPT0gX3RoaXMuaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGEudHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAoZGF0YS50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdmcm9tJzpcbiAgICAgICAgICAgICAgaWYgKChkYXRhLmV2ZW50ID09IG51bGwpIHx8IChkYXRhLmRhdGEgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgICAgIGNhc2UgJ3BlZXJfbGVmdCc6XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX3N0YXR1cyc6XG4gICAgICAgICAgICAgIF90aGlzLnN0YXR1cyA9IGRhdGEuc3RhdHVzO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCBfdGhpcy5zdGF0dXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgIH1cblxuICAgIE11Y1NpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkYXRhID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICB0eXBlOiAndG8nLFxuICAgICAgICBwZWVyOiB0aGlzLmlkLFxuICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgIGRhdGE6IGRhdGFcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gTXVjU2lnbmFsaW5nUGVlcjtcblxuICB9KShTaWduYWxpbmdQZWVyKTtcblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgZm9yIG11bHRpIHVzZXIgY2hhdHNcbiAgI1xuICAgKiBUaGUgZm9sbG93aW5nIG1lc3NhZ2VzIGFyZSBzZW50IHRvIHRoZSBzZXJ2ZXI6XG4gICNcbiAgICogICAgIC8vIGpvaW4gdGhlIHJvb20uIGhhcyB0byBiZSBzZW50IGJlZm9yZSBhbnkgb3RoZXIgbWVzc2FnZS5cbiAgICogICAgIC8vIHJlc3BvbnNlIHdpbGwgYmUgJ2pvaW5lZCcgb24gc3VjY2Vzc1xuICAgKiAgICAgLy8gb3RoZXIgcGVlcnMgaW4gdGhlIHJvb20gd2lsbCBnZXQgJ3BlZXJfam9pbmVkJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJqb2luXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gbGVhdmUgdGhlIHJvb20uIHNlcnZlciB3aWxsIGNsb3NlIHRoZSBjb25uZWN0aW5vLlxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJsZWF2ZVwiXG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHVwZGF0ZSBzdGF0dXMgb2JqZWN0XG4gICAqICAgICAvLyBvdGhlciBwZWVycyB3aWxsIGdldCAncGVlcl9zdGF0dXMnXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInN0YXR1c1wiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHNlbmQgbWVzc2FnZSB0byBhIHBlZXIuIHdpbGwgYmUgcmVjZWl2ZWQgYXMgJ2Zyb20nXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInRvXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJldmVudFwiOiBcImV2ZW50X2lkXCIsXG4gICAqICAgICAgIFwiZGF0YVwiOiB7IC4uIGN1c3RvbSBkYXRhIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiBUaGUgZm9sbG93aW5nIG1lc3NhZ2VzIGFyZSByZWNlaXZlZCBmb3JtIHRoZSBzZXJ2ZXI6XG4gICNcbiAgICogICAgIC8vIGpvaW5lZCB0aGUgcm9vbS4gaXMgdGhlIHJlc3BvbnNlIHRvICdqb2luJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJqb2luZWRcIixcbiAgICogICAgICAgXCJpZFwiOiBcIm93bl9pZFwiLFxuICAgKiAgICAgICBcInBlZXJzXCI6IHtcbiAgICogICAgICAgICBcInBlZXJfaWRcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgICB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIGFub3RoZXIgcGVlciBqb2luZWQgdGhlIHJvb20uXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInBlZXJfam9pbmVkXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJzdGF0dXNcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBhbm9zdGhlciBwZWVyIHVwZGF0ZWQgaXRzIHN0YXR1cyBvYmplY3QgdXNpbmcgJ3N0YXR1cydcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwicGVlcl9zdGF0dXNcIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIGFub3RoZXIgcGVlciBsZWZ0IHRoZSByb29tXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInBlZXJfbGVmdFwiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCJcbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gbWVzc2FnZSBmcm9tIGFub3RoZXIgcGVlciBzZW50IGJ5ICd0bydcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwiZnJvbVwiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCIsXG4gICAqICAgICAgIFwiZXZlbnRcIjogXCJldmVudF9pZFwiLFxuICAgKiAgICAgICBcImRhdGFcIjogeyAuLiBjdXN0b20gZGF0YSAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogVGhlIG1lc3NhZ2VzIHRyYW5zbWl0dGVkIGluIHRoZSBgdG9gL2Bmcm9tYCBtZXNzYWdlcyBhcmUgZW1pdHRlZCBhcyBldmVudHMgaW4gYE11Y1NpZ25hbGluZ1BlZXJgXG4gICNcbiAgICogQGV4dGVuZHMgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuTXVjU2lnbmFsaW5nXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLnNpZ25hbGluZy5DaGFubmVsfSBjaGFubmVsIFRoZSBjaGFubmVsIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAqL1xuXG4gIGV4cG9ydHMuTXVjU2lnbmFsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTXVjU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogVGhlIGlkIG9mIHRoZSBsb2NhbCBwZWVyLiBPbmx5IGF2YWlsYWJsZSBhZnRlciBqb2luaW5nLlxuICAgICAqIEBwcm9wZXJ0eSBpZFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gTXVjU2lnbmFsaW5nKGNoYW5uZWwpIHtcbiAgICAgIHZhciBqb2luX2Q7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5zdGF0dXMgPSB7fTtcbiAgICAgIGpvaW5fZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5qb2luX3AgPSBqb2luX2QucHJvbWlzZTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignY2xvc2VkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ21lc3NhZ2UnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICB2YXIgcGVlciwgcGVlcl9pZCwgcmVmMSwgc3RhdHVzO1xuICAgICAgICAgIGlmIChkYXRhLnR5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnam9pbmVkJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlcnMgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZWYxID0gZGF0YS5wZWVycztcbiAgICAgICAgICAgICAgZm9yIChwZWVyX2lkIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSByZWYxW3BlZXJfaWRdO1xuICAgICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIHBlZXJfaWQsIHN0YXR1cywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgX3RoaXMuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgICByZXR1cm4gam9pbl9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGNhc2UgJ3BlZXJfam9pbmVkJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIGRhdGEucGVlciwgZGF0YS5zdGF0dXMsIHRydWUpO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgTXVjU2lnbmFsaW5nLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbm5lY3RfcCA9IHRoaXMuY2hhbm5lbC5jb25uZWN0KCkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2pvaW4nLFxuICAgICAgICAgICAgICBzdGF0dXM6IF90aGlzLnN0YXR1c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmpvaW5fZDtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3A7XG4gICAgfTtcblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUuc2V0U3RhdHVzID0gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3AudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgICAgICAgdHlwZTogJ3N0YXR1cycsXG4gICAgICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIHR5cGU6ICdsZWF2ZSdcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gTXVjU2lnbmFsaW5nO1xuXG4gIH0pKFNpZ25hbGluZyk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgU2lnbmFsaW5nLCBTaWduYWxpbmdQZWVyLCByZWYsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICByZWYgPSByZXF1aXJlKCcuL3NpZ25hbGluZycpLCBTaWduYWxpbmcgPSByZWYuU2lnbmFsaW5nLCBTaWduYWxpbmdQZWVyID0gcmVmLlNpZ25hbGluZ1BlZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBwZWVyIGNvbXBhdGlibGUgd2l0aCB0aGUgZnJhbWluZyBvZiBwYWxhdmEgc2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLlBhbGF2YVNpZ25hbGluZ1BlZXJcbiAgICogQGV4dGVuZHMgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFBhbGF2YVNpZ25hbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gUGFsYXZhU2lnbmFsaW5nUGVlcihjaGFubmVsLCBpZCwgc3RhdHVzMSwgZmlyc3QpIHtcbiAgICAgIHZhciByZWN2X21zZztcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLmlkID0gaWQ7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1czE7XG4gICAgICB0aGlzLmZpcnN0ID0gZmlyc3Q7XG4gICAgICByZWN2X21zZyA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLnNlbmRlcl9pZCAhPT0gX3RoaXMuaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGEuZXZlbnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgX3RoaXMuc2VuZCgnZXJyb3InLCBcIkludmFsaWQgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgdGhpcy5vbigncGVlcl91cGRhdGVkX3N0YXR1cycsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMub24oJ3BlZXJfbGVmdCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgUGFsYXZhU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIGV2ZW50OiAnc2VuZF90b19wZWVyJyxcbiAgICAgICAgcGVlcl9pZDogdGhpcy5pZCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gUGFsYXZhU2lnbmFsaW5nUGVlcjtcblxuICB9KShTaWduYWxpbmdQZWVyKTtcblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgaW1wbGVtZW50YXRpb24gY29tcGF0aWJsZSB3aXRoIHRoZSBmcmFtaW5nIG9mIHBhbGF2YSBzaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuUGFsYXZhU2lnbmFsaW5nXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGFsYXZhU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBhbGF2YVNpZ25hbGluZyhjaGFubmVsLCByb29tMSwgc3RhdHVzMSkge1xuICAgICAgdmFyIGpvaW5fZDtcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLnJvb20gPSByb29tMTtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMucGVlcnMgPSB7fTtcbiAgICAgIHRoaXMuam9pbmVkID0gZmFsc2U7XG4gICAgICBqb2luX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuam9pbl9wID0gam9pbl9kLnByb21pc2U7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgdmFyIGksIHBlZXIsIHJlZjE7XG4gICAgICAgICAgaWYgKGRhdGEuZXZlbnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEuZXZlbnQpIHtcbiAgICAgICAgICAgIGNhc2UgJ2pvaW5lZF9yb29tJzpcbiAgICAgICAgICAgICAgaWYgKChkYXRhLnBlZXJzID09IG51bGwpIHx8IChkYXRhLm93bl9pZCA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZWYxID0gZGF0YS5wZWVycztcbiAgICAgICAgICAgICAgZm9yIChpIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gcmVmMVtpXTtcbiAgICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBkYXRhLnBlZXJfaWQsIGRhdGEuc3RhdHVzLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgX3RoaXMucGVlcnNbZGF0YS5wZWVyX2lkXSA9IHBlZXI7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gam9pbl9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGNhc2UgJ25ld19wZWVyJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlcl9pZCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5QYWxhdmFTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIGRhdGEucGVlcl9pZCwgZGF0YS5zdGF0dXMsIHRydWUpO1xuICAgICAgICAgICAgICBfdGhpcy5wZWVyc1tkYXRhLnBlZXJdID0gcGVlcjtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIFBhbGF2YVNpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSB0aGlzLmNoYW5uZWwuY29ubmVjdCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgICAgICAgIGV2ZW50OiAnam9pbl9yb29tJyxcbiAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbSxcbiAgICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG4gICAgUGFsYXZhU2lnbmFsaW5nLnByb3RvdHlwZS5zZXRfc3RhdHVzID0gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICBldmVudDogJ3VwZGF0ZV9zdGF0dXMnLFxuICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIFBhbGF2YVNpZ25hbGluZy5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuY2xvc2UoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBhbGF2YVNpZ25hbGluZztcblxuICB9KShTaWduYWxpbmcpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRXZlbnRFbWl0dGVyLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25jZXB0IG9mIGEgY2xhc3MgaW1wbGVtZW50aW5nIHNpZ25hbGluZy4gTWlnaHQgdXNlIGEgYHJ0Yy5zaWduYWxpbmcuQ2hhbm5lbGAgdG8gYWJzdHJhY3QgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNlcnZlci5cbiAgI1xuICAgKiBZb3UgZG8gbm90IGhhdmUgdG8gZXh0ZW5kIHRoaXMgY2xhYXNzLCBqdXN0IGltcGxlbWVudCB0aGUgZnVuY3Rpb25hbGl0eS5cbiAgI1xuICAgKiBAZXh0ZW5kcyBldmVudHMuRXZlbnRFbWl0dGVyXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1xuICAgKi9cblxuICBleHBvcnRzLlNpZ25hbGluZyA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFNpZ25hbGluZywgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBTaWduYWxpbmcoKSB7XG4gICAgICByZXR1cm4gU2lnbmFsaW5nLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgcGVlciBqb2luZWQgdGhlIHJvb21cbiAgICAgKiBAZXZlbnQgcGVlcl9qb2luZWRcbiAgICAgKiBAcGFyYW0ge3J0Yy5zaWduYWxpbmcuU2lnbmFsaW5nUGVlcn0gcGVlciBUaGUgbmV3IHBlZXJcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXIgd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogRXN0YWJsaXNoZXMgdGhlIGNvbm5lY3Rpb24gd2l0aCB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiB0aGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZFxuICAgICAqL1xuXG4gICAgU2lnbmFsaW5nLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIHRoZSBjb25uZWN0aW9uIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQG1ldGhvZCBjbG9zZVxuICAgICAqL1xuXG4gICAgU2lnbmFsaW5nLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsIHN0YXR1cyBvYmplY3QgYW5kIGJyb2FkY2FzdHMgdGhlIGNoYW5nZSB0byB0aGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHNldFN0YXR1c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogTmV3IHN0YXR1cyBvYmplY3RcbiAgICAgKi9cblxuICAgIFNpZ25hbGluZy5wcm90b3R5cGUuc2V0U3RhdHVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBTaWduYWxpbmc7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuXG4gIC8qKlxuICAgKiBDb25jZXB0IG9mIGEgY2xhc3MgaW1wbGVtZW50aW5nIGEgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gYSBwZWVyLlxuICAjXG4gICAqIFlvdSBkbyBub3QgaGF2ZSB0byBleHRlbmQgdGhpcyBjbGFzcywganVzdCBpbXBsZW1lbnQgdGhlIGZ1bmN0aW9uYWxpdHkuXG4gICNcbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuU2lnbmFsaW5nUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFNpZ25hbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gU2lnbmFsaW5nUGVlcigpIHtcbiAgICAgIHJldHVybiBTaWduYWxpbmdQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbW90ZSBwZWVyIGxlZnQgdGhlIHJvb21cbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBSZWNlaXZlZCBhIG1lc3NhZ2UgZnJvbSB0aGUgcmVtb3RlIHBlZXJcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBJRCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcGFyYW0ge09iZWpjdH0gZGF0YSBQYXlsb2FkIG9mIHRoZSBldmVudFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9iamVjdCBvZiB0aGUgcmVtb3RlIHBlZXIgd2FzIHVwZGF0ZWRcbiAgICAgKiBAZXZlbnQgc3RhdHVzX2NoYW5nZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIFRoZSBuZXcgc3RhdHVzXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGF0dXMgb2JqZWN0IG9mIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBwcm9wZXJ0eSBzdGF0dXNcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgbG9jYWwgdXNlciB3YXMgaW4gdGhlIHJvb20gYmVmb3JlIHRoZSByZW1vdGUgdXNlciAodXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggcGVlciB3aWxsIGluaXRpYXRlIHRoZSBjb25uZWN0aW9uKVxuICAgICAqIEBwcm9wZXJ0eSBmaXJzdFxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogU2VuZHMgdGhlIGV2ZW50IHdpdGggdGhlIGdpdmVuIHBheWxvYWQgdG8gdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQG1ldGhvZCBzZW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IFRoZSBpZCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBUaGUgcGF5bG9hZCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgb25jZSB0aGUgbWVzc2FnZSBpcyBzZW50XG4gICAgICovXG5cbiAgICBTaWduYWxpbmdQZWVyLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIGlmIChkYXRhID09IG51bGwpIHtcbiAgICAgICAgZGF0YSA9IHt9O1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2lnbmFsaW5nUGVlcjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG5cbiAgLyoqXG4gICAqIENvbmNlcHQgb2YgYSBjbGFzcyBpbXBsZW1lbnRpbmcgYSBzaWduYWxpbmcgY2hhbm5lbC4gTWlnaHQgYmUgdXNlZCBieSBzaWduYWxpbmcgaW1wbGVtZW50YXRpb25zIHRvIGNvbm5lY3QgdG8gYSBzaWduYWxpbmcgc2VydmVyLlxuICAjXG4gICAqIFlvdSBkbyBub3QgaGF2ZSB0byBleHRlbmQgdGhpcyBjbGFzcywganVzdCBpbXBsZW1lbnQgdGhlIGZ1bmN0aW9uYWxpdHkuXG4gICNcbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5DaGFubmVsXG4gICAqL1xuXG4gIGV4cG9ydHMuQ2hhbm5lbCA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKENoYW5uZWwsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2hhbm5lbCgpIHtcbiAgICAgIHJldHVybiBDaGFubmVsLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQSBtZXNzYWdlIHdhcyByZWNlaXZlZCBmcm9tIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQGV2ZW50IG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSByZWNlaXZlZCBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb25uZWN0aW9uIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIEVzdGFibGlzaGVzIHRoZSBjb25uZWN0aW9uIHdpdGggdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gdGhlIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWRcbiAgICAgKi9cblxuICAgIENoYW5uZWwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhIG1lc3NhZ2UgdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIHNlbmRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSBtZXNzYWdlIHRvIHNlbmRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gdGhlIG1lc3NhZ2UgaXMgc2VudFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiB0byB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIENoYW5uZWwucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBDaGFubmVsO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBDaGFubmVsLCBQcm9taXNlLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgc2xpY2UgPSBbXS5zbGljZTtcblxuICBQcm9taXNlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvcHJvbWlzZScpLlByb21pc2U7XG5cbiAgQ2hhbm5lbCA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nJykuQ2hhbm5lbDtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICovXG5cblxuICAvKipcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuV2ViU29ja2V0Q2hhbm5lbFxuICAgKiBAZXh0ZW5kcyBydGMuc2lnbmFsaW5nLkNoYW5uZWxcbiAgICovXG5cbiAgZXhwb3J0cy5XZWJTb2NrZXRDaGFubmVsID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoV2ViU29ja2V0Q2hhbm5lbCwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBXZWJTb2NrZXRDaGFubmVsKCkge1xuICAgICAgdmFyIGFkZHJlc3MsIGksIGxlbiwgcGFydCwgcGFydHM7XG4gICAgICBhZGRyZXNzID0gYXJndW1lbnRzWzBdLCBwYXJ0cyA9IDIgPD0gYXJndW1lbnRzLmxlbmd0aCA/IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSA6IFtdO1xuICAgICAgdGhpcy5hZGRyZXNzID0gYWRkcmVzcztcbiAgICAgIGlmIChwYXJ0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLmFkZHJlc3MuZW5kc1dpdGgoJy8nKSkge1xuICAgICAgICAgIHRoaXMuYWRkcmVzcyA9IHRoaXMuYWRkcmVzcy5zdWJzdHIoMCwgdGhpcy5hZGRyZXNzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHBhcnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICAgIHRoaXMuYWRkcmVzcyArPSAnLycgKyBlbmNvZGVVcmlDb21wb25lbnQocGFydCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBXZWJTb2NrZXRDaGFubmVsLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbm5lY3RfcCA9IG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHZhciBzb2NrZXQ7XG4gICAgICAgICAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KF90aGlzLmFkZHJlc3MpO1xuICAgICAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBfdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc29ja2V0Lm9uZXJyb3IgPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgZGVsZXRlIF90aGlzLnNvY2tldDtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcihcIlVuYWJsZSB0byBjb25uZWN0IHRvIHNvY2tldFwiKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICAgIHZhciBkYXRhO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdlcnJvcicsIFwiVW5hYmxlIHRvIHBhcnNlIGluY29taW5nIG1lc3NhZ2VcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdtZXNzYWdlJywgZGF0YSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBXZWJTb2NrZXRDaGFubmVsLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICB2YXIgZXJyO1xuICAgICAgaWYgKHRoaXMuc29ja2V0ICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1zZykpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgZXJyID0gX2Vycm9yO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiVHJ5aW5nIHRvIHNlbmQgb24gV2ViU29ja2V0IHdpdGhvdXQgYmVpbmcgY29ubmVjdGVkXCIpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgV2ViU29ja2V0Q2hhbm5lbC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICBpZiAodGhpcy5zb2NrZXQgIT0gbnVsbCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMuc29ja2V0LmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICBlcnIgPSBfZXJyb3I7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJUcnlpbmcgdG8gY2xvc2UgV2ViU29ja2V0IHdpdGhvdXQgYmVpbmcgY29ubmVjdGVkXCIpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIFdlYlNvY2tldENoYW5uZWw7XG5cbiAgfSkoQ2hhbm5lbCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBFdmVudEVtaXR0ZXIsIGNvbXBhdCxcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIGNvbXBhdCA9IHJlcXVpcmUoJy4vY29tcGF0JykuY29tcGF0O1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBBIHdyYXBwZXIgYXJvdW5kIGFuIEhUTUw1IE1lZGlhU3RyZWFtXG4gICAqIEBjbGFzcyBydGMuU3RyZWFtXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7UlRDRGF0YVN0cmVhbX0gc3RyZWFtIFRoZSBuYXRpdmUgc3RyZWFtXG4gICAqL1xuXG4gIGV4cG9ydHMuU3RyZWFtID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoU3RyZWFtLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogRW1pdHRlZCB3aGVuIHRyYWNrcyBhcmUgbXV0ZWQgb3IgdW5tdXRlZC4gT25seSB0cmlnZ2VyZWQgd2hlbiBjaGFuZ2VzIGFyZVxuICAgICAqIG1hZGUgdGhyb3VnaCB0aGlzIG9iamVjdHMgbXV0ZSBmdW5jdGlvbnMuXG4gICAgICogQGV2ZW50IG11dGVfY2hhbmdlZFxuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IHR5cGUgVGhlIHR5cGUgb2YgdHJhY2tzIHdoaWNoIGNoYW5nZWRcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IG11dGVkIGB0cnVlYCBpZiB0cmFja3Mgd2VyZSBtdXRlZCwgYGZhbHNlYCBpZiB0aGV5IHdlcmUgdW5tdXRlZFxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gU3RyZWFtKHN0cmVhbSkge1xuICAgICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGlkIG9mIHRoZSBzdHJlYW0uIFRoaXMgaXMgbmVpdGhlciB1c2VyIGRlZmluZWQgbm9yIGh1bWFuIHJlYWRhYmxlLlxuICAgICAqIEBtZXRob2QgaWRcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSBpZCBvZiB0aGUgdW5kZXJseWluZyBzdHJlYW1cbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUuaWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnN0cmVhbS5pZDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciB0aGUgc3RyZWFtIGhhcyBhbnkgdHJhY2tzIG9mIHRoZSBnaXZlbiB0eXBlXG4gICAgICogQG1ldGhvZCBoYXNUcmFja3NcbiAgICAgKiBAcGFyYW0geydhdWRpbycgfCAndmlkZW8nIHwgJ2JvdGgnfSBbdHlwZT0nYm90aCddIFRoZSB0eXBlIG9mIHRyYWNrIHRvIGNoZWNrIGZvclxuICAgICAqIEByZXR1cm4ge051bWJlcn0gVGhlIGFtb3VudCBvZiB0cmFja3Mgb2YgdGhlIGdpdmVuIHR5cGVcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUuaGFzVHJhY2tzID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0VHJhY2tzKHR5cGUpLmxlbmd0aDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB0cmFja3Mgb2YgdGhlIGdpdmVuIHR5cGVcbiAgICAgKiBAbWV0aG9kIGdldFRyYWNrc1xuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdib3RoJ10gVGhlIHR5cGUgb2YgdHJhY2tzIHRvIGdldFxuICAgICAqIEByZXR1cm4ge0FycmF5fSBBbiBBcnJheSBvZiB0aGUgdHJhY2tzXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLmdldFRyYWNrcyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgIHZhciB2YXVkaW8sIHZpZGVvO1xuICAgICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbS5nZXRBdWRpb1RyYWNrcygpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAndmlkZW8nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbS5nZXRWaWRlb1RyYWNrcygpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnYm90aCcpIHtcbiAgICAgICAgdmlkZW8gPSB0aGlzLnN0cmVhbS5nZXRWaWRlb1RyYWNrcygpO1xuICAgICAgICB2YXVkaW8gPSB0aGlzLnN0cmVhbS5nZXRBdWRpb1RyYWNrcygpO1xuICAgICAgICByZXR1cm4gdmlkZW8uY29uY2F0KGF1ZGlvKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgc3RyZWFtIHBhcnQgJ1wiICsgdHlwZSArIFwiJ1wiKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciBhIHR5cGUgb2YgdHJhY2sgaXMgbXV0ZWQuIElmIHRoZXJlIGFyZSBubyB0cmFja3Mgb2YgdGhlXG4gICAgICogc3BlY2lmaWVkIHR5cGUgdGhleSB3aWxsIGJlIGNvbnNpZGVyZWQgbXV0ZWRcbiAgICAgKiBAcGFyYW0geydhdWRpbycgfCAndmlkZW8nIHwgJ2JvdGgnfSBbdHlwZT0nYXVkaW8nXSBUaGUgdHlwZSBvZiB0cmFja3NcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBXaGV0aGVyIHRoZSB0cmFja3MgYXJlIG11dGVkXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLm11dGVkID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgdmFyIHJlZiwgdHJhY2tzO1xuICAgICAgaWYgKHR5cGUgPT0gbnVsbCkge1xuICAgICAgICB0eXBlID0gJ2F1ZGlvJztcbiAgICAgIH1cbiAgICAgIHRyYWNrcyA9IHRoaXMuZ2V0VHJhY2tzKHR5cGUpO1xuICAgICAgaWYgKHRyYWNrcy5sZW5ndGggPCAxKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuICEoKHJlZiA9IHRyYWNrc1swXSkgIT0gbnVsbCA/IHJlZi5lbmFibGVkIDogdm9pZCAwKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBNdXRlcyBvciB1bm11dGVzIHRyYWNrcyBvZiB0aGUgc3RyZWFtXG4gICAgICogQG1ldGhvZCBtdXRlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbbXV0ZWQ9dHJ1ZV0gTXV0ZSBvbiBgdHJ1ZWAgYW5kIHVubXV0ZSBvbiBgZmFsc2VgXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2F1ZGlvJ10gVGhlIHR5cGUgb2YgdHJhY2tzIHRvIG11dGUgb3IgdW5tdXRlXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gV2hldGhlciB0aGUgdHJhY2tzIHdlcmUgbXV0ZWQgb3IgdW5tdXRlZFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5tdXRlID0gZnVuY3Rpb24obXV0ZWQsIHR5cGUpIHtcbiAgICAgIHZhciBpLCBsZW4sIHJlZiwgdHJhY2s7XG4gICAgICBpZiAobXV0ZWQgPT0gbnVsbCkge1xuICAgICAgICBtdXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAodHlwZSA9PSBudWxsKSB7XG4gICAgICAgIHR5cGUgPSAnYXVkaW8nO1xuICAgICAgfVxuICAgICAgcmVmID0gdGhpcy5nZXRUcmFja3ModHlwZSk7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByZWYubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdHJhY2sgPSByZWZbaV07XG4gICAgICAgIHRyYWNrLmVuYWJsZWQgPSAhbXV0ZWQ7XG4gICAgICB9XG4gICAgICB0aGlzLmVtaXQoJ211dGVfY2hhbmdlZCcsIHR5cGUsIG11dGVkKTtcbiAgICAgIHJldHVybiBtdXRlZDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSBtdXRlIHN0YXRlIG9mIHRyYWNrcyBvZiB0aGUgc3RyZWFtXG4gICAgICogQG1ldGhvZCB0b2dnbGVNdXRlXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2F1ZGlvJ10gVGhlIHR5cGUgb2YgdHJhY2tzIHRvIG11dGUgb3IgdW5tdXRlXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gV2hldGhlciB0aGUgdHJhY2tzIHdlcmUgbXV0ZWQgb3IgdW5tdXRlZFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS50b2dnbGVNdXRlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgdmFyIGksIGxlbiwgbXV0ZWQsIHJlZiwgdHJhY2ssIHRyYWNrcztcbiAgICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgICAgdHlwZSA9ICdhdWRpbyc7XG4gICAgICB9XG4gICAgICB0cmFja3MgPSB0aGlzLmdldFRyYWNrcyh0eXBlKTtcbiAgICAgIGlmICh0cmFja3MubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIG11dGVkID0gISgocmVmID0gdHJhY2tzWzBdKSAhPSBudWxsID8gcmVmLmVuYWJsZWQgOiB2b2lkIDApO1xuICAgICAgZm9yIChpID0gMCwgbGVuID0gdHJhY2tzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHRyYWNrID0gdHJhY2tzW2ldO1xuICAgICAgICB0cmFjay5lbmFibGVkID0gIW11dGVkO1xuICAgICAgfVxuICAgICAgdGhpcy5lbWl0KCdtdXRlX2NoYW5nZWQnLCB0eXBlLCBtdXRlZCk7XG4gICAgICByZXR1cm4gbXV0ZWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2Qgc3RvcFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgbGVuLCByZWYsIHJlc3VsdHMsIHRyYWNrO1xuICAgICAgaWYgKHRoaXMuc3RyZWFtLmdldFRyYWNrcyAhPSBudWxsKSB7XG4gICAgICAgIHJlZiA9IHRoaXMuc3RyZWFtLmdldFRyYWNrcygpO1xuICAgICAgICByZXN1bHRzID0gW107XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgIHRyYWNrID0gcmVmW2ldO1xuICAgICAgICAgIHJlc3VsdHMucHVzaCh0cmFjay5zdG9wKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtLnN0b3AoKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9uZXMgdGhlIHN0cmVhbS4gWW91IGNhbiBjaGFuZ2UgYm90aCBzdHJlYW1zIGluZGVwZW5kZW50bHksIGZvciBleGFtcGxlXG4gICAgICogbXV0ZSB0cmFja3MuIFlvdSB3aWxsIGhhdmUgdG8gYHN0b3AoKWAgYm90aCBzdHJlYW1zIGluZGl2aWR1YWxseSB3aGVuIHlvdVxuICAgICAqIGFyZSBkb25lLlxuICAgICNcbiAgICAgKiBUaGlzIGlzIGN1cnJlbnRseSBub3Qgc3VwcG9ydGVkIGluIEZpcmVmb3ggYW5kIGV4cGVjdGVkIHRvIGJlIGltcGxlbWVudGVkXG4gICAgICogaW4gdmVyc2lvbiA0Ny4gVXNlIGBTdHJlYW0uY2FuQ2xvbmUoKWAgdG8gY2hlY2sgd2hldGhlciBjbG9uaW5nIGlzIHN1cHBvcnRlZCBieVxuICAgICAqIHlvdXIgYnJvd3Nlci5cbiAgICAjXG4gICAgICogQG1ldGhvZCBjbG9uZVxuICAgICAqIEByZXR1cm4ge3J0Yy5TdHJlYW19IEEgY2xvbmUgb2YgdGhlIHN0cmVhbVxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RyZWFtLmNsb25lID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiWW91ciBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgc3RyZWFtIGNsb25pbmcuIEZpcmVmb3ggaXMgZXhwZWN0ZWQgdG8gaW1wbGVtZW50IGl0IGluIHZlcnNpb24gNDcuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBTdHJlYW0odGhpcy5zdHJlYW0uY2xvbmUoKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgY2xvbmluZyBzdHJlYW0gaXMgc3VwcG9ydGVkIGJ5IHRoZSBicm93c2VyLiBTZWUgYGNsb25lKClgXG4gICAgICogZm9yIGRldGFpbHNcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG1ldGhvZCBjYW5DbG9uZVxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IGB0cnVlYCBpZiBjbG9uaW5nIGlzIHN1cHBvcnRlZCwgYGZhbHNlYCBvdGhlcndpc2VcbiAgICAgKi9cblxuICAgIFN0cmVhbS5jYW5DbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGNvbXBhdC5NZWRpYVN0cmVhbS5wcm90b3R5cGUuY2xvbmUgIT0gbnVsbDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc3RyZWFtIHVzaW5nIGBnZXRVc2VyTWVkaWEoKWBcbiAgICAgKiBAbWV0aG9kIGNyZWF0ZVN0cmVhbVxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbmZpZz17YXVkaW86IHRydWUsIHZpZGVvOiB0cnVlfV0gVGhlIGNvbmZpZ3VyYXRpb24gdG8gcGFzcyB0byBgZ2V0VXNlck1lZGlhKClgXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIHRvIHRoZSBzdHJlYW1cbiAgICAjXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAgICAgdmFyIHN0cmVhbSA9IHJ0Yy5TdHJlYW0uY3JlYXRlU3RyZWFtKHthdWRpbzogdHJ1ZSwgdmlkZW86IGZhbHNlfSk7XG4gICAgICogICAgIHJ0Yy5NZWRpYURvbUVsZW1lbnQoJCgndmlkZW8nKSwgc3RyZWFtKTtcbiAgICAgKi9cblxuICAgIFN0cmVhbS5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgIGlmIChjb25maWcgPT0gbnVsbCkge1xuICAgICAgICBjb25maWcgPSB7XG4gICAgICAgICAgYXVkaW86IHRydWUsXG4gICAgICAgICAgdmlkZW86IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHN1Y2Nlc3M7XG4gICAgICAgIHN1Y2Nlc3MgPSBmdW5jdGlvbihuYXRpdmVfc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUobmV3IFN0cmVhbShuYXRpdmVfc3RyZWFtKSk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBjb21wYXQuZ2V0VXNlck1lZGlhKGNvbmZpZywgc3VjY2VzcywgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gU3RyZWFtO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBQZWVyLCBTdHJlYW07XG5cbiAgU3RyZWFtID0gcmVxdWlyZSgnLi9zdHJlYW0nKS5TdHJlYW07XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQGNsYXNzIHJ0Yy5NZWRpYURvbUVsZW1lbnRcbiAgICovXG5cbiAgZXhwb3J0cy5NZWRpYURvbUVsZW1lbnQgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gTWVkaWFEb21FbGVtZW50KGRvbSwgZGF0YSkge1xuICAgICAgdGhpcy5kb20gPSBkb207XG4gICAgICBpZiAodGhpcy5kb20uanF1ZXJ5ICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5kb20gPSB0aGlzLmRvbVswXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYXR0YWNoKGRhdGEpO1xuICAgIH1cblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkZWxldGUgdGhpcy5zdHJlYW07XG4gICAgICAgIHRoaXMuZG9tLnBhdXNlKCk7XG4gICAgICAgIHJldHVybiB0aGlzLmRvbS5zcmMgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgU3RyZWFtKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtID0gZGF0YTtcbiAgICAgICAgaWYgKHR5cGVvZiBtb3pHZXRVc2VyTWVkaWEgIT09IFwidW5kZWZpbmVkXCIgJiYgbW96R2V0VXNlck1lZGlhICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5kb20ubW96U3JjT2JqZWN0ID0gZGF0YS5zdHJlYW07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kb20uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChkYXRhLnN0cmVhbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZG9tLnBsYXkoKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YSBpbnN0YW5jZW9mIFBlZXIpIHtcbiAgICAgICAgaWYgKGRhdGEuaXNMb2NhbCgpKSB7XG4gICAgICAgICAgdGhpcy5tdXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoKGRhdGEuc3RyZWFtKCkpO1xuICAgICAgfSBlbHNlIGlmICgoZGF0YSAhPSBudWxsID8gZGF0YS50aGVuIDogdm9pZCAwKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkYXRhLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmF0dGFjaChyZXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKVtcImNhdGNoXCJdKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5lcnJvcihlcnIpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yKFwiVHJpZWQgdG8gYXR0YWNoIGludmFsaWQgZGF0YVwiKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5lcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGVycik7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmF0dGFjaCgpO1xuICAgIH07XG5cbiAgICBNZWRpYURvbUVsZW1lbnQucHJvdG90eXBlLm11dGUgPSBmdW5jdGlvbihtdXRlZCkge1xuICAgICAgaWYgKG11dGVkID09IG51bGwpIHtcbiAgICAgICAgbXV0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZG9tLm11dGVkID0gbXV0ZWQ7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUudG9nZ2xlTXV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZG9tLm11dGVkID0gIXRoaXMuZG9tLm11dGVkO1xuICAgIH07XG5cbiAgICByZXR1cm4gTWVkaWFEb21FbGVtZW50O1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iXX0=
