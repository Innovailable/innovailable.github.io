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
     * @param data The data received
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
      console.log('connecting ..');
      return this.signaling.accepted().then((function(_this) {
        return function() {
          console.log('accepted ..');
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
  var compat;

  compat = require('./compat').compat;


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

  exports.Stream = (function() {
    function Stream(stream1) {
      this.stream = stream1;
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
      type = type.toLowerCase();
      if (type === 'audio') {
        return this.stream_p.then(function(stream) {
          return stream.getAudioTracks();
        });
      } else if (type === 'video') {
        return this.stream_p.then(function(stream) {
          return stream.getVideoTracks();
        });
      } else if (type === 'both') {
        return this.stream_p.then(function(stream) {
          var vaudio, video;
          video = stream.getVideoTracks();
          vaudio = stream.getAudioTracks();
          return video.concat(audio);
        });
      } else {
        throw new Error("Invalid stream part '" + type + "'");
      }
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
      ref = getTracks(type);
      for (i = 0, len = ref.length; i < len; i++) {
        track = ref[i];
        track.enabled = !muted;
      }
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
      tracks = getTracks(type);
      muted = !((ref = tracks[0]) != null ? ref.enabled : void 0);
      for (i = 0, len = tracks.length; i < len; i++) {
        track = tracks[i];
        track.enabled = !muted;
      }
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

  })();

}).call(this);

},{"./compat":5}],22:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCJzcmMvY29tcGF0LmNvZmZlZSIsInNyYy9kYXRhX2NoYW5uZWwuY29mZmVlIiwic3JjL2ludGVybmFsL2NoYW5uZWxfY29sbGVjdGlvbi5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvcHJvbWlzZS5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24uY29mZmVlIiwic3JjL2xpYi5jb2ZmZWUiLCJzcmMvbG9jYWxfcGVlci5jb2ZmZWUiLCJzcmMvcGVlci5jb2ZmZWUiLCJzcmMvcGVlcl9jb25uZWN0aW9uLmNvZmZlZSIsInNyYy9yZW1vdGVfcGVlci5jb2ZmZWUiLCJzcmMvcm9vbS5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL2NhbGxpbmdfc2lnbmFsaW5nLmNvZmZlZSIsInNyYy9zaWduYWxpbmcvbXVjX3NpZ25hbGluZy5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwuY29mZmVlIiwic3JjL3N0cmVhbS5jb2ZmZWUiLCJzcmMvdmlkZW9fZWxlbWVudC5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3Y4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4OEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qIVxuICogQG92ZXJ2aWV3IGVzNi1wcm9taXNlIC0gYSB0aW55IGltcGxlbWVudGF0aW9uIG9mIFByb21pc2VzL0ErLlxuICogQGNvcHlyaWdodCBDb3B5cmlnaHQgKGMpIDIwMTQgWWVodWRhIEthdHosIFRvbSBEYWxlLCBTdGVmYW4gUGVubmVyIGFuZCBjb250cmlidXRvcnMgKENvbnZlcnNpb24gdG8gRVM2IEFQSSBieSBKYWtlIEFyY2hpYmFsZClcbiAqIEBsaWNlbnNlICAgTGljZW5zZWQgdW5kZXIgTUlUIGxpY2Vuc2VcbiAqICAgICAgICAgICAgU2VlIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9qYWtlYXJjaGliYWxkL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG4gKiBAdmVyc2lvbiAgIDMuMC4yXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbicgfHwgKHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNNYXliZVRoZW5hYmxlKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheSA9IGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXk7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkdG9TdHJpbmcgPSB7fS50b1N0cmluZztcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbl0gPSBjYWxsYmFjaztcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuICsgMV0gPSBhcmc7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuICs9IDI7XG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9PT0gMikge1xuICAgICAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbihsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyKHNjaGVkdWxlRm4pIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXAoYXNhcEZuKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcCA9IGFzYXBGbjtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gd2luZG93IDogdW5kZWZpbmVkO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93IHx8IHt9O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc05vZGUgPSB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nO1xuXG4gICAgLy8gdGVzdCBmb3Igd2ViIHdvcmtlciBidXQgbm90IGluIElFMTBcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyID0gdHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xuXG4gICAgLy8gbm9kZVxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VOZXh0VGljaygpIHtcbiAgICAgIC8vIG5vZGUgdmVyc2lvbiAwLjEwLnggZGlzcGxheXMgYSBkZXByZWNhdGlvbiB3YXJuaW5nIHdoZW4gbmV4dFRpY2sgaXMgdXNlZCByZWN1cnNpdmVseVxuICAgICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jdWpvanMvd2hlbi9pc3N1ZXMvNDEwIGZvciBkZXRhaWxzXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2sobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gdmVydHhcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlVmVydHhUaW1lcigpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgICAgIHZhciBpdGVyYXRpb25zID0gMDtcbiAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgbm9kZS5kYXRhID0gKGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gd2ViIHdvcmtlclxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcbiAgICAgIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaDtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBzZXRUaW1lb3V0KGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCwgMSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuOyBpKz0yKSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXTtcbiAgICAgICAgdmFyIGFyZyA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpKzFdO1xuXG4gICAgICAgIGNhbGxiYWNrKGFyZyk7XG5cbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2ldID0gdW5kZWZpbmVkO1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJGF0dGVtcHRWZXJ0eCgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByID0gcmVxdWlyZTtcbiAgICAgICAgdmFyIHZlcnR4ID0gcigndmVydHgnKTtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlVmVydHhUaW1lcigpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaDtcbiAgICAvLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNOb2RlKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VOZXh0VGljaygpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNXb3JrZXIpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU1lc3NhZ2VDaGFubmVsKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiByZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AoKSB7fVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgICA9IHZvaWQgMDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEID0gMTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQgID0gMjtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUiA9IG5ldyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc2VsZkZ1bGZpbGxtZW50KCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJZb3UgY2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGNhbm5vdFJldHVybk93bigpIHtcbiAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbihwcm9taXNlKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuO1xuICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUi5lcnJvciA9IGVycm9yO1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcik7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuKSB7XG4gICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24ocHJvbWlzZSkge1xuICAgICAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG4gICAgICAgIHZhciBlcnJvciA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeVRoZW4odGhlbiwgdGhlbmFibGUsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGlmICh0aGVuYWJsZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgIGlmIChzZWFsZWQpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG4gICAgICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuICAgICAgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpIHtcbiAgICAgIGlmIChtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yID09PSBwcm9taXNlLmNvbnN0cnVjdG9yKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRoZW4gPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKG1heWJlVGhlbmFibGUpO1xuXG4gICAgICAgIGlmICh0aGVuID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUi5lcnJvcik7XG4gICAgICAgIH0gZWxzZSBpZiAodGhlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24odGhlbikpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpIHtcbiAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc2VsZkZ1bGZpbGxtZW50KCkpO1xuICAgICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkdXRpbHMkJG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuICAgICAgICBwcm9taXNlLl9vbmVycm9yKHByb21pc2UuX3Jlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuXG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcbiAgICAgIHByb21pc2UuX3N0YXRlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEO1xuXG4gICAgICBpZiAocHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gsIHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykgeyByZXR1cm47IH1cbiAgICAgIHByb21pc2UuX3N0YXRlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQ7XG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSByZWFzb247XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgICAgIHZhciBsZW5ndGggPSBzdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgICAgIHBhcmVudC5fb25lcnJvciA9IG51bGw7XG5cbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aCArIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURURdICA9IG9uUmVqZWN0aW9uO1xuXG4gICAgICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoKHByb21pc2UpIHtcbiAgICAgIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIHNldHRsZWQgPSBwcm9taXNlLl9zdGF0ZTtcblxuICAgICAgaWYgKHN1YnNjcmliZXJzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgICAgdmFyIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsID0gcHJvbWlzZS5fcmVzdWx0O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG4gICAgICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKSB7XG4gICAgICB0aGlzLmVycm9yID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soZGV0YWlsKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBlO1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHZhciBoYXNDYWxsYmFjayA9IGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICAgICAgdmFsdWUsIGVycm9yLCBzdWNjZWVkZWQsIGZhaWxlZDtcblxuICAgICAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgICAgIHZhbHVlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCk7XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IpIHtcbiAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgIGVycm9yID0gdmFsdWUuZXJyb3I7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgIC8vIG5vb3BcbiAgICAgIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlcihmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSl7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcihDb25zdHJ1Y3RvciwgaW5wdXQpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgZW51bWVyYXRvci5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICAgICAgZW51bWVyYXRvci5wcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoZW51bWVyYXRvci5fdmFsaWRhdGVJbnB1dChpbnB1dCkpIHtcbiAgICAgICAgZW51bWVyYXRvci5faW5wdXQgICAgID0gaW5wdXQ7XG4gICAgICAgIGVudW1lcmF0b3IubGVuZ3RoICAgICA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgZW51bWVyYXRvci5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXG4gICAgICAgIGVudW1lcmF0b3IuX2luaXQoKTtcblxuICAgICAgICBpZiAoZW51bWVyYXRvci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKGVudW1lcmF0b3IucHJvbWlzZSwgZW51bWVyYXRvci5fcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnVtZXJhdG9yLmxlbmd0aCA9IGVudW1lcmF0b3IubGVuZ3RoIHx8IDA7XG4gICAgICAgICAgZW51bWVyYXRvci5fZW51bWVyYXRlKCk7XG4gICAgICAgICAgaWYgKGVudW1lcmF0b3IuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChlbnVtZXJhdG9yLnByb21pc2UsIGVudW1lcmF0b3IuX3Jlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QoZW51bWVyYXRvci5wcm9taXNlLCBlbnVtZXJhdG9yLl92YWxpZGF0aW9uRXJyb3IoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl92YWxpZGF0ZUlucHV0ID0gZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkoaW5wdXQpO1xuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3ZhbGlkYXRpb25FcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5faW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fcmVzdWx0ID0gbmV3IEFycmF5KHRoaXMubGVuZ3RoKTtcbiAgICB9O1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3I7XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2VudW1lcmF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICB2YXIgbGVuZ3RoICA9IGVudW1lcmF0b3IubGVuZ3RoO1xuICAgICAgdmFyIHByb21pc2UgPSBlbnVtZXJhdG9yLnByb21pc2U7XG4gICAgICB2YXIgaW5wdXQgICA9IGVudW1lcmF0b3IuX2lucHV0O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgcHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX2VhY2hFbnRyeShpbnB1dFtpXSwgaSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fZWFjaEVudHJ5ID0gZnVuY3Rpb24oZW50cnksIGkpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcbiAgICAgIHZhciBjID0gZW51bWVyYXRvci5faW5zdGFuY2VDb25zdHJ1Y3RvcjtcblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNNYXliZVRoZW5hYmxlKGVudHJ5KSkge1xuICAgICAgICBpZiAoZW50cnkuY29uc3RydWN0b3IgPT09IGMgJiYgZW50cnkuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgICAgZW50cnkuX29uZXJyb3IgPSBudWxsO1xuICAgICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChlbnRyeS5fc3RhdGUsIGksIGVudHJ5Ll9yZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVudW1lcmF0b3IuX3dpbGxTZXR0bGVBdChjLnJlc29sdmUoZW50cnkpLCBpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW51bWVyYXRvci5fcmVtYWluaW5nLS07XG4gICAgICAgIGVudW1lcmF0b3IuX3Jlc3VsdFtpXSA9IGVudHJ5O1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3NldHRsZWRBdCA9IGZ1bmN0aW9uKHN0YXRlLCBpLCB2YWx1ZSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuICAgICAgdmFyIHByb21pc2UgPSBlbnVtZXJhdG9yLnByb21pc2U7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICBlbnVtZXJhdG9yLl9yZW1haW5pbmctLTtcblxuICAgICAgICBpZiAoc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnVtZXJhdG9yLl9yZXN1bHRbaV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZW51bWVyYXRvci5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgZW51bWVyYXRvci5fcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl93aWxsU2V0dGxlQXQgPSBmdW5jdGlvbihwcm9taXNlLCBpKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwcm9taXNlLCB1bmRlZmluZWQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQsIGksIHZhbHVlKTtcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQsIGksIHJlYXNvbik7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsKGVudHJpZXMpIHtcbiAgICAgIHJldHVybiBuZXcgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQodGhpcywgZW50cmllcykucHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2UoZW50cmllcykge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoIWxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICB9XG5cbiAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcblxuICAgICAgZnVuY3Rpb24gb25GdWxmaWxsbWVudCh2YWx1ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gb25SZWplY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgcHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLCB1bmRlZmluZWQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkcmFjZTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlKG9iamVjdCkge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gb2JqZWN0O1xuICAgICAgfVxuXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgb2JqZWN0KTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJHJlc29sdmU7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRyZWplY3QocmVhc29uKSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkcmVqZWN0O1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRjb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc1Jlc29sdmVyKCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc05ldygpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2U7XG4gICAgLyoqXG4gICAgICBQcm9taXNlIG9iamVjdHMgcmVwcmVzZW50IHRoZSBldmVudHVhbCByZXN1bHQgb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gVGhlXG4gICAgICBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLCB3aGljaFxuICAgICAgcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGUgcmVhc29uXG4gICAgICB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICAgICAgVGVybWlub2xvZ3lcbiAgICAgIC0tLS0tLS0tLS0tXG5cbiAgICAgIC0gYHByb21pc2VgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB3aXRoIGEgYHRoZW5gIG1ldGhvZCB3aG9zZSBiZWhhdmlvciBjb25mb3JtcyB0byB0aGlzIHNwZWNpZmljYXRpb24uXG4gICAgICAtIGB0aGVuYWJsZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyBhIGB0aGVuYCBtZXRob2QuXG4gICAgICAtIGB2YWx1ZWAgaXMgYW55IGxlZ2FsIEphdmFTY3JpcHQgdmFsdWUgKGluY2x1ZGluZyB1bmRlZmluZWQsIGEgdGhlbmFibGUsIG9yIGEgcHJvbWlzZSkuXG4gICAgICAtIGBleGNlcHRpb25gIGlzIGEgdmFsdWUgdGhhdCBpcyB0aHJvd24gdXNpbmcgdGhlIHRocm93IHN0YXRlbWVudC5cbiAgICAgIC0gYHJlYXNvbmAgaXMgYSB2YWx1ZSB0aGF0IGluZGljYXRlcyB3aHkgYSBwcm9taXNlIHdhcyByZWplY3RlZC5cbiAgICAgIC0gYHNldHRsZWRgIHRoZSBmaW5hbCByZXN0aW5nIHN0YXRlIG9mIGEgcHJvbWlzZSwgZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuXG4gICAgICBBIHByb21pc2UgY2FuIGJlIGluIG9uZSBvZiB0aHJlZSBzdGF0ZXM6IHBlbmRpbmcsIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQuXG5cbiAgICAgIFByb21pc2VzIHRoYXQgYXJlIGZ1bGZpbGxlZCBoYXZlIGEgZnVsZmlsbG1lbnQgdmFsdWUgYW5kIGFyZSBpbiB0aGUgZnVsZmlsbGVkXG4gICAgICBzdGF0ZS4gIFByb21pc2VzIHRoYXQgYXJlIHJlamVjdGVkIGhhdmUgYSByZWplY3Rpb24gcmVhc29uIGFuZCBhcmUgaW4gdGhlXG4gICAgICByZWplY3RlZCBzdGF0ZS4gIEEgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmV2ZXIgYSB0aGVuYWJsZS5cblxuICAgICAgUHJvbWlzZXMgY2FuIGFsc28gYmUgc2FpZCB0byAqcmVzb2x2ZSogYSB2YWx1ZS4gIElmIHRoaXMgdmFsdWUgaXMgYWxzbyBhXG4gICAgICBwcm9taXNlLCB0aGVuIHRoZSBvcmlnaW5hbCBwcm9taXNlJ3Mgc2V0dGxlZCBzdGF0ZSB3aWxsIG1hdGNoIHRoZSB2YWx1ZSdzXG4gICAgICBzZXR0bGVkIHN0YXRlLiAgU28gYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpbGxcbiAgICAgIGl0c2VsZiByZWplY3QsIGFuZCBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdpbGxcbiAgICAgIGl0c2VsZiBmdWxmaWxsLlxuXG5cbiAgICAgIEJhc2ljIFVzYWdlOlxuICAgICAgLS0tLS0tLS0tLS0tXG5cbiAgICAgIGBgYGpzXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvLyBvbiBzdWNjZXNzXG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuXG4gICAgICAgIC8vIG9uIGZhaWx1cmVcbiAgICAgICAgcmVqZWN0KHJlYXNvbik7XG4gICAgICB9KTtcblxuICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgLy8gb24gcmVqZWN0aW9uXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBZHZhbmNlZCBVc2FnZTpcbiAgICAgIC0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICBQcm9taXNlcyBzaGluZSB3aGVuIGFic3RyYWN0aW5nIGF3YXkgYXN5bmNocm9ub3VzIGludGVyYWN0aW9ucyBzdWNoIGFzXG4gICAgICBgWE1MSHR0cFJlcXVlc3Rgcy5cblxuICAgICAgYGBganNcbiAgICAgIGZ1bmN0aW9uIGdldEpTT04odXJsKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICAgICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBoYW5kbGVyO1xuICAgICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgeGhyLnNlbmQoKTtcblxuICAgICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkRPTkUpIHtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2dldEpTT046IGAnICsgdXJsICsgJ2AgZmFpbGVkIHdpdGggc3RhdHVzOiBbJyArIHRoaXMuc3RhdHVzICsgJ10nKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgZ2V0SlNPTignL3Bvc3RzLmpzb24nKS50aGVuKGZ1bmN0aW9uKGpzb24pIHtcbiAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAvLyBvbiByZWplY3Rpb25cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFVubGlrZSBjYWxsYmFja3MsIHByb21pc2VzIGFyZSBncmVhdCBjb21wb3NhYmxlIHByaW1pdGl2ZXMuXG5cbiAgICAgIGBgYGpzXG4gICAgICBQcm9taXNlLmFsbChbXG4gICAgICAgIGdldEpTT04oJy9wb3N0cycpLFxuICAgICAgICBnZXRKU09OKCcvY29tbWVudHMnKVxuICAgICAgXSkudGhlbihmdW5jdGlvbih2YWx1ZXMpe1xuICAgICAgICB2YWx1ZXNbMF0gLy8gPT4gcG9zdHNKU09OXG4gICAgICAgIHZhbHVlc1sxXSAvLyA9PiBjb21tZW50c0pTT05cblxuICAgICAgICByZXR1cm4gdmFsdWVzO1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQGNsYXNzIFByb21pc2VcbiAgICAgIEBwYXJhbSB7ZnVuY3Rpb259IHJlc29sdmVyXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAY29uc3RydWN0b3JcbiAgICAqL1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlKHJlc29sdmVyKSB7XG4gICAgICB0aGlzLl9pZCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRjb3VudGVyKys7XG4gICAgICB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wICE9PSByZXNvbHZlcikge1xuICAgICAgICBpZiAoIWxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbihyZXNvbHZlcikpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc05ldygpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW5pdGlhbGl6ZVByb21pc2UodGhpcywgcmVzb2x2ZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLmFsbCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yYWNlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yZXNvbHZlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yZWplY3QgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX3NldFNjaGVkdWxlciA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRTY2hlZHVsZXI7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX3NldEFzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0QXNhcDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fYXNhcCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwO1xuXG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucHJvdG90eXBlID0ge1xuICAgICAgY29uc3RydWN0b3I6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLFxuXG4gICAgLyoqXG4gICAgICBUaGUgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCxcbiAgICAgIHdoaWNoIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlXG4gICAgICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgIC8vIHVzZXIgaXMgYXZhaWxhYmxlXG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQ2hhaW5pbmdcbiAgICAgIC0tLS0tLS0tXG5cbiAgICAgIFRoZSByZXR1cm4gdmFsdWUgb2YgYHRoZW5gIGlzIGl0c2VsZiBhIHByb21pc2UuICBUaGlzIHNlY29uZCwgJ2Rvd25zdHJlYW0nXG4gICAgICBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZmlyc3QgcHJvbWlzZSdzIGZ1bGZpbGxtZW50XG4gICAgICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gdXNlci5uYW1lO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh1c2VyTmFtZSkge1xuICAgICAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG4gICAgICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuICAgICAgfSk7XG5cbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jyk7XG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBpZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHJlYXNvbmAgd2lsbCBiZSAnRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknLlxuICAgICAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cbiAgICAgIH0pO1xuICAgICAgYGBgXG4gICAgICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBc3NpbWlsYXRpb25cbiAgICAgIC0tLS0tLS0tLS0tLVxuXG4gICAgICBTb21ldGltZXMgdGhlIHZhbHVlIHlvdSB3YW50IHRvIHByb3BhZ2F0ZSB0byBhIGRvd25zdHJlYW0gcHJvbWlzZSBjYW4gb25seSBiZVxuICAgICAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuICAgICAgZnVsZmlsbG1lbnQgb3IgcmVqZWN0aW9uIGhhbmRsZXIuIFRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCB0aGVuIGJlIHBlbmRpbmdcbiAgICAgIHVudGlsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlzIHNldHRsZWQuIFRoaXMgaXMgY2FsbGVkICphc3NpbWlsYXRpb24qLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAgIC8vIFRoZSB1c2VyJ3MgY29tbWVudHMgYXJlIG5vdyBhdmFpbGFibGVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCByZWplY3RzLCB3ZSdsbCBoYXZlIHRoZSByZWFzb24gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgU2ltcGxlIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIHJlc3VsdDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gZmluZFJlc3VsdCgpO1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9XG4gICAgICBgYGBcblxuICAgICAgRXJyYmFjayBFeGFtcGxlXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kUmVzdWx0KGZ1bmN0aW9uKHJlc3VsdCwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIC8vIGZhaWx1cmVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFByb21pc2UgRXhhbXBsZTtcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQWR2YW5jZWQgRXhhbXBsZVxuICAgICAgLS0tLS0tLS0tLS0tLS1cblxuICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICB2YXIgYXV0aG9yLCBib29rcztcblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXV0aG9yID0gZmluZEF1dGhvcigpO1xuICAgICAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9XG4gICAgICBgYGBcblxuICAgICAgRXJyYmFjayBFeGFtcGxlXG5cbiAgICAgIGBgYGpzXG5cbiAgICAgIGZ1bmN0aW9uIGZvdW5kQm9va3MoYm9va3MpIHtcblxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuXG4gICAgICB9XG5cbiAgICAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIC8vIGZhaWx1cmVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBmb3VuZEJvb2tzKGJvb2tzKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAgICAgICAgICAgZmFpbHVyZShyZWFzb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFByb21pc2UgRXhhbXBsZTtcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgZmluZEF1dGhvcigpLlxuICAgICAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cbiAgICAgICAgdGhlbihmdW5jdGlvbihib29rcyl7XG4gICAgICAgICAgLy8gZm91bmQgYm9va3NcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIHRoZW5cbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uRnVsZmlsbGVkXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAgICovXG4gICAgICB0aGVuOiBmdW5jdGlvbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcztcbiAgICAgICAgdmFyIHN0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuICAgICAgICBpZiAoc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCAmJiAhb25GdWxmaWxsbWVudCB8fCBzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQgJiYgIW9uUmVqZWN0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hpbGQgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHBhcmVudC5fcmVzdWx0O1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1tzdGF0ZSAtIDFdO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCByZXN1bHQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICB9LFxuXG4gICAgLyoqXG4gICAgICBgY2F0Y2hgIGlzIHNpbXBseSBzdWdhciBmb3IgYHRoZW4odW5kZWZpbmVkLCBvblJlamVjdGlvbilgIHdoaWNoIG1ha2VzIGl0IHRoZSBzYW1lXG4gICAgICBhcyB0aGUgY2F0Y2ggYmxvY2sgb2YgYSB0cnkvY2F0Y2ggc3RhdGVtZW50LlxuXG4gICAgICBgYGBqc1xuICAgICAgZnVuY3Rpb24gZmluZEF1dGhvcigpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkbid0IGZpbmQgdGhhdCBhdXRob3InKTtcbiAgICAgIH1cblxuICAgICAgLy8gc3luY2hyb25vdXNcbiAgICAgIHRyeSB7XG4gICAgICAgIGZpbmRBdXRob3IoKTtcbiAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9XG5cbiAgICAgIC8vIGFzeW5jIHdpdGggcHJvbWlzZXNcbiAgICAgIGZpbmRBdXRob3IoKS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQG1ldGhvZCBjYXRjaFxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3Rpb25cbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICAgKi9cbiAgICAgICdjYXRjaCc6IGZ1bmN0aW9uKG9uUmVqZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICAgICAgfVxuICAgIH07XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRwb2x5ZmlsbCgpIHtcbiAgICAgIHZhciBsb2NhbDtcblxuICAgICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbG9jYWwgPSBnbG9iYWw7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsID0gc2VsZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgbG9jYWwgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBQID0gbG9jYWwuUHJvbWlzZTtcblxuICAgICAgaWYgKFAgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKSA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsb2NhbC5Qcm9taXNlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQ7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJHBvbHlmaWxsO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2UgPSB7XG4gICAgICAnUHJvbWlzZSc6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0LFxuICAgICAgJ3BvbHlmaWxsJzogbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0XG4gICAgfTtcblxuICAgIC8qIGdsb2JhbCBkZWZpbmU6dHJ1ZSBtb2R1bGU6dHJ1ZSB3aW5kb3c6IHRydWUgKi9cbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmVbJ2FtZCddKSB7XG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlOyB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZVsnZXhwb3J0cyddKSB7XG4gICAgICBtb2R1bGVbJ2V4cG9ydHMnXSA9IGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXNbJ0VTNlByb21pc2UnXSA9IGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0KCk7XG59KS5jYWxsKHRoaXMpO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGlzQXJyYXkgPSBmdW5jdGlvbiBpc0FycmF5KGFycikge1xuXHRpZiAodHlwZW9mIEFycmF5LmlzQXJyYXkgPT09ICdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShhcnIpO1xuXHR9XG5cblx0cmV0dXJuIHRvU3RyLmNhbGwoYXJyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0aWYgKCFvYmogfHwgdG9TdHIuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNPd25Db25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG5cdHZhciBoYXNJc1Byb3RvdHlwZU9mID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcblx0Ly8gTm90IG93biBjb25zdHJ1Y3RvciBwcm9wZXJ0eSBtdXN0IGJlIE9iamVjdFxuXHRpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNPd25Db25zdHJ1Y3RvciAmJiAhaGFzSXNQcm90b3R5cGVPZikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7LyoqL31cblxuXHRyZXR1cm4gdHlwZW9mIGtleSA9PT0gJ3VuZGVmaW5lZCcgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG5cdHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG5cdFx0aSA9IDEsXG5cdFx0bGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcblx0XHRkZWVwID0gZmFsc2U7XG5cblx0Ly8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuXHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0ZGVlcCA9IHRhcmdldDtcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG5cdFx0Ly8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuXHRcdGkgPSAyO1xuXHR9IGVsc2UgaWYgKCh0eXBlb2YgdGFyZ2V0ICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGFyZ2V0ICE9PSAnZnVuY3Rpb24nKSB8fCB0YXJnZXQgPT0gbnVsbCkge1xuXHRcdHRhcmdldCA9IHt9O1xuXHR9XG5cblx0Zm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbaV07XG5cdFx0Ly8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuXHRcdGlmIChvcHRpb25zICE9IG51bGwpIHtcblx0XHRcdC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3Rcblx0XHRcdGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG5cdFx0XHRcdHNyYyA9IHRhcmdldFtuYW1lXTtcblx0XHRcdFx0Y29weSA9IG9wdGlvbnNbbmFtZV07XG5cblx0XHRcdFx0Ly8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuXHRcdFx0XHRpZiAodGFyZ2V0ICE9PSBjb3B5KSB7XG5cdFx0XHRcdFx0Ly8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG5cdFx0XHRcdFx0aWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBpc0FycmF5KGNvcHkpKSkpIHtcblx0XHRcdFx0XHRcdGlmIChjb3B5SXNBcnJheSkge1xuXHRcdFx0XHRcdFx0XHRjb3B5SXNBcnJheSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBpc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cblx0XHRcdFx0XHQvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgY29weSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdHRhcmdldFtuYW1lXSA9IGNvcHk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3Rcblx0cmV0dXJuIHRhcmdldDtcbn07XG5cbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcblxuLyoqXG4gKiBDb3JlIGZ1bmN0aW9uYWxpdHlcbiAqIEBtb2R1bGUgcnRjXG4gKiBAbWFpbiBydGNcbiAqL1xuXG5cbi8qKlxuICogU2lnbmFsaW5nIGFuZCBzaWduYWxpbmcgY2hhbm5lbHNcbiAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICogQG1haW4gcnRjLnNpZ25hbGluZ1xuICovXG5cblxuLyoqXG4gKiBJbnRlcm5hbCBoZWxwZXJzXG4gKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICogQG1haW4gcnRjLmludGVybmFsXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgYmluZEhlbHBlciwgY29tcGF0O1xuXG4gIGJpbmRIZWxwZXIgPSBmdW5jdGlvbihvYmosIGZ1bikge1xuICAgIGlmIChmdW4gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXR1cm4gZnVuLmJpbmQob2JqKTtcbiAgfTtcblxuICBleHBvcnRzLmNvbXBhdCA9IGNvbXBhdCA9IHtcbiAgICBQZWVyQ29ubmVjdGlvbjogd2luZG93LlBlZXJDb25uZWN0aW9uIHx8IHdpbmRvdy53ZWJraXRQZWVyQ29ubmVjdGlvbjAwIHx8IHdpbmRvdy53ZWJraXRSVENQZWVyQ29ubmVjdGlvbiB8fCB3aW5kb3cubW96UlRDUGVlckNvbm5lY3Rpb24sXG4gICAgSWNlQ2FuZGlkYXRlOiB3aW5kb3cuUlRDSWNlQ2FuZGlkYXRlIHx8IHdpbmRvdy5tb3pSVENJY2VDYW5kaWRhdGUsXG4gICAgU2Vzc2lvbkRlc2NyaXB0aW9uOiB3aW5kb3cubW96UlRDU2Vzc2lvbkRlc2NyaXB0aW9uIHx8IHdpbmRvdy5SVENTZXNzaW9uRGVzY3JpcHRpb24sXG4gICAgTWVkaWFTdHJlYW06IHdpbmRvdy5NZWRpYVN0cmVhbSB8fCB3aW5kb3cubW96TWVkaWFTdHJlYW0gfHwgd2luZG93LndlYmtpdE1lZGlhU3RyZWFtLFxuICAgIGdldFVzZXJNZWRpYTogYmluZEhlbHBlcihuYXZpZ2F0b3IsIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYSksXG4gICAgc3VwcG9ydGVkOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAoY29tcGF0LlBlZXJDb25uZWN0aW9uICE9IG51bGwpICYmIChjb21wYXQuSWNlQ2FuZGlkYXRlICE9IG51bGwpICYmIChjb21wYXQuU2Vzc2lvbkRlc2NyaXB0aW9uICE9IG51bGwpICYmIChjb21wYXQuZ2V0VXNlck1lZGlhICE9IG51bGwpO1xuICAgIH1cbiAgfTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsIFByb21pc2UsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZCwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBBIHdyYXBwZXIgZm9yIFJUQ0RhdGFDaGFubmVsLiBVc2VkIHRvIHRyYW5zZmVyIGN1c3RvbSBkYXRhIGJldHdlZW4gcGVlcnMuXG4gICAqIEBjbGFzcyBydGMuRGF0YUNoYW5uZWxcbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtSVENEYXRhQ2hhbm5lbH0gY2hhbm5lbCBUaGUgd3JhcHBlZCBuYXRpdmUgZGF0YSBjaGFubmVsXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbWF4X2J1ZmZlcl0gVGhlIHNpemUgb2YgdGhlIHNlbmQgYnVmZmVyIGFmdGVyIHdoaWNoIHdlIHdpbGwgZGVsYXkgc2VuZGluZ1xuICAgKi9cblxuICBleHBvcnRzLkRhdGFDaGFubmVsID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoRGF0YUNoYW5uZWwsIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBtZXNzYWdlcyB3YXMgcmVjZWl2ZWQuIFRyaWdnZXJzIG9ubHkgYWZ0ZXIgYGNvbm5lY3QoKWAgd2FzIGNhbGxlZFxuICAgICAqIEBldmVudCBtZXNzYWdlXG4gICAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgcmVjZWl2ZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNoYW5uZWwgd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIERhdGFDaGFubmVsKGNoYW5uZWwsIG1heF9idWZmZXIpIHtcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLm1heF9idWZmZXIgPSBtYXhfYnVmZmVyICE9IG51bGwgPyBtYXhfYnVmZmVyIDogMTAyNCAqIDEwO1xuICAgICAgdGhpcy5fY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICB0aGlzLl9jb25uZWN0X3F1ZXVlID0gW107XG4gICAgICB0aGlzLl9zZW5kX2J1ZmZlciA9IFtdO1xuICAgICAgdGhpcy5jaGFubmVsLm9ubWVzc2FnZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICBpZiAoIV90aGlzLl9jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdF9xdWV1ZS5wdXNoKGV2ZW50LmRhdGEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbWVzc2FnZScsIGV2ZW50LmRhdGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uZXJyb3IgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3QgdG8gdGhlIERhdGFDaGFubmVsLiBZb3Ugd2lsbCByZWNlaXZlIG1lc3NhZ2VzIGFuZCB3aWxsIGJlIGFibGUgdG8gc2VuZCBhZnRlciBjYWxsaW5nIHRoaXMuXG4gICAgICogQG1ldGhvZCBjb25uZWN0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCByZXNvbHZlcyBhcyBzb29uIGFzIHRoZSBEYXRhQ2hhbm5lbCBpcyBvcGVuXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRhdGEsIGksIGxlbiwgcmVmMTtcbiAgICAgIHRoaXMuX2Nvbm5lY3RlZCA9IHRydWU7XG4gICAgICByZWYxID0gdGhpcy5fY29ubmVjdF9xdWV1ZTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJlZjEubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGF0YSA9IHJlZjFbaV07XG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2Nvbm5lY3RfcXVldWU7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfTtcblxuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGFubmVsLmNsb3NlKCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogVGhlIGxhYmVsIG9mIHRoZSBEYXRhQ2hhbm5lbCB1c2VkIHRvIGRpc3Rpbmd1aXNoIG11bHRpcGxlIGNoYW5uZWxzXG4gICAgICogQG1ldGhvZCBsYWJlbFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gVGhlIGxhYmVsXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUubGFiZWwgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwubGFiZWw7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2VuZCBkYXRhIHRvIHRoZSBwZWVyIHRocm91Z2ggdGhlIERhdGFDaGFubmVsXG4gICAgICogQG1ldGhvZCBzZW5kXG4gICAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gYmUgdHJhbnNmZXJyZWRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgd2hlbiB0aGUgZGF0YSB3YXMgcGFzc2VkIHRvIHRoZSBuYXRpdmUgZGF0YSBjaGFubmVsXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBkZWZlcjtcbiAgICAgIGlmICghdGhpcy5fY29ubmVjdGVkKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNlbmRpbmcgd2l0aG91dCBiZWluZyBjb25uZWN0ZWQuIFBsZWFzZSBjYWxsIGNvbm5lY3QoKSBvbiB0aGUgZGF0YSBjaGFubmVsIHRvIHN0YXJ0IHVzaW5nIGl0LlwiKTtcbiAgICAgIH1cbiAgICAgIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLl9zZW5kX2J1ZmZlci5wdXNoKFtkYXRhLCBkZWZlcl0pO1xuICAgICAgaWYgKHRoaXMuX3NlbmRfYnVmZmVyLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICB0aGlzLl9hY3R1YWxTZW5kKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBNZXRob2Qgd2hpY2ggYWN0dWFsbHkgc2VuZHMgdGhlIGRhdGEuIEltcGxlbWVudHMgYnVmZmVyaW5nXG4gICAgICogQG1ldGhvZCBfYWN0dWFsU2VuZFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuX2FjdHVhbFNlbmQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkYXRhLCBkZWZlciwgcmVmMSwgcmVmMiwgcmVzdWx0cztcbiAgICAgIGlmICh0aGlzLmNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLl9zZW5kX2J1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICBpZiAodGhpcy5jaGFubmVsLmJ1ZmZlcmVkQW1vdW50ID49IHRoaXMubWF4X2J1ZmZlcikge1xuICAgICAgICAgICAgc2V0VGltZW91dCh0aGlzLl9hY3R1YWxTZW5kLmJpbmQodGhpcyksIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWYxID0gdGhpcy5fc2VuZF9idWZmZXJbMF0sIGRhdGEgPSByZWYxWzBdLCBkZWZlciA9IHJlZjFbMV07XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbC5zZW5kKGRhdGEpO1xuICAgICAgICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgICAgICAgc2V0VGltZW91dCh0aGlzLl9hY3R1YWxTZW5kLmJpbmQodGhpcyksIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XG4gICAgICAgICAgdGhpcy5fc2VuZF9idWZmZXIuc2hpZnQoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0cyA9IFtdO1xuICAgICAgICB3aGlsZSAodGhpcy5fc2VuZF9idWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgcmVmMiA9IHRoaXMuX3NlbmRfYnVmZmVyLnNoaWZ0KCksIGRhdGEgPSByZWYyWzBdLCBkZWZlciA9IHJlZjJbMV07XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKGRlZmVyLnJlamVjdChuZXcgRXJyb3IoXCJEYXRhQ2hhbm5lbCBjbG9zZWRcIikpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFDaGFubmVsO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLCBQcm9taXNlLCByZWYsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICByZWYgPSByZXF1aXJlKCcuL3Byb21pc2UnKSwgRGVmZXJyZWQgPSByZWYuRGVmZXJyZWQsIFByb21pc2UgPSByZWYuUHJvbWlzZTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuaW50ZXJuYWxcbiAgICovXG5cblxuICAvKipcbiAgICogSGVscGVyIHdoaWNoIGhhbmRsZXMgRGF0YUNoYW5uZWwgbmVnb3RpYXRpb24gZm9yIFJlbW90ZVBlZXJcbiAgICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5DaGFubmVsQ29sbGVjdGlvblxuICAgKi9cblxuICBleHBvcnRzLkNoYW5uZWxDb2xsZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoQ2hhbm5lbENvbGxlY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBkYXRhIGNoYW5uZWwgaXMgYXZhaWxhYmxlXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gc3RyZWFtIFByb21pc2Ugb2YgdGhlIGNoYW5uZWxcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIENoYW5uZWxDb2xsZWN0aW9uKCkge1xuICAgICAgdGhpcy5jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5kZWZlcnMgPSB7fTtcbiAgICAgIHRoaXMucGVuZGluZyA9IHt9O1xuICAgICAgdGhpcy53YWl0X2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMud2FpdF9wID0gdGhpcy53YWl0X2QucHJvbWlzZTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgbG9jYWwgY2hhbm5lbCBkZXNjcmlwdGlvbi5cbiAgICAgKiBAbWV0aG9kIHNldExvY2FsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgT2JqZWN0IGRlc2NyaWJpbmcgZWFjaCBvZmZlcmVkIERhdGFDaGFubmVsXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuc2V0TG9jYWwgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB0aGlzLmxvY2FsID0gZGF0YTtcbiAgICAgIGlmICh0aGlzLnJlbW90ZSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91cGRhdGUoKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJlbW90ZSBjaGFubmVsIGRlc2NyaXB0aW9uLlxuICAgICAqIEBtZXRob2Qgc2V0UmVtb3RlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgT2JqZWN0IGRlc2NyaWJpbmcgZWFjaCBvZmZlcmVkIERhdGFDaGFubmVsXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuc2V0UmVtb3RlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdGhpcy5yZW1vdGUgPSBkYXRhO1xuICAgICAgaWYgKHRoaXMubG9jYWwgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTWF0Y2hlcyByZW1vdGUgYW5kIGxvY2FsIGRlc2NyaXB0aW9ucyBhbmQgY3JlYXRlcyBwcm9taXNlcyBjb21tb24gRGF0YUNoYW5uZWxzXG4gICAgICogQG1ldGhvZCBfdXBkYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5fdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2hhbm5lbCwgY29uZmlnLCBkZWZlciwgbmFtZSwgcmVmMTtcbiAgICAgIHJlZjEgPSB0aGlzLnJlbW90ZTtcbiAgICAgIGZvciAobmFtZSBpbiByZWYxKSB7XG4gICAgICAgIGNvbmZpZyA9IHJlZjFbbmFtZV07XG4gICAgICAgIGlmICh0aGlzLmxvY2FsW25hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAodGhpcy5jaGFubmVsc1tuYW1lXSAhPSBudWxsKSB7XG5cbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGVuZGluZ1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjaGFubmVsID0gdGhpcy5wZW5kaW5nW25hbWVdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1tuYW1lXTtcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbbmFtZV0gPSBQcm9taXNlLnJlc29sdmUoY2hhbm5lbCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9hZGRlZCcsIG5hbWUsIHRoaXMuY2hhbm5lbHNbbmFtZV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICAgICAgdGhpcy5jaGFubmVsc1tuYW1lXSA9IGRlZmVyLnByb21pc2U7XG4gICAgICAgICAgICB0aGlzLmRlZmVyc1tuYW1lXSA9IGRlZmVyO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdkYXRhX2NoYW5uZWxfYWRkZWQnLCBuYW1lLCB0aGlzLmNoYW5uZWxzW25hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJEYXRhQ2hhbm5lbCBvZmZlcmVkIGJ5IHJlbW90ZSBidXQgbm90IGJ5IGxvY2FsXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKG5hbWUgaW4gdGhpcy5sb2NhbCkge1xuICAgICAgICBpZiAodGhpcy5yZW1vdGVbbmFtZV0gPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiRGF0YUNoYW5uZWwgb2ZmZXJlZCBieSBsb2NhbCBidXQgbm90IGJ5IHJlbW90ZVwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMud2FpdF9kLnJlc29sdmUoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyBwcm9taXNlcyB3YWl0aW5nIGZvciB0aGUgZ2l2ZW4gRGF0YUNoYW5uZWxcbiAgICAgKiBAbWV0aG9kIHJlc29sdmVcbiAgICAgKiBAcGFyYW0ge0RhdGFDaGFubmVsfSBjaGFubmVsIFRoZSBuZXcgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihjaGFubmVsKSB7XG4gICAgICB2YXIgbGFiZWw7XG4gICAgICBsYWJlbCA9IGNoYW5uZWwubGFiZWwoKTtcbiAgICAgIGlmICh0aGlzLmRlZmVyc1tsYWJlbF0gIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlZmVyc1tsYWJlbF0ucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgcmV0dXJuIGRlbGV0ZSB0aGlzLmRlZmVyc1tsYWJlbF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5wZW5kaW5nW2xhYmVsXSA9IGNoYW5uZWw7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgcHJvbWlzZSB0byBhIERhdGFDaGFubmVsLiBXaWxsIHJlc29sdmUgaWYgRGF0YUNoYW5uZWwgd2FzIG9mZmVyZWQgYW5kIGdldHMgaW5pdGlhdGVkLiBNaWdodCByZWplY3QgYWZ0ZXIgcmVtb3RlIGFuZCBsb2NhbCBkZXNjcmlwdGlvbiBhcmUgcHJvY2Vzc2VkLlxuICAgICAqIEBtZXRob2QgZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIGxhYmVsIG9mIHRoZSBjaGFubmVsIHRvIGdldFxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gRGF0YUNoYW5uZWx9IFByb21pc2UgZm9yIHRoZSBEYXRhQ2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiB0aGlzLndhaXRfcC50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKF90aGlzLmNoYW5uZWxzW25hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsc1tuYW1lXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGF0YUNoYW5uZWwgbm90IG5lZ290aWF0ZWRcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2hhbm5lbENvbGxlY3Rpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcblxuLyoqXG4gKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICovXG5cblxuLyoqXG4gKiBBbGlhcyBmb3IgbmF0aXZlIHByb21pc2VzIG9yIGEgcG9seWZpbGwgaWYgbm90IHN1cHBvcnRlZFxuICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5Qcm9taXNlXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICBleHBvcnRzLlByb21pc2UgPSBnbG9iYWwuUHJvbWlzZSB8fCByZXF1aXJlKCdlczYtcHJvbWlzZScpLlByb21pc2U7XG5cblxuICAvKipcbiAgICogSGVscGVyIHRvIGltcGxlbWVudCBkZWZlcnJlZCBleGVjdXRpb24gd2l0aCBwcm9taXNlc1xuICAgKiBAY2xhc3MgcnRjLmludGVybmFsLkRlZmVycmVkXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJlc29sdmVzIHRoZSBwcm9taXNlXG4gICAqIEBtZXRob2QgcmVzb2x2ZVxuICAgKiBAcGFyYW0gW2RhdGFdIFRoZSBwYXlsb2FkIHRvIHdoaWNoIHRoZSBwcm9taXNlIHdpbGwgcmVzb2x2ZVxuICAjXG4gICAqIEBleGFtcGxlXG4gICAqICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKVxuICAgKiAgICAgZGVmZXIucmVzb2x2ZSg0Mik7XG4gICAqICAgICBkZWZlci5wcm9taXNlLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAqICAgICAgIGNvbnNvbGUubG9nKHJlcyk7ICAgLy8gNDJcbiAgICogICAgIH1cbiAgICovXG5cblxuICAvKipcbiAgICogUmVqZWN0IHRoZSBwcm9taXNlXG4gICAqIEBtZXRob2QgcmVqZWN0XG4gICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIFRoZSBwYXlsb2FkIHRvIHdoaWNoIHRoZSBwcm9taXNlIHdpbGwgcmVzb2x2ZVxuICAjXG4gICAqIEBleGFtcGxlXG4gICAqICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKVxuICAgKiAgICAgZGVmZXIucmVqZWN0KG5ldyBFcnJvcihcIlJlamVjdCBiZWNhdXNlIHdlIGNhbiFcIikpO1xuICAgKiAgICAgZGVmZXIucHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICogICAgICAgLy8gd29udCBoYXBwZW5cbiAgICogICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgKiAgICAgICAvLyB3aWxsIGhhcHBlblxuICAgKiAgICAgfVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBUaGUgcHJvbWlzZSB3aGljaCB3aWxsIGdldCByZXNvbHZlZCBvciByZWplY3RlZCBieSB0aGlzIGRlZmVycmVkXG4gICAqIEBwcm9wZXJ0eSB7UHJvbWlzZX0gcHJvbWlzZVxuICAgKi9cblxuICBleHBvcnRzLkRlZmVycmVkID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIERlZmVycmVkKCkge1xuICAgICAgdGhpcy5wcm9taXNlID0gbmV3IGV4cG9ydHMuUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIF90aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5yZWplY3QgPSByZWplY3Q7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIERlZmVycmVkO1xuXG4gIH0pKCk7XG5cblxuICAvKipcbiAgICogQWRkcyBhIHRpbWVvdXQgdG8gYSBwcm9taXNlLiBUaGUgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIGlmIHRpbWVvdXQgaXNcbiAgICogcmVhY2hlZC4gSXQgd2lsbCBhY3QgbGlrZSB0aGUgdW5kZXJseWluZyBwcm9taXNlIGlmIGl0IGlzIHJlc29sdmVkIG9yXG4gICAqIHJlamVjdGVkIGJlZm9yZSB0aGUgdGltZW91dCBpcyByZWFjaGVkLlxuICAgKiBAcGFyYW0ge1Byb21zZX0gcHJvbWlzZSBUaGUgdW5kZXJseWluZyBwcm9taXNlXG4gICAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lIFRpbWVvdXQgaW4gbXNcbiAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSBhY3RpbmcgbGlrZSB0aGUgdW5kZXJseWluZyBwcm9taXNlIG9yIHRpbWVvdXRcbiAgICovXG5cbiAgZXhwb3J0cy50aW1lb3V0ID0gZnVuY3Rpb24ocHJvbWlzZSwgdGltZSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiByZWplY3QobmV3IEVycm9yKCdPcGVyYXRpb24gdGltZWQgb3V0JykpO1xuICAgICAgfSwgdGltZSk7XG4gICAgfSk7XG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRGVmZXJyZWQgPSByZXF1aXJlKCcuL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuaW50ZXJuYWxcbiAgICovXG5cblxuICAvKipcbiAgICogSGVscGVyIGhhbmRsaW5nIHRoZSBtYXBwaW5nIG9mIHN0cmVhbXMgZm9yIFJlbW90ZVBlZXJcbiAgICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5TdHJlYW1Db2xsZWN0aW9uXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIGV4cG9ydHMuU3RyZWFtQ29sbGVjdGlvbiA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFN0cmVhbUNvbGxlY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBzdHJlYW0gd2FzIGFkZGVkIHRvIHRoZSBjb2xsZWN0aW9uXG4gICAgICogQGV2ZW50IHN0ZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIHVzZXIgZGVmaW5lZCBuYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gc3RyZWFtIFByb21pc2UgdG8gdGhlIHN0cmVhbVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gU3RyZWFtQ29sbGVjdGlvbigpIHtcblxuICAgICAgLyoqXG4gICAgICAgKiBDb250YWlucyB0aGUgcHJvbWlzZXMgd2hpY2ggd2lsbCByZXNvbHZlIHRvIHRoZSBzdHJlYW1zXG4gICAgICAgKiBAcHJvcGVydHkge09iamVjdH0gc3RyZWFtc1xuICAgICAgICovXG4gICAgICB0aGlzLnN0cmVhbXMgPSB7fTtcbiAgICAgIHRoaXMuX2RlZmVycyA9IHt9O1xuICAgICAgdGhpcy5fd2FpdGluZyA9IHt9O1xuICAgICAgdGhpcy5fcGVuZGluZyA9IHt9O1xuICAgICAgdGhpcy53YWl0X2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMud2FpdF9wID0gdGhpcy53YWl0X2QucHJvbWlzZTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFNldCBzdHJlYW0gZGVzY3JpcHRpb24gYW5kIGdlbmVyYXRlIHByb21pc2VzXG4gICAgICogQG1ldGhvZCB1cGRhdGVcbiAgICAgKiBAcGFyYW0gZGF0YSB7T2JqZWN0fSBBbiBvYmplY3QgbWFwcGluZyB0aGUgc3RyZWFtIGlkcyB0byBzdHJlYW0gbmFtZXNcbiAgICAgKi9cblxuICAgIFN0cmVhbUNvbGxlY3Rpb24ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBkZWZlciwgaSwgaWQsIGxlbiwgbWVtYmVycywgbmFtZSwgcmVmLCBzdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgbWVtYmVycyA9IFtdO1xuICAgICAgdGhpcy5fd2FpdGluZyA9IHt9O1xuICAgICAgcmVmID0gdGhpcy5zdHJlYW1zO1xuICAgICAgZm9yIChzdHJlYW1fcCA9IGkgPSAwLCBsZW4gPSByZWYubGVuZ3RoOyBpIDwgbGVuOyBzdHJlYW1fcCA9ICsraSkge1xuICAgICAgICBuYW1lID0gcmVmW3N0cmVhbV9wXTtcbiAgICAgICAgaWYgKGRhdGFbbmFtZV0gPT0gbnVsbCkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLnN0cmVhbXNbbmFtZV07XG4gICAgICAgICAgdGhpcy5lbWl0KCdzdHJlYW1fcmVtb3ZlZCcsIG5hbWUpO1xuICAgICAgICAgIGlmIChzdHJlYW1fcC5pc0Z1bGxmaWxsZWQoKSkge1xuICAgICAgICAgICAgc3RyZWFtX3AudGhlbihmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0cmVhbS5jbG9zZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChzdHJlYW1fcC5pc1BlbmRpbmcoKSkge1xuICAgICAgICAgICAgc3RyZWFtX3AucmVqZWN0KG5ldyBFcnJvcihcIlN0cmVhbSByZW1vdmVkIGJlZm9yZSBiZWluZyBlc3RhYmxpc2hlZFwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKG5hbWUgaW4gZGF0YSkge1xuICAgICAgICBpZCA9IGRhdGFbbmFtZV07XG4gICAgICAgIGlmICh0aGlzLnN0cmVhbXNbbmFtZV0gPT0gbnVsbCkge1xuICAgICAgICAgIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgICAgdGhpcy5zdHJlYW1zW25hbWVdID0gZGVmZXIucHJvbWlzZTtcbiAgICAgICAgICB0aGlzLl9kZWZlcnNbbmFtZV0gPSBkZWZlcjtcbiAgICAgICAgICB0aGlzLmVtaXQoJ3N0cmVhbV9hZGRlZCcsIG5hbWUsIGRlZmVyLnByb21pc2UpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9kZWZlcnNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgIGlmICh0aGlzLl9wZW5kaW5nW2lkXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBzdHJlYW0gPSB0aGlzLl9wZW5kaW5nW2lkXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9wZW5kaW5nW2lkXTtcbiAgICAgICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXS5yZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZGVmZXJzW25hbWVdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nW2lkXSA9IG5hbWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy53YWl0X2QucmVzb2x2ZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBzdHJlYW0gdG8gdGhlIGNvbGxlY3Rpb24gYW5kIHJlc29sdmUgcHJvbWlzZXMgd2FpdGluZyBmb3IgaXRcbiAgICAgKiBAbWV0aG9kIHJlc29sdmVcbiAgICAgKiBAcGFyYW0ge3J0Yy5TdHJlYW19IHN0cmVhbVxuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgdmFyIGlkLCBuYW1lO1xuICAgICAgaWQgPSBzdHJlYW0uaWQoKTtcbiAgICAgIGlmIChpZCA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLnN0cmVhbXMpLmxlbmd0aCA9PT0gMSAmJiBPYmplY3Qua2V5cyh0aGlzLl93YWl0aW5nKS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIldvcmtpbmcgYXJvdW5kIGluY29tcGF0aWJpbGl0eSBiZXR3ZWVuIEZpcmVmb3ggYW5kIENocm9tZSBjb25jZXJuaW5nIHN0cmVhbSBpZGVudGlmaWNhdGlvblwiKTtcbiAgICAgICAgICBpZCA9IE9iamVjdC5rZXlzKHRoaXMuX3dhaXRpbmcpWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiVW5hYmxlIHRvIHdvcmsgYXJvdW5kIGluY29tcGF0aWJpbGl0eSBiZXR3ZWVuIEZpcmVmb3ggYW5kIENocm9tZSBjb25jZXJuaW5nIHN0cmVhbSBpZGVudGlmaWNhdGlvblwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX3dhaXRpbmdbaWRdICE9IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuX3dhaXRpbmdbaWRdO1xuICAgICAgICBkZWxldGUgdGhpcy5fd2FpdGluZ1tpZF07XG4gICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXS5yZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgIHJldHVybiBkZWxldGUgdGhpcy5fZGVmZXJzW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BlbmRpbmdbaWRdID0gc3RyZWFtO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldHMgYSBwcm9taXNlIGZvciBhIHN0cmVhbSB3aXRoIHRoZSBnaXZlbiBuYW1lLiBNaWdodCBiZSByZWplY3RlZCBhZnRlciBgdXBkYXRlKClgXG4gICAgI1xuICAgICAqIEBtZXRob2QgZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBUaGUgcHJvbWlzZSBmb3IgdGhlIGBydGMuU3RyZWFtYFxuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMud2FpdF9wLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoX3RoaXMuc3RyZWFtc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU3RyZWFtIG5vdCBvZmZlcmVkXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFN0cmVhbUNvbGxlY3Rpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIGV4cG9ydHMsIGV4dGVuZDtcblxuICBleHRlbmQgPSBmdW5jdGlvbihyb290LCBvYmopIHtcbiAgICB2YXIga2V5LCB2YWx1ZTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgIHZhbHVlID0gb2JqW2tleV07XG4gICAgICByb290W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGV4cG9ydHM7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0ge1xuICAgIGludGVybmFsOiB7fSxcbiAgICBzaWduYWxpbmc6IHt9XG4gIH07XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9yZW1vdGVfcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9sb2NhbF9wZWVyJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3BlZXJfY29ubmVjdGlvbicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9zdHJlYW0nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vY29tcGF0JykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3Jvb20nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vdmlkZW9fZWxlbWVudCcpKTtcblxuICBleHRlbmQoZXhwb3J0cy5pbnRlcm5hbCwgcmVxdWlyZSgnLi9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbicpKTtcblxuICBleHRlbmQoZXhwb3J0cy5pbnRlcm5hbCwgcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL3dlYl9zb2NrZXRfY2hhbm5lbCcpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuc2lnbmFsaW5nLCByZXF1aXJlKCcuL3NpZ25hbGluZy9jYWxsaW5nX3NpZ25hbGluZycpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL211Y19zaWduYWxpbmcnKSk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBQZWVyLCBTdHJlYW0sXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBQZWVyID0gcmVxdWlyZSgnLi9wZWVyJykuUGVlcjtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhbCB1c2VyIG9mIHRoZSByb29tXG4gICAqIEBjbGFzcyBydGMuTG9jYWxQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIGV4cG9ydHMuTG9jYWxQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTG9jYWxQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIExvY2FsUGVlcigpIHtcblxuICAgICAgLyoqXG4gICAgICAgKiBDb250YWlucyBwcm9taXNlcyBvZiB0aGUgbG9jYWwgc3RyZWFtcyBvZmZlcmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgICAqIEBwcm9wZXJ0eSBzdHJlYW1zXG4gICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAqL1xuICAgICAgdGhpcy5zdHJlYW1zID0ge307XG5cbiAgICAgIC8qKlxuICAgICAgICogQ29udGFpbnMgYWxsIERhdGFDaGFubmVsIGNvbmZpZ3VyYXRpb25zIG5lZ290aWF0ZWQgd2l0aCBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICAgKiBAcHJvcGVydHkgY2hhbm5lbHNcbiAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICovXG4gICAgICB0aGlzLmNoYW5uZWxzID0ge307XG4gICAgICB0aGlzLl9zdGF0dXMgPSB7fTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBhbiBpdGVtIG9mIHRoZSBzdGF0dXMgdHJhbnNmZXJyZWQgdG8gYWxsIHJlbW90ZSBwZWVyc1xuICAgICAqIEBtZXRob2Qgc3RhdHVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSB2YWx1ZS4gV2lsbCByZXR1cm5cbiAgICAgKiBAcmV0dXJuIFRoZSB2YWx1ZSBhc3NvY2lhdGVkIHdpdGggdGhlIGtleVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgYW4gaXRlbSBvZiB0aGUgc3RhdHVzIHRyYW5zZmVycmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUuIFdpbGwgcmV0dXJuXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBzdG9yZVxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9zdGF0dXNba2V5XSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgdGhpcy5fc3RhdHVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXNba2V5XTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgZGF0YSBjaGFubmVsIHdoaWNoIHdpbGwgYmUgbmVnb3RpYXRlZCB3aXRoIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIGFkZERhdGFDaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdkYXRhJ10gTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtkZXNjPXtvcmRlcmVkOiB0cnVlfV0gT3B0aW9ucyBwYXNzZWQgdG8gYFJUQ0RhdGFDaGFubmVsLmNyZWF0ZURhdGFDaGFubmVsKClgXG4gICAgICovXG5cbiAgICBMb2NhbFBlZXIucHJvdG90eXBlLmFkZERhdGFDaGFubmVsID0gZnVuY3Rpb24obmFtZSwgZGVzYykge1xuICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBkZXNjID0gbmFtZTtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9DSEFOTkVMO1xuICAgICAgfVxuICAgICAgaWYgKGRlc2MgPT0gbnVsbCkge1xuICAgICAgICBkZXNjID0ge1xuICAgICAgICAgIG9yZGVyZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY2hhbm5lbHNbbmFtZV0gPSBkZXNjO1xuICAgICAgdGhpcy5lbWl0KCdjb25maWd1cmF0aW9uX2NoYW5nZWQnKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgbG9jYWwgc3RyZWFtIHRvIGJlIHNlbnQgdG8gYWxsIHJlbW90ZSBwZWVyc1xuICAgICAqIEBtZXRob2QgYWRkU3RyZWFtXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdzdHJlYW0nXSBOYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbSB8IHJ0Yy5TdHJlYW0gfCBPYmplY3R9IHN0cmVhbSBUaGUgc3RyZWFtLCBhIHByb21pc2UgdG8gdGhlIHN0cmVhbSBvciB0aGUgY29uZmlndXJhdGlvbiB0byBjcmVhdGUgYSBzdHJlYW0gd2l0aCBgcnRjLlN0cmVhbS5jcmVhdGVTdHJlYW0oKWBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2Ugb2YgdGhlIHN0cmVhbSB3aGljaCB3YXMgYWRkZWRcbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuYWRkU3RyZWFtID0gZnVuY3Rpb24obmFtZSwgb2JqKSB7XG4gICAgICB2YXIgc2F2ZVN0cmVhbSwgc3RyZWFtX3A7XG4gICAgICBzYXZlU3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW1fcCkge1xuICAgICAgICAgIF90aGlzLnN0cmVhbXNbbmFtZV0gPSBzdHJlYW1fcDtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdjb25maWd1cmF0aW9uX2NoYW5nZWQnKTtcbiAgICAgICAgICByZXR1cm4gc3RyZWFtX3A7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgb2JqID0gbmFtZTtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9TVFJFQU07XG4gICAgICB9XG4gICAgICBpZiAoKG9iaiAhPSBudWxsID8gb2JqLnRoZW4gOiB2b2lkIDApICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0ob2JqKTtcbiAgICAgIH0gZWxzZSBpZiAob2JqIGluc3RhbmNlb2YgU3RyZWFtKSB7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKFByb21pc2UucmVzb2x2ZShvYmopKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmVhbV9wID0gU3RyZWFtLmNyZWF0ZVN0cmVhbShvYmopO1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShzdHJlYW1fcCk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGxvY2FsIHN0cmVhbVxuICAgICAqIEBtZXRob2Qgc3RyZWFtXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdzdHJlYW0nXSBOYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2Ugb2YgdGhlIHN0cmVhbVxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5zdHJlYW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciB0aGUgcGVlciBpcyB0aGUgbG9jYWwgcGVlci4gUmV0dXJucyBhbHdheXMgYHRydWVgIG9uIHRoaXNcbiAgICAgKiBjbGFzcy5cbiAgICAgKiBAbWV0aG9kIGlzTG9jYWxcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYFxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5pc0xvY2FsID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIExvY2FsUGVlcjtcblxuICB9KShQZWVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlcixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBBIHVzZXIgaW4gdGhlIHJvb21cbiAgICogQGNsYXNzIHJ0Yy5QZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFBlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gUGVlcigpIHtcbiAgICAgIHJldHVybiBQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXR1cyBvZiB0aGUgcGVlciBoYXMgY2hhbmdlZFxuICAgICAqIEBldmVudCBzdGF0dXNfY2hhbmdlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0dXMgVGhlIG5ldyBzdGF0dXMgb2JqZWN0XG4gICAgICovXG5cbiAgICBQZWVyLnByb3RvdHlwZS5ERUZBVUxUX0NIQU5ORUwgPSAnZGF0YSc7XG5cbiAgICBQZWVyLnByb3RvdHlwZS5ERUZBVUxUX1NUUkVBTSA9ICdzdHJlYW0nO1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSB2YWx1ZSBvZiB0aGUgc3RhdHVzIG9iamVjdFxuICAgICAqIEBtZXRob2Qgc3RhdHVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IFxuICAgICAqIEByZXR1cm4gVGhlIHZhbHVlXG4gICAgICovXG5cbiAgICBQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERhdGFDaGFubmVsLCBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLCBQcm9taXNlLCBTdHJlYW0sIGNvbXBhdCwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9wcm9taXNlJyksIERlZmVycmVkID0gcmVmLkRlZmVycmVkLCBQcm9taXNlID0gcmVmLlByb21pc2U7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIFN0cmVhbSA9IHJlcXVpcmUoJy4vc3RyZWFtJykuU3RyZWFtO1xuXG4gIERhdGFDaGFubmVsID0gcmVxdWlyZSgnLi9kYXRhX2NoYW5uZWwnKS5EYXRhQ2hhbm5lbDtcblxuICBjb21wYXQgPSByZXF1aXJlKCcuL2NvbXBhdCcpLmNvbXBhdDtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBuYXRpdmUgUlRDUGVlckNvbm5lY3Rpb25cbiAgI1xuICAgKiBQcm92aWRlcyBldmVudHMgZm9yIG5ldyBzdHJlYW1zIGFuZCBkYXRhIGNoYW5uZWxzLiBTaWduYWxpbmcgaW5mb3JtYXRpb24gaGFzXG4gICAqIHRvIGJlIGZvcndhcmRlZCBmcm9tIGV2ZW50cyBlbWl0dGVkIGJ5IHRoaXMgb2JqZWN0IHRvIHRoZSByZW1vdGVcbiAgICogUGVlckNvbm5lY3Rpb24uXG4gICNcbiAgICogQGNsYXNzIHJ0Yy5QZWVyQ29ubmVjdGlvblxuICAgKiBAZXh0ZW5kcyBldmVudHMuRXZlbnRFbWl0dGVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb2ZmZXJpbmcgVHJ1ZSBpZiB0aGUgbG9jYWwgcGVlciBzaG91bGQgaW5pdGlhdGUgdGhlIGNvbm5lY3Rpb25cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgT3B0aW9ucyBvYmplY3QgcGFzc2VkIG9uIGZyb20gYFJvb21gXG4gICAqL1xuXG4gIGV4cG9ydHMuUGVlckNvbm5lY3Rpb24gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQZWVyQ29ubmVjdGlvbiwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIE5ldyBsb2NhbCBJQ0UgY2FuZGlkYXRlIHdoaWNoIHNob3VsZCBiZSBzaWduYWxlZCB0byByZW1vdGUgcGVlclxuICAgICAqIEBldmVudCBpY2VfY2FuZGlhdGVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2FuZGlkYXRlIFRoZSBpY2UgY2FuZGlkYXRlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIE5ldyByZW1vdGUgc3RyZWFtIHdhcyBhZGRlZCB0byB0aGUgUGVlckNvbm5lY3Rpb25cbiAgICAgKiBAZXZlbnQgc3RyZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtydGMuU3RyZWFtfSBzdHJlYW0gVGhlIHN0cmVhbVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBOZXcgRGF0YUNoYW5uZWwgdG8gdGhlIHJlbW90ZSBwZWVyIGlzIHJlYWR5IHRvIGJlIHVzZWRcbiAgICAgKiBAZXZlbnQgZGF0YV9jaGFubmVsX3JlYWR5XG4gICAgICogQHBhcmFtIHtydGMuRGF0YUNoYW5uZWx9IGNoYW5uZWwgVGhlIGRhdGEgY2hhbm5lbFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBOZXcgb2ZmZXIgb3IgYW5zd2VyIHdoaWNoIHNob3VsZCBiZSBzaWduYWxlZCB0byB0aGUgcmVtb3RlIHBlZXJcbiAgICAgKiBAZXZlbnQgc2lnbmFsaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgc2lnbmFsaW5nIG1lc3NhZ2VcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIFBlZXJDb25uZWN0aW9uIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBQZWVyQ29ubmVjdGlvbihvZmZlcmluZywgb3B0aW9uczEpIHtcbiAgICAgIHZhciBpY2Vfc2VydmVycztcbiAgICAgIHRoaXMub2ZmZXJpbmcgPSBvZmZlcmluZztcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMxO1xuICAgICAgaWNlX3NlcnZlcnMgPSBbXTtcbiAgICAgIHRoaXMubm9fZ2NfYnVnZml4ID0gW107XG4gICAgICBpZiAodGhpcy5vcHRpb25zLnN0dW4gIT0gbnVsbCkge1xuICAgICAgICBpY2Vfc2VydmVycy5wdXNoKHtcbiAgICAgICAgICB1cmw6IHRoaXMub3B0aW9ucy5zdHVuXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdGhpcy5wYyA9IG5ldyBjb21wYXQuUGVlckNvbm5lY3Rpb24oe1xuICAgICAgICBpY2VTZXJ2ZXJzOiBpY2Vfc2VydmVyc1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuY29ubmVjdF9kLnByb21pc2VbXCJjYXRjaFwiXShmdW5jdGlvbigpIHt9KTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nX3BlbmRpbmcgPSBbXTtcbiAgICAgIHRoaXMucGMub25pY2VjYW5kaWRhdGUgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2ljZV9jYW5kaWRhdGUnLCBldmVudC5jYW5kaWRhdGUpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uYWRkc3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdHJlYW1fYWRkZWQnLCBuZXcgU3RyZWFtKGV2ZW50LnN0cmVhbSkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uZGF0YWNoYW5uZWwgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChldmVudC5jaGFubmVsKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25yZW1vdmVzdHJlYW0gPSBmdW5jdGlvbihldmVudCkge307XG4gICAgICB0aGlzLnBjLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKCdvbm5lZ290aWF0aW9ubmVlZGVkIGNhbGxlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcmVmMTtcbiAgICAgICAgICBpZiAoX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZmFpbGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0RXJyb3IobmV3IEVycm9yKFwiVW5hYmxlIHRvIGVzdGFibGlzaCBJQ0UgY29ubmVjdGlvblwiKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChfdGhpcy5wYy5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdjbG9zZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY29ubmVjdF9kLnJlamVjdChuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gd2FzIGNsb3NlZCcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKChyZWYxID0gX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlKSA9PT0gJ2Nvbm5lY3RlZCcgfHwgcmVmMSA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jb25uZWN0X2QucmVzb2x2ZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5wYy5vbnNpZ25hbGluZ3N0YXRlY2hhbmdlID0gZnVuY3Rpb24oZXZlbnQpIHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQWRkIG5ldyBzaWduYWxpbmcgaW5mb3JtYXRpb24gcmVjZWl2ZWQgZnJvbSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2Qgc2lnbmFsaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIHNpZ25hbGluZyBpbmZvcm1hdGlvblxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLnNpZ25hbGluZyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBzZHA7XG4gICAgICBzZHAgPSBuZXcgY29tcGF0LlNlc3Npb25EZXNjcmlwdGlvbihkYXRhKTtcbiAgICAgIHJldHVybiB0aGlzLl9zZXRSZW1vdGVEZXNjcmlwdGlvbihzZHApLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnb2ZmZXInICYmIF90aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9hbnN3ZXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgcmVtb3RlIElDRSBjYW5kaWRhdGVcbiAgICAgKiBAbWV0aG9kIGFkZEljZUNhbmRpZGF0ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjIFRoZSBjYW5kaWRhdGVcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRJY2VDYW5kaWRhdGUgPSBmdW5jdGlvbihkZXNjKSB7XG4gICAgICB2YXIgY2FuZGlkYXRlO1xuICAgICAgaWYgKChkZXNjICE9IG51bGwgPyBkZXNjLmNhbmRpZGF0ZSA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICBjYW5kaWRhdGUgPSBuZXcgY29tcGF0LkljZUNhbmRpZGF0ZShkZXNjKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGMuYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY29uc29sZS5sb2coXCJJQ0UgdHJpY2tsaW5nIHN0b3BwZWRcIik7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgb3B0aW9ucyBmb3IgdGhlIG9mZmVyL2Fuc3dlclxuICAgICAqIEBtZXRob2QgX29hT3B0aW9uc1xuICAgICAqIEBwcml2YXRlXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9vYU9wdGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wdGlvbmFsOiBbXSxcbiAgICAgICAgbWFuZGF0b3J5OiB7XG4gICAgICAgICAgT2ZmZXJUb1JlY2VpdmVBdWRpbzogdHJ1ZSxcbiAgICAgICAgICBPZmZlclRvUmVjZWl2ZVZpZGVvOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByZW1vdGUgZGVzY3JpcHRpb25cbiAgICAgKiBAbWV0aG9kIF9zZXRSZW1vdGVEZXNjcmlwdGlvblxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNkcCBUaGUgcmVtb3RlIFNEUFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCBiZSByZXNvbHZlZCBvbmNlIHRoZSByZW1vdGUgZGVzY3JpcHRpb24gd2FzIHNldCBzdWNjZXNzZnVsbHlcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fc2V0UmVtb3RlRGVzY3JpcHRpb24gPSBmdW5jdGlvbihzZHApIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHZhciBkZXNjcmlwdGlvbjtcbiAgICAgICAgICBkZXNjcmlwdGlvbiA9IG5ldyBjb21wYXQuU2Vzc2lvbkRlc2NyaXB0aW9uKHNkcCk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLnNldFJlbW90ZURlc2NyaXB0aW9uKHNkcCwgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgb2ZmZXIsIHNldCBpdCBvbiBsb2NhbCBkZXNjcmlwdGlvbiBhbmQgZW1pdCBpdFxuICAgICAqIEBtZXRob2QgX29mZmVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fb2ZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5jcmVhdGVPZmZlcihyZXNvbHZlLCByZWplY3QsIF90aGlzLl9vYU9wdGlvbnMoKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNkcCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fcHJvY2Vzc0xvY2FsU2RwKHNkcCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuc3dlciwgc2V0IGl0IG9uIGxvY2FsIGRlc2NyaXB0aW9uIGFuZCBlbWl0IGl0XG4gICAgICogQG1ldGhvZCBfb2ZmZXJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9hbnN3ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5jcmVhdGVBbnN3ZXIocmVzb2x2ZSwgcmVqZWN0LCBfdGhpcy5fb2FPcHRpb25zKCkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzZHApIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX3Byb2Nlc3NMb2NhbFNkcChzZHApO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpW1wiY2F0Y2hcIl0oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RFcnJvcihlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNldCBsb2NhbCBkZXNjcmlwdGlvbiBhbmQgZW1pdCBpdFxuICAgICAqIEBtZXRob2QgX3Byb2Nlc3NMb2NhbFNkcFxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNkcCBUaGUgbG9jYWwgU0RQXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIGxvY2FsIGRlc2NyaXB0aW9uIHdhcyBzZXQgc3VjY2Vzc2Z1bGx5XG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX3Byb2Nlc3NMb2NhbFNkcCA9IGZ1bmN0aW9uKHNkcCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgdmFyIHN1Y2Nlc3M7XG4gICAgICAgICAgc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGRhdGE7XG4gICAgICAgICAgICBkYXRhID0ge1xuICAgICAgICAgICAgICBzZHA6IHNkcC5zZHAsXG4gICAgICAgICAgICAgIHR5cGU6IHNkcC50eXBlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgX3RoaXMuZW1pdCgnc2lnbmFsaW5nJywgZGF0YSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShzZHApO1xuICAgICAgICAgIH07XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLnNldExvY2FsRGVzY3JpcHRpb24oc2RwLCBzdWNjZXNzLCByZWplY3QpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE1hcmsgY29ubmVjdGlvbiBhdHRlbXB0IGFzIGZhaWxlZFxuICAgICAqIEBtZXRob2QgX2Nvbm5lY3RFcnJvclxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyIEVycm9yIGNhdXNpbmcgY29ubmVjdGlvbiB0byBmYWlsXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Nvbm5lY3RFcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgdGhpcy5jb25uZWN0X2QucmVqZWN0KGVycik7XG4gICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIGFkZFN0cmVhbVxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtIFRoZSBsb2NhbCBzdHJlYW1cbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHJldHVybiB0aGlzLnBjLmFkZFN0cmVhbShzdHJlYW0uc3RyZWFtKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgbG9jYWwgc3RyZWFtXG4gICAgICogQG1ldGhvZCByZW1vdmVTdHJlYW1cbiAgICAgKiBAcGFyYW0ge3J0Yy5TdHJlYW19IHN0cmVhbSBUaGUgbG9jYWwgc3RyZWFtXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUucmVtb3ZlU3JlYW0gPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHJldHVybiB0aGlzLnBjLnJlbW92ZVN0cmVhbShzdHJlYW0uc3RyZWFtKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgRGF0YUNoYW5uZWwuIFdpbGwgb25seSBhY3R1YWxseSBkbyBzb21ldGhpbmcgaWYgYG9mZmVyaW5nYCBpcyBgdHJ1ZWAuXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENQZWVyQ29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmFkZERhdGFDaGFubmVsID0gZnVuY3Rpb24obmFtZSwgb3B0aW9ucykge1xuICAgICAgdmFyIGNoYW5uZWw7XG4gICAgICBpZiAodGhpcy5vZmZlcmluZykge1xuICAgICAgICBjaGFubmVsID0gdGhpcy5wYy5jcmVhdGVEYXRhQ2hhbm5lbChuYW1lLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5ub19nY19idWdmaXgucHVzaChjaGFubmVsKTtcbiAgICAgICAgcmV0dXJuIGNoYW5uZWwub25vcGVuID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChjaGFubmVsKSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogRXN0YWJsaXNoIGNvbm5lY3Rpb24gd2l0aCByZW1vdGUgcGVlci4gQ29ubmVjdGlvbiB3aWxsIGJlIGVzdGFibGlzaGVkIG9uY2UgYm90aCBwZWVycyBoYXZlIGNhbGxlZCB0aGlzIGZ1bmN0aW9cbiAgICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgb25jZSB0aGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZFxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghdGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgICAgaWYgKHRoaXMub2ZmZXJpbmcpIHtcbiAgICAgICAgICB0aGlzLl9vZmZlcigpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGMuc2lnbmFsaW5nU3RhdGUgPT09ICdoYXZlLXJlbW90ZS1vZmZlcicpIHtcbiAgICAgICAgICB0aGlzLl9hbnN3ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY29ubmVjdF9kLnByb21pc2UpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlIHRoZSBjb25uZWN0aW9uIHRvIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wYy5jbG9zZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyQ29ubmVjdGlvbjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQ2hhbm5lbENvbGxlY3Rpb24sIFBlZXIsIFByb21pc2UsIFN0cmVhbUNvbGxlY3Rpb24sIG1lcmdlLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgUHJvbWlzZSA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLlByb21pc2U7XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cbiAgU3RyZWFtQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24nKS5TdHJlYW1Db2xsZWN0aW9uO1xuXG4gIENoYW5uZWxDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKS5DaGFubmVsQ29sbGVjdGlvbjtcblxuICBtZXJnZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcnJheSwgaSwga2V5LCBsZW4sIHJlcywgdmFsdWU7XG4gICAgcmVzID0ge307XG4gICAgZm9yIChpID0gMCwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBhcnJheSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoa2V5IGluIGFycmF5KSB7XG4gICAgICAgIHZhbHVlID0gYXJyYXlba2V5XTtcbiAgICAgICAgcmVzW2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgcmVtb3RlIHVzZXIgb2YgdGhlIHJvb21cbiAgICogQGNsYXNzIHJ0Yy5SZW1vdGVQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLlBlZXJDb25uZWN0aW9ufSBwZWVyX2Nvbm5lY3Rpb24gVGhlIHVuZGVybHlpbmcgcGVlciBjb25uZWN0aW9uXG4gICAqIEBwYXJhbSB7cnRjLlNpZ25hbGluZ1BlZXJ9IHNpZ25hbGluZyBUaGUgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICogQHBhcmFtIHtydGMuTG9jYWxQZWVyfSBsb2NhbCBUaGUgbG9jYWwgcGVlclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBUaGUgb3B0aW9ucyBvYmplY3QgYXMgcGFzc2VkIHRvIGBSb29tYFxuICAgKi9cblxuICBleHBvcnRzLlJlbW90ZVBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChSZW1vdGVQZWVyLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogTWVzc2FnZSByZWNlaXZlZCBmcm9tIHBlZXIgdGhyb3VnaCBzaWduYWxpbmdcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkIG9mIHRoZSBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW1vdGUgcGVlciBsZWZ0IG9yIHNpZ25hbGluZyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBzdHJlYW0gaXMgYXZhaWxhYmxlIGZyb20gdGhlIHBlZXJcbiAgICAgKiBAZXZlbnQgc3RyZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgZGF0YSBjaGFubmVsIGlzIGF2YWlsYWJsZSBmcm9tIHRoZSBwZWVyXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLkRhdGFDaGFubmVsfSBjaGFubmVsIFByb21pc2Ugb2YgdGhlIGNoYW5uZWxcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXIgc3VwcGxpZWQgYnkgdGhlIHNpZ25hbGluZyBpbXBsZW1lbnRhdGlvblxuICAgICAqIEBwcm9wZXJ0eSBzaWduYWxpbmdcbiAgICAgKiBAdHlwZSBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1BlZXJcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFJlbW90ZVBlZXIocGVlcl9jb25uZWN0aW9uLCBzaWduYWxpbmcsIGxvY2FsLCBvcHRpb25zMSkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24gPSBwZWVyX2Nvbm5lY3Rpb247XG4gICAgICB0aGlzLnNpZ25hbGluZyA9IHNpZ25hbGluZztcbiAgICAgIHRoaXMubG9jYWwgPSBsb2NhbDtcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMxO1xuICAgICAgdGhpcy5wcml2YXRlX3N0cmVhbXMgPSB7fTtcbiAgICAgIHRoaXMucHJpdmF0ZV9jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbiA9IG5ldyBTdHJlYW1Db2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLnN0cmVhbXMgPSB0aGlzLnN0cmVhbV9jb2xsZWN0aW9uLnN0cmVhbXM7XG4gICAgICB0aGlzLnN0cmVhbXNfZGVzYyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihuYW1lLCBzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RyZWFtX2FkZGVkJywgbmFtZSwgc3RyZWFtKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uID0gbmV3IENoYW5uZWxDb2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLmNoYW5uZWxzID0gdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uY2hhbm5lbHM7XG4gICAgICB0aGlzLmNoYW5uZWxzX2Rlc2MgPSB7fTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLm9uKCdkYXRhX2NoYW5uZWxfYWRkZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUsIGNoYW5uZWwpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgY2hhbm5lbCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtX2NvbGxlY3Rpb24ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2RhdGFfY2hhbm5lbF9yZWFkeScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24ucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBkYXRhLnN0cmVhbXMgPSBfdGhpcy5zdHJlYW1zX2Rlc2M7XG4gICAgICAgICAgZGF0YS5jaGFubmVscyA9IF90aGlzLmNoYW5uZWxzX2Rlc2M7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnNpZ25hbGluZy5zZW5kKCdzaWduYWxpbmcnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBfdGhpcy5zdHJlYW1fY29sbGVjdGlvbi51cGRhdGUoZGF0YS5zdHJlYW1zKTtcbiAgICAgICAgICBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uc2V0UmVtb3RlKGRhdGEuY2hhbm5lbHMpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uc2lnbmFsaW5nKGRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2ljZV9jYW5kaWRhdGUnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zaWduYWxpbmcuc2VuZCgnaWNlX2NhbmRpZGF0ZScsIGNhbmRpZGF0ZSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbignaWNlX2NhbmRpZGF0ZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBlZXJfY29ubmVjdGlvbi5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzdGF0dXNfY2hhbmdlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdsZWZ0JywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbGVmdCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2Nvbm5lY3RlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7fTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdjbG9zZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge307XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICBpZiAoKHRoaXMub3B0aW9ucy5hdXRvX2Nvbm5lY3QgPT0gbnVsbCkgfHwgdGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCkge1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5zdGF0dXNba2V5XTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGEgbWVzc2FnZSB0byB0aGUgcGVlciB0aHJvdWdoIHNpZ25hbGluZ1xuICAgICAqIEBtZXRob2QgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBkYXRhIHdhcyBzZW50XG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5tZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLnNlbmQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRvIHRoZSByZW1vdGUgcGVlciB0byBleGNoYW5nZSBzdHJlYW1zIGFuZCBjcmVhdGUgZGF0YSBjaGFubmVsc1xuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCByZXNvbHZlZCB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbmFtZSwgcHJvbWlzZSwgcmVmLCBzdHJlYW0sIHN0cmVhbV9wcm9taXNlcztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHN0cmVhbV9wcm9taXNlcyA9IFtdO1xuICAgICAgICByZWYgPSBtZXJnZSh0aGlzLmxvY2FsLnN0cmVhbXMsIHRoaXMucHJpdmF0ZV9zdHJlYW1zKTtcbiAgICAgICAgZm9yIChuYW1lIGluIHJlZikge1xuICAgICAgICAgIHN0cmVhbSA9IHJlZltuYW1lXTtcbiAgICAgICAgICBwcm9taXNlID0gc3RyZWFtLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgICByZXR1cm4gW25hbWUsIHN0cmVhbV07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc3RyZWFtX3Byb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBQcm9taXNlLmFsbChzdHJlYW1fcHJvbWlzZXMpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbXMpIHtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIG9wdGlvbnMsIHJlZjEsIHJlZjI7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBzdHJlYW1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgIHJlZjEgPSBzdHJlYW1zW2ldLCBuYW1lID0gcmVmMVswXSwgc3RyZWFtID0gcmVmMVsxXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZFN0cmVhbShzdHJlYW0pO1xuICAgICAgICAgICAgICBfdGhpcy5zdHJlYW1zX2Rlc2NbbmFtZV0gPSBzdHJlYW0uaWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlZjIgPSBtZXJnZShfdGhpcy5sb2NhbC5jaGFubmVscywgX3RoaXMucHJpdmF0ZV9jaGFubmVscyk7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gcmVmMikge1xuICAgICAgICAgICAgICBvcHRpb25zID0gcmVmMltuYW1lXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZERhdGFDaGFubmVsKG5hbWUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICBfdGhpcy5jaGFubmVsc19kZXNjW25hbWVdID0gb3B0aW9ucztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5zZXRMb2NhbChfdGhpcy5jaGFubmVsc19kZXNjKTtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY29ubmVjdCgpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKiBAbWV0aG9kIGNsb3NlXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzdHJlYW0gZnJvbSB0aGUgcGVlci4gSGFzIHRvIGJlIHNlbnQgYnkgdGhlIHJlbW90ZSBwZWVyIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gUHJvbWlzZSBvZiB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdHJlYW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtX2NvbGxlY3Rpb24uZ2V0KG5hbWUpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW0gdG8gYmUgc2VudCB0byB0aGlzIHJlbW90ZSBwZWVyXG4gICAgI1xuICAgICAqIElmIHlvdSB1c2UgdGhpcyBtZXRob2QgeW91IGhhdmUgdG8gc2V0IGBhdXRvX2Nvbm5lY3RgIHRvIGBmYWxzZWAgaW4gdGhlIG9wdGlvbnMgb2JqZWN0IGFuZCBjYWxsIGBjb25uZWN0KClgIG1hbnVhbGx5IG9uIGFsbCByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgICAqIEBtZXRob2QgYWRkU3RyZWFtXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdzdHJlYW0nXSBOYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbSB8IHJ0Yy5TdHJlYW0gfCBPYmplY3R9IHN0cmVhbSBUaGUgc3RyZWFtLCBhIHByb21pc2UgdG8gdGhlIHN0cmVhbSBvciB0aGUgY29uZmlndXJhdGlvbiB0byBjcmVhdGUgYSBzdHJlYW0gd2l0aCBgcnRjLlN0cmVhbS5jcmVhdGVTdHJlYW0oKWBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2Ugb2YgdGhlIHN0cmVhbSB3aGljaCB3YXMgYWRkZWRcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUsIG9iaikge1xuICAgICAgdmFyIHNhdmVTdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgaWYgKCEodGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcIlVuYWJsZSB0byBhZGQgc3RyZWFtcyBkaXJlY3RseSB0byByZW1vdGUgcGVlcnMgd2l0aG91dCAnYXV0b19jb25uZWN0JyBvcHRpb24gc2V0IHRvICdmYWxzZSdcIik7XG4gICAgICB9XG4gICAgICBzYXZlU3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW1fcCkge1xuICAgICAgICAgIF90aGlzLnByaXZhdGVfc3RyZWFtc1tuYW1lXSA9IHN0cmVhbV9wO1xuICAgICAgICAgIHJldHVybiBzdHJlYW1fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIGlmICgob2JqICE9IG51bGwgPyBvYmoudGhlbiA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShvYmopO1xuICAgICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oUHJvbWlzZS5yZXNvbHZlKG9iaikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyZWFtX3AgPSBTdHJlYW0uY3JlYXRlU3RyZWFtKG9iaik7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKHN0cmVhbV9wKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBkYXRhIGNoYW5uZWwgdG8gdGhlIHJlbW90ZSBwZWVyLiBIYXMgdG8gYmUgYWRkZWQgYnkgbG9jYWwgYW5kIHJlbW90ZSBzaWRlIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBjaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdkYXRhJ10gTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuRGF0YUNoYW5uZWx9IFByb21pc2Ugb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuY2hhbm5lbCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9DSEFOTkVMO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLmdldChuYW1lKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgZGF0YSBjaGFubmVsIHdoaWNoIHdpbGwgYmUgbmVnb3RpYXRlZCB3aXRoIHRoaXMgcmVtb3RlIHBlZXJcbiAgICAjXG4gICAgICogSWYgeW91IHVzZSB0aGlzIG1ldGhvZCB5b3UgaGF2ZSB0byBzZXQgYGF1dG9fY29ubmVjdGAgdG8gYGZhbHNlYCBpbiB0aGUgb3B0aW9ucyBvYmplY3QgYW5kIGNhbGwgYGNvbm5lY3QoKWAgbWFudWFsbHkgb24gYWxsIHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nZGF0YSddIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGVzYz17b3JkZXJlZDogdHJ1ZX1dIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENEYXRhQ2hhbm5lbC5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuYWRkRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihuYW1lLCBkZXNjKSB7XG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuYXV0b19jb25uZWN0ID09PSBmYWxzZSkpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFwiVW5hYmxlIHRvIGFkZCBjaGFubmVscyBkaXJlY3RseSB0byByZW1vdGUgcGVlcnMgd2l0aG91dCAnYXV0b19jb25uZWN0JyBvcHRpb24gc2V0IHRvICdmYWxzZSdcIik7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2MgPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX0NIQU5ORUw7XG4gICAgICB9XG4gICAgICBpZiAoZGVzYyA9PSBudWxsKSB7XG4gICAgICAgIGRlc2MgPSB7XG4gICAgICAgICAgb3JkZXJlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5wcml2YXRlX2NoYW5uZWxzW25hbWVdID0gZGVzYztcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwobmFtZSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHBlZXIgaXMgdGhlIGxvY2FsIHBlZXIuIFJldHVybnMgYWx3YXlzIGBmYWxzZWAgb24gdGhpc1xuICAgICAqIGNsYXNzLlxuICAgICAqIEBtZXRob2QgaXNMb2NhbFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFJldHVybnMgYGZhbHNlYFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuaXNMb2NhbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gUmVtb3RlUGVlcjtcblxuICB9KShQZWVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlciwgTG9jYWxQZWVyLCBNdWNTaWduYWxpbmcsIFBlZXJDb25uZWN0aW9uLCBSZW1vdGVQZWVyLCBXZWJTb2NrZXRDaGFubmVsLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIFdlYlNvY2tldENoYW5uZWwgPSByZXF1aXJlKCcuL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwnKS5XZWJTb2NrZXRDaGFubmVsO1xuXG4gIE11Y1NpZ25hbGluZyA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nL211Y19zaWduYWxpbmcnKS5NdWNTaWduYWxpbmc7XG5cbiAgUmVtb3RlUGVlciA9IHJlcXVpcmUoJy4vcmVtb3RlX3BlZXInKS5SZW1vdGVQZWVyO1xuXG4gIExvY2FsUGVlciA9IHJlcXVpcmUoJy4vbG9jYWxfcGVlcicpLkxvY2FsUGVlcjtcblxuICBQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vcGVlcl9jb25uZWN0aW9uJykuUGVlckNvbm5lY3Rpb247XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQSB2aXJ0dWFsIHJvb20gd2hpY2ggY29ubmVjdHMgbXVsdGlwbGUgUGVlcnNcbiAgICogQGNsYXNzIHJ0Yy5Sb29tXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSByb29tLiBXaWxsIGJlIHBhc3NlZCBvbiB0byBzaWduYWxpbmdcbiAgICogQHBhcmFtIHtydGMuU2lnbmFsaW5nIHwgU3RyaW5nfSBzaWduYWxpbmcgVGhlIHNpZ25hbGluZyB0byBiZSB1c2VkLiBJZiB5b3UgcGFzcyBhIHN0cmluZyBpdCB3aWxsIGJlIGludGVycHJldGVkIGFzIGEgd2Vic29ja2V0IGFkZHJlc3MgYW5kIGEgcGFsYXZhIHNpZ25hbGluZyBjb25uZWN0aW9uIHdpbGwgYmUgZXN0YWJsaXNoZWQgd2l0aCBpdC5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBWYXJpb3VzIG9wdGlvbnMgdG8gYmUgdXNlZCBpbiBjb25uZWN0aW9ucyBjcmVhdGVkIGJ5IHRoaXMgcm9vbVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmF1dG9fY29ubmVjdD10cnVlXSBXaGV0aGVyIHJlbW90ZSBwZWVycyBhcmUgY29ubmVjdGVkIGF1dG9tYXRpY2FsbHkgb3IgYW4gZXhwbGljaXQgYFJlbW90ZVBlZXIuY29ubmVjdCgpYCBjYWxsIGlzIG5lZWRlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMuc3R1bl0gVGhlIFVSSSBvZiB0aGUgU1RVTiBzZXJ2ZXIgdG8gdXNlXG4gICAqIEBwYXJhbSB7cnRjLkxvY2FsUGVlcn0gW29wdGlvbnMubG9jYWxdIFRoZSBsb2NhbCB1c2VyXG4gICAqL1xuXG4gIGV4cG9ydHMuUm9vbSA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFJvb20sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBwZWVyIGlzIGVuY291bnRlcmVkIGluIHRoZSByb29tLiBGaXJlcyBvbiBuZXcgcmVtb3RlIHBlZXJzIGFmdGVyIGpvaW5pbmcgYW5kIGZvciBhbGwgcGVlcnMgaW4gdGhlIHJvb20gd2hlbiBqb2luaW5nLlxuICAgICAqIEBldmVudCBwZWVyX2pvcGluZWRcbiAgICAgKiBAcGFyYW0ge3J0Yy5SZW1vdGVQZWVyfSBwZWVyIFRoZSBuZXcgcGVlclxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIHBlZXIgbGVmdCB0aGUgcm9vbS5cbiAgICAgKiBAZXZlbnQgcGVlcl9sZWZ0XG4gICAgICogQHBhcmFtIHtydGMuUmVtb3RlUGVlcn0gcGVlciBUaGUgcGVlciB3aGljaCBsZWZ0XG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIEEgcGVlciBjaGFuZ2VkIGl0cyBzdGF0dXMuXG4gICAgICogQGV2ZW50IHBlZXJfc3RhdHVzX2NoYW5nZWRcbiAgICAgKiBAcGFyYW0ge3J0Yy5SZW1vdGVQZWVyfSBwZWVyIFRoZSBwZWVyIHdoaWNoIGNoYW5nZWQgaXRzIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0dXMgVGhlIG5ldyBzdGF0dXNcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHJvb20gd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHVuZGVybHlpbmcgc2lnbmFsaW5nIGltcGxlbWVudGF0aW9uIGFzIHByb3ZpZGVkIGluIGNvbnN0cnVjdG9yXG4gICAgICogQHByb3BlcnR5IHNpZ25hbGluZ1xuICAgICAqIEB0eXBlIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBsb2NhbCBwZWVyXG4gICAgICogQHByb3BlcnR5IGxvY2FsXG4gICAgICogQHR5cGUgcnRjLkxvY2FsUGVlclxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gUm9vbShzaWduYWxpbmcsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjaGFubmVsO1xuICAgICAgdGhpcy5zaWduYWxpbmcgPSBzaWduYWxpbmc7XG4gICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zICE9IG51bGwgPyBvcHRpb25zIDoge307XG4gICAgICBpZiAodHlwZW9mIHRoaXMuc2lnbmFsaW5nID09PSAnc3RyaW5nJyB8fCB0aGlzLnNpZ25hbGluZyBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgICAgICBjaGFubmVsID0gbmV3IFdlYlNvY2tldENoYW5uZWwodGhpcy5zaWduYWxpbmcpO1xuICAgICAgICB0aGlzLnNpZ25hbGluZyA9IG5ldyBNdWNTaWduYWxpbmcoY2hhbm5lbCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsID0gdGhpcy5vcHRpb25zLmxvY2FsIHx8IG5ldyBMb2NhbFBlZXIoKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLnNldFN0YXR1cyh0aGlzLmxvY2FsLl9zdGF0dXMpO1xuICAgICAgdGhpcy5sb2NhbC5vbignc3RhdHVzX2NoYW5nZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zaWduYWxpbmcuc2V0U3RhdHVzKF90aGlzLmxvY2FsLl9zdGF0dXMpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ3BlZXJfam9pbmVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzaWduYWxpbmdfcGVlcikge1xuICAgICAgICAgIHZhciBwYywgcGVlcjtcbiAgICAgICAgICBwYyA9IG5ldyBQZWVyQ29ubmVjdGlvbihzaWduYWxpbmdfcGVlci5maXJzdCwgX3RoaXMub3B0aW9ucyk7XG4gICAgICAgICAgcGVlciA9IF90aGlzLmNyZWF0ZVBlZXIocGMsIHNpZ25hbGluZ19wZWVyKTtcbiAgICAgICAgICBwZWVyLm9uKCdzdGF0dXNfY2hhbmdlZCcsIGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3BlZXJfc3RhdHVzX2NoYW5nZWQnLCBwZWVyLCBzdGF0dXMpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHBlZXIub24oJ2xlZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5wZWVyc1tzaWduYWxpbmdfcGVlci5pZF07XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgncGVlcl9sZWZ0JywgcGVlcik7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdID0gcGVlcjtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgIHJldHVybiBwZWVyLm9uKCdjbG9zZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWxldGUgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogSm9pbnMgdGhlIHJvb20uIEluaXRpYXRlcyBjb25uZWN0aW9uIHRvIHNpZ25hbGluZyBzZXJ2ZXIgaWYgbm90IGRvbmUgYmVmb3JlLlxuICAgICAqIEBtZXRob2Qgam9pblxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIHJvb20gd2FzIGpvaW5lZFxuICAgICAqL1xuXG4gICAgUm9vbS5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuam9pbl9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5qb2luX3AgPSB0aGlzLnNpZ25hbGluZy5jb25uZWN0KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5qb2luX3A7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTGVhdmVzIHRoZSByb29tIGFuZCBjbG9zZXMgYWxsIGVzdGFibGlzaGVkIHBlZXIgY29ubmVjdGlvbnNcbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLmxlYXZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xlYW5zIHVwIGFsbCByZXNvdXJjZXMgdXNlZCBieSB0aGUgcm9vbS5cbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcubGVhdmUoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgcmVtb3RlIHBlZXIuIE92ZXJ3cml0ZSB0byB1c2UgeW91ciBvd24gY2xhc3MgZm9yIHBlZXJzLlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQG1ldGhvZCBjcmVhdGVfcGVlclxuICAgICAqIEBwYXJhbSB7cnRjLlBlZXJDb25uZWN0aW9ufSBwYyBUaGUgUGVlckNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKiBAcGFyYW0ge3J0Yy5TaWduYWxpbmdQZWVyfSBzaWduYWxpbmdfcGVlciBUaGUgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKi9cblxuICAgIFJvb20ucHJvdG90eXBlLmNyZWF0ZVBlZXIgPSBmdW5jdGlvbihwYywgc2lnbmFsaW5nX3BlZXIpIHtcbiAgICAgIHJldHVybiBuZXcgUmVtb3RlUGVlcihwYywgc2lnbmFsaW5nX3BlZXIsIHRoaXMubG9jYWwsIHRoaXMub3B0aW9ucyk7XG4gICAgfTtcblxuICAgIHJldHVybiBSb29tO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBDYWxsaW5nLCBDYWxsaW5nSW5JbnZpdGF0aW9uLCBDYWxsaW5nSW52aXRhdGlvblJvb20sIENhbGxpbmdOYW1lc3BhY2UsIENhbGxpbmdOYW1lc3BhY2VSb29tLCBDYWxsaW5nTmFtZXNwYWNlUm9vbVBlZXIsIENhbGxpbmdOYW1lc3BhY2VVc2VyLCBDYWxsaW5nT3V0SW52aXRhdGlvbiwgQ2FsbGluZ1BlZXIsIENhbGxpbmdSb29tLCBDYWxsaW5nU2lnbmFsaW5nLCBDYWxsaW5nU2lnbmFsaW5nUGVlciwgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgUmVtb3RlUGVlciwgUm9vbSwgZXh0ZW5kLCByZWYsXG4gICAgZXh0ZW5kMSA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKSwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZDtcblxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKTtcblxuICBSb29tID0gcmVxdWlyZSgnLi4vcm9vbScpLlJvb207XG5cbiAgUmVtb3RlUGVlciA9IHJlcXVpcmUoJy4uL3JlbW90ZV9wZWVyJykuUmVtb3RlUGVlcjtcblxuICBDYWxsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmcsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZyhjaGFubmVsLCByb29tX29wdGlvbnMpIHtcbiAgICAgIHZhciBoZWxsb19kO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMucm9vbV9vcHRpb25zID0gcm9vbV9vcHRpb25zO1xuICAgICAgdGhpcy5uZXh0X3RpZCA9IDA7XG4gICAgICB0aGlzLmFuc3dlcnMgPSB7fTtcbiAgICAgIGhlbGxvX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuaGVsbG9fcCA9IGhlbGxvX2QucHJvbWlzZTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgdmFyIGFuc3dlciwgaW52aXRhdGlvbiwgcm9vbTtcbiAgICAgICAgICBfdGhpcy5yZXNldFBpbmcoKTtcbiAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdoZWxsbyc6XG4gICAgICAgICAgICAgIF90aGlzLmlkID0gbXNnLmlkO1xuICAgICAgICAgICAgICByZXR1cm4gaGVsbG9fZC5yZXNvbHZlKG1zZy5zZXJ2ZXIpO1xuICAgICAgICAgICAgY2FzZSAnYW5zd2VyJzpcbiAgICAgICAgICAgICAgaWYgKG1zZy50aWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdNaXNzaW5nIHRyYW5zYWN0aW9uIGlkIGluIGFuc3dlcicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhbnN3ZXIgPSBfdGhpcy5hbnN3ZXJzW21zZy50aWRdO1xuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMuYW5zd2Vyc1ttc2cudGlkXTtcbiAgICAgICAgICAgICAgaWYgKGFuc3dlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Fuc3dlciB3aXRob3V0IGV4cGVjdGluZyBpdCcpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoYW5zd2VyLnJlc29sdmUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChtc2cuZXJyb3IgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGFuc3dlci5yZWplY3QobmV3IEVycm9yKG1zZy5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYW5zd2VyLnJlc29sdmUobXNnLmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobXNnLmVycm9yICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBhbnN3ZXIobmV3IEVycm9yKG1zZy5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYW5zd2VyKHZvaWQgMCwgbXNnLmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2ludml0ZV9pbmNvbWluZyc6XG4gICAgICAgICAgICAgIGlmICgobXNnLmhhbmRsZSA9PSBudWxsKSB8fCAobXNnLnNlbmRlciA9PSBudWxsKSB8fCAhbXNnLnJvb20gfHwgKG1zZy5zdGF0dXMgPT0gbnVsbCkgfHwgKG1zZy5wZWVycyA9PSBudWxsKSB8fCAobXNnLmRhdGEgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkludmFsaWQgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW52aXRhdGlvbiA9IG5ldyBDYWxsaW5nSW5JbnZpdGF0aW9uKF90aGlzLCBtc2cuaGFuZGxlKTtcbiAgICAgICAgICAgICAgcm9vbSA9IG5ldyBDYWxsaW5nSW52aXRhdGlvblJvb20oaW52aXRhdGlvbiwgX3RoaXMucm9vbV9vcHRpb25zLCBtc2cuc2VuZGVyLCBtc2cuZGF0YSk7XG4gICAgICAgICAgICAgIHJvb20uc2lnbmFsaW5nLmluaXQobXNnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2ludml0YXRpb24nLCByb29tKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgaWYgKF90aGlzLnBpbmdfaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoX3RoaXMucGluZ19pbnRlcnZhbCk7XG4gICAgICAgICAgICByZXR1cm4gZGVsZXRlIF90aGlzLnBpbmdfaW50ZXJ2YWw7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIENhbGxpbmcucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuY29ubmVjdCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5yZXNldFBpbmcoKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuaGVsbG9fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucmVxdWVzdCA9IGZ1bmN0aW9uKG1zZywgY2IpIHtcbiAgICAgIHZhciBkZWZlcjtcbiAgICAgIG1zZy50aWQgPSB0aGlzLm5leHRfdGlkKys7XG4gICAgICB0aGlzLmNoYW5uZWwuc2VuZChtc2cpO1xuICAgICAgdGhpcy5yZXNldFBpbmcoKTtcbiAgICAgIGlmIChjYiAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuYW5zd2Vyc1ttc2cudGlkXSA9IGNiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgdGhpcy5hbnN3ZXJzW21zZy50aWRdID0gZGVmZXI7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDYWxsaW5nLnByb3RvdHlwZS5waW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHtcbiAgICAgICAgdHlwZTogJ3BpbmcnXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucmVzZXRQaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5waW5nX3RpbWVvdXQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucGluZ190aW1lb3V0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnBpbmdfdGltZW91dCA9IHNldFRpbWVvdXQoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5waW5nKCk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnJlc2V0UGluZygpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyksIDIgKiA2MCAqIDEwMDApO1xuICAgIH07XG5cbiAgICBDYWxsaW5nLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihuc2lkKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucmVxdWVzdCh7XG4gICAgICAgICAgICB0eXBlOiAnbnNfc3Vic2NyaWJlJyxcbiAgICAgICAgICAgIG5hbWVzcGFjZTogbnNpZFxuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIGlkLCBuYW1lc3BhY2UsIHJlZjEsIHJlZjIsIHJvb20sIHN0YXR1cztcbiAgICAgICAgICAgIGlmIChlcnIgIT0gbnVsbCkge1xuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuYW1lc3BhY2UgPSBuZXcgQ2FsbGluZ05hbWVzcGFjZShfdGhpcywgbnNpZCk7XG4gICAgICAgICAgICAgIHJlZjEgPSBkYXRhLnVzZXJzO1xuICAgICAgICAgICAgICBmb3IgKGlkIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSByZWYxW2lkXTtcbiAgICAgICAgICAgICAgICBuYW1lc3BhY2UuYWRkVXNlcihpZCwgc3RhdHVzKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZWYyID0gZGF0YS5yb29tcztcbiAgICAgICAgICAgICAgZm9yIChpZCBpbiByZWYyKSB7XG4gICAgICAgICAgICAgICAgcm9vbSA9IHJlZjJbaWRdO1xuICAgICAgICAgICAgICAgIG5hbWVzcGFjZS5hZGRSb29tKGlkLCByb29tLnN0YXR1cywgcm9vbS5wZWVycyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUobmFtZXNwYWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbihuYW1lc3BhY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAnbnNfdXNlcl9yZWdpc3RlcicsXG4gICAgICAgIG5hbWVzcGFjZTogbmFtZXNwYWNlXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUudW5yZWdpc3RlciA9IGZ1bmN0aW9uKG5hbWVzcGFjZSkge1xuICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICduc191c2VyX3VucmVnaXN0ZXInLFxuICAgICAgICBuYW1lc3BhY2U6IG5hbWVzcGFjZVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIENhbGxpbmcucHJvdG90eXBlLnJvb20gPSBmdW5jdGlvbihyb29tLCBvcHRpb25zKSB7XG4gICAgICB2YXIgc2lnbmFsaW5nO1xuICAgICAgc2lnbmFsaW5nID0gdGhpcy5yb29tX3NpZ25hbGluZyhyb29tKTtcbiAgICAgIHJldHVybiBuZXcgQ2FsbGluZ1Jvb20oc2lnbmFsaW5nLCBvcHRpb25zIHx8IHRoaXMucm9vbV9vcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZy5wcm90b3R5cGUucm9vbV9zaWduYWxpbmcgPSBmdW5jdGlvbihyb29tKSB7XG4gICAgICByZXR1cm4gbmV3IENhbGxpbmdTaWduYWxpbmcodGhpcywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdGF0dXMsIGNiKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ3Jvb21fam9pbicsXG4gICAgICAgICAgICByb29tOiByb29tLFxuICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgICAgICB9LCBjYik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIENhbGxpbmcucHJvdG90eXBlLnNldFN0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICdzdGF0dXMnLFxuICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIENhbGxpbmcucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmNsb3NlKCk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWxsaW5nO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbiAgQ2FsbGluZ05hbWVzcGFjZSA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nTmFtZXNwYWNlLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdOYW1lc3BhY2UoY2FsbGluZywgaWQxKSB7XG4gICAgICB2YXIgbWVzc2FnZV9oYW5kbGVyO1xuICAgICAgdGhpcy5jYWxsaW5nID0gY2FsbGluZztcbiAgICAgIHRoaXMuaWQgPSBpZDE7XG4gICAgICB0aGlzLnVzZXJzID0ge307XG4gICAgICB0aGlzLnJvb21zID0ge307XG4gICAgICBtZXNzYWdlX2hhbmRsZXIgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgIHZhciBwZWVyLCByb29tLCB1c2VyO1xuICAgICAgICAgIGlmIChtc2cubmFtZXNwYWNlICE9PSBfdGhpcy5pZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICduc191c2VyX2FkZCc6XG4gICAgICAgICAgICAgIGlmICgobXNnLnVzZXIgPT0gbnVsbCkgfHwgKG1zZy5zdGF0dXMgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5hZGRVc2VyKG1zZy51c2VyLCBtc2cuc3RhdHVzKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3VzZXJfdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cudXNlciA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdXNlciA9IF90aGlzLnVzZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdVbmtub3duIHVzZXIgaW4gc3RhdHVzIGNoYW5nZScpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB1c2VyLnN0YXR1cyA9IG1zZy5zdGF0dXM7XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3VzZXJfY2hhbmdlZCcsIHVzZXIpO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCd1c2VyX3N0YXR1c19jaGFuZ2VkJywgdXNlciwgdXNlci5zdGF0dXMpO1xuICAgICAgICAgICAgICByZXR1cm4gdXNlci5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHVzZXIuc3RhdHVzKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3VzZXJfcm0nOlxuICAgICAgICAgICAgICBpZiAobXNnLnVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdXNlciA9IF90aGlzLnVzZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdVbmtub3duIHVzZXIgbGVhdmluZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMudXNlcnNbbXNnLnVzZXJdO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCd1c2VyX2NoYW5nZWQnLCB1c2VyKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgndXNlcl9sZWZ0JywgdXNlcik7XG4gICAgICAgICAgICAgIHJldHVybiB1c2VyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3Jvb21fYWRkJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cucm9vbSA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSB8fCAobXNnLnBlZXJzID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgbWVzc2FnZScpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuYWRkUm9vbShtc2cucm9vbSwgbXNnLnN0YXR1cywgbXNnLnBlZXJzKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3Jvb21fdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cucm9vbSA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcm9vbSA9IF90aGlzLnJvb21zW21zZy5yb29tXTtcbiAgICAgICAgICAgICAgaWYgKHJvb20gPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIHJvb20nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcm9vbS5zdGF0dXMgPSBtc2cuc3RhdHVzO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX2NoYW5nZWQnLCByb29tKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9zdGF0dXNfY2hhbmdlZCcsIHJvb20sIHJvb20uc3RhdHVzKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJvb20uZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCByb29tLnN0YXR1cyk7XG4gICAgICAgICAgICBjYXNlICduc19yb29tX3JtJzpcbiAgICAgICAgICAgICAgaWYgKG1zZy5yb29tID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJvb20gPSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIGlmIChyb29tID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCByb29tJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3Jvb21fY2hhbmdlZCcsIHJvb20pO1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX2Nsb3NlZCcpO1xuICAgICAgICAgICAgICByZXR1cm4gcm9vbS5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgICAgIGNhc2UgJ25zX3Jvb21fcGVlcl9hZGQnOlxuICAgICAgICAgICAgICBpZiAoKG1zZy5yb29tID09IG51bGwpIHx8IChtc2cudXNlciA9PSBudWxsKSB8fCAobXNnLnN0YXR1cyA9PSBudWxsKSB8fCAobXNnLnBlbmRpbmcgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJvb20gPSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIGlmIChyb29tID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCByb29tJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSByb29tLmFkZFBlZXIobXNnLnVzZXIsIG1zZy5zdGF0dXMsIG1zZy5wZW5kaW5nKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9jaGFuZ2VkJywgcm9vbSk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdyb29tX3BlZXJfam9pbmVkJywgcm9vbSwgcGVlcik7XG4gICAgICAgICAgICBjYXNlICduc19yb29tX3BlZXJfdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cucm9vbSA9PSBudWxsKSB8fCAobXNnLnVzZXIgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXNzYWdlJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJvb20gPSBfdGhpcy5yb29tc1ttc2cucm9vbV07XG4gICAgICAgICAgICAgIHBlZXIgPSByb29tICE9IG51bGwgPyByb29tLnBlZXJzW21zZy51c2VyXSA6IHZvaWQgMDtcbiAgICAgICAgICAgICAgaWYgKHBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIHBlZXInKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG1zZy5zdGF0dXMgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHBlZXIuc3RhdHVzID0gbXNnLnN0YXR1cztcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX2NoYW5nZWQnLCByb29tKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdyb29tX3BlZXJfc3RhdHVzX2NoYW5nZWQnLCByb29tLCBwZWVyLCBwZWVyLnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgcGVlci5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHBlZXIuc3RhdHVzKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoKG1zZy5wZW5kaW5nICE9IG51bGwpICYmIG1zZy5wZW5kaW5nID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHBlZXIucGVuZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHBlZXIuYWNjZXB0ZWRfZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9jaGFuZ2VkJywgcm9vbSk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9hY2NlcHRlZCcsIHBlZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwZWVyLmVtaXQoJ2FjY2VwdGVkJyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICduc19yb29tX3BlZXJfcm0nOlxuICAgICAgICAgICAgICBpZiAoKG1zZy5yb29tID09IG51bGwpIHx8IChtc2cudXNlciA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIG1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcm9vbSA9IF90aGlzLnJvb21zW21zZy5yb29tXTtcbiAgICAgICAgICAgICAgcGVlciA9IHJvb20gIT0gbnVsbCA/IHJvb20ucGVlcnNbbXNnLnVzZXJdIDogdm9pZCAwO1xuICAgICAgICAgICAgICBpZiAocGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgcGVlcicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMucm9vbXNbbXNnLnJvb21dLnBlZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncm9vbV9jaGFuZ2VkJywgcm9vbSk7XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3Jvb21fcGVlcl9sZWZ0Jywgcm9vbSwgcGVlcik7XG4gICAgICAgICAgICAgIHJldHVybiBwZWVyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGluZy5jaGFubmVsLm9uKCdtZXNzYWdlJywgbWVzc2FnZV9oYW5kbGVyKTtcbiAgICAgIHRoaXMub24oJ3Vuc3Vic2NyaWJlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNhbGxpbmcuY2hhbm5lbC5yZW1vdmVMaXN0ZW5lcignbWVzc2FnZScsIG1lc3NhZ2VfaGFuZGxlcik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgQ2FsbGluZ05hbWVzcGFjZS5wcm90b3R5cGUuYWRkVXNlciA9IGZ1bmN0aW9uKGlkLCBzdGF0dXMpIHtcbiAgICAgIHZhciB1c2VyO1xuICAgICAgdXNlciA9IG5ldyBDYWxsaW5nTmFtZXNwYWNlVXNlcihpZCwgc3RhdHVzKTtcbiAgICAgIHRoaXMudXNlcnNbaWRdID0gdXNlcjtcbiAgICAgIHRoaXMuZW1pdCgndXNlcl9jaGFuZ2VkJywgdXNlcik7XG4gICAgICB0aGlzLmVtaXQoJ3VzZXJfcmVnaXN0ZXJlZCcsIHVzZXIpO1xuICAgICAgcmV0dXJuIHVzZXI7XG4gICAgfTtcblxuICAgIENhbGxpbmdOYW1lc3BhY2UucHJvdG90eXBlLmFkZFJvb20gPSBmdW5jdGlvbihpZCwgc3RhdHVzLCBwZWVycykge1xuICAgICAgdmFyIHBlZXIsIHBlZXJfaWQsIHJvb207XG4gICAgICByb29tID0gbmV3IENhbGxpbmdOYW1lc3BhY2VSb29tKGlkLCBzdGF0dXMpO1xuICAgICAgZm9yIChwZWVyX2lkIGluIHBlZXJzKSB7XG4gICAgICAgIHBlZXIgPSBwZWVyc1twZWVyX2lkXTtcbiAgICAgICAgcm9vbS5hZGRQZWVyKHBlZXJfaWQsIHBlZXIuc3RhdHVzLCBwZWVyLnBlbmRpbmcpO1xuICAgICAgfVxuICAgICAgdGhpcy5yb29tc1tpZF0gPSByb29tO1xuICAgICAgdGhpcy5lbWl0KCdyb29tX2NoYW5nZWQnLCByb29tKTtcbiAgICAgIHRoaXMuZW1pdCgncm9vbV9yZWdpc3RlcmVkJywgcm9vbSk7XG4gICAgICByZXR1cm4gcm9vbTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ05hbWVzcGFjZS5wcm90b3R5cGUudW5zdWJzY3JpYmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ25zX3Vuc3Vic2NyaWJlJyxcbiAgICAgICAgICAgIG5hbWVzcGFjZTogX3RoaXMuaWRcbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHZhciBfLCByZWYxLCB1c2VyO1xuICAgICAgICAgICAgaWYgKGVyciAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlZjEgPSBfdGhpcy51c2VycztcbiAgICAgICAgICAgICAgZm9yIChfIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICB1c2VyID0gcmVmMVtfXTtcbiAgICAgICAgICAgICAgICB1c2VyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy51c2VycyA9IHt9O1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCd1bnN1YnNjcmliZWQnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdOYW1lc3BhY2U7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nTmFtZXNwYWNlVXNlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nTmFtZXNwYWNlVXNlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBDYWxsaW5nTmFtZXNwYWNlVXNlcihpZDEsIHN0YXR1czEsIHBlbmRpbmcxKSB7XG4gICAgICB0aGlzLmlkID0gaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZW5kaW5nID0gcGVuZGluZzE7XG4gICAgfVxuXG4gICAgcmV0dXJuIENhbGxpbmdOYW1lc3BhY2VVc2VyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbiAgQ2FsbGluZ05hbWVzcGFjZVJvb20gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZDEoQ2FsbGluZ05hbWVzcGFjZVJvb20sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ05hbWVzcGFjZVJvb20oaWQxLCBzdGF0dXMxKSB7XG4gICAgICB0aGlzLmlkID0gaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgIH1cblxuICAgIENhbGxpbmdOYW1lc3BhY2VSb29tLnByb3RvdHlwZS5hZGRQZWVyID0gZnVuY3Rpb24oaWQsIHN0YXR1cywgcGVuZGluZykge1xuICAgICAgdmFyIHBlZXI7XG4gICAgICBwZWVyID0gbmV3IENhbGxpbmdOYW1lc3BhY2VSb29tUGVlcihpZCwgc3RhdHVzLCBwZW5kaW5nKTtcbiAgICAgIHRoaXMucGVlcnNbaWRdID0gcGVlcjtcbiAgICAgIHRoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgIHJldHVybiBwZWVyO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ05hbWVzcGFjZVJvb207XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nTmFtZXNwYWNlUm9vbVBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZDEoQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdOYW1lc3BhY2VSb29tUGVlcihpZDEsIHN0YXR1czEsIHBlbmRpbmcxKSB7XG4gICAgICB0aGlzLmlkID0gaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZW5kaW5nID0gcGVuZGluZzE7XG4gICAgICB0aGlzLmFjY2VwdGVkX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIGlmICghdGhpcy5wZW5kaW5nKSB7XG4gICAgICAgIHRoaXMuYWNjZXB0ZWRfZC5yZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLm9uKCdsZWZ0JywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuYWNjZXB0ZWRfZC5yZWplY3QoXCJQZWVyIGxlZnRcIik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyLnByb3RvdHlwZS5hY2NlcHRlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuYWNjZXB0ZWRfZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ05hbWVzcGFjZVJvb21QZWVyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbiAgQ2FsbGluZ1NpZ25hbGluZyA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdTaWduYWxpbmcoY2FsbGluZywgY29ubmVjdF9mdW4pIHtcbiAgICAgIHZhciBtZXNzYWdlX2hhbmRsZXI7XG4gICAgICB0aGlzLmNhbGxpbmcgPSBjYWxsaW5nO1xuICAgICAgdGhpcy5jb25uZWN0X2Z1biA9IGNvbm5lY3RfZnVuO1xuICAgICAgdGhpcy5wZWVyX3N0YXR1cyA9IHt9O1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgICAgbWVzc2FnZV9oYW5kbGVyID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICB2YXIgcGVlcjtcbiAgICAgICAgICBpZiAobXNnLnJvb20gIT09IF90aGlzLmlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ3Jvb21fdXBkYXRlJzpcbiAgICAgICAgICAgICAgaWYgKG1zZy5zdGF0dXMgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy5zdGF0dXMgPSBtc2cuc3RhdHVzO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCBfdGhpcy5zdGF0dXMpO1xuICAgICAgICAgICAgY2FzZSAncm9vbV9wZWVyX2FkZCc6XG4gICAgICAgICAgICAgIGlmICgobXNnLnVzZXIgPT0gbnVsbCkgfHwgKG1zZy5wZW5kaW5nID09IG51bGwpIHx8IChtc2cuc3RhdHVzID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJJbnZhbGlkIG1lc3NhZ2VcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5hZGRQZWVyKG1zZy51c2VyLCBtc2cuc3RhdHVzLCBtc2cucGVuZGluZywgdHJ1ZSk7XG4gICAgICAgICAgICBjYXNlICdyb29tX3BlZXJfcm0nOlxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZpbmcnKTtcbiAgICAgICAgICAgICAgaWYgKG1zZy51c2VyID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkludmFsaWQgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGVlciA9IF90aGlzLnBlZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVW5rbm93biBwZWVyIGFjY2VwdGVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMucGVlcnNbbXNnLnVzZXJdO1xuICAgICAgICAgICAgICBwZWVyLmFjY2VwdGVkX2QucmVqZWN0KFwiVXNlciBsZWZ0XCIpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZlZCcsIF90aGlzLnBlZXJzKTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9sZWZ0JywgcGVlcik7XG4gICAgICAgICAgICAgIHJldHVybiBwZWVyLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgIGNhc2UgJ3Jvb21fcGVlcl91cGRhdGUnOlxuICAgICAgICAgICAgICBpZiAobXNnLnVzZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwZWVyID0gX3RoaXMucGVlcnNbbXNnLnVzZXJdO1xuICAgICAgICAgICAgICBpZiAocGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJVbmtub3duIHBlZXIgYWNjZXB0ZWRcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChtc2cuc3RhdHVzICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwZWVyLnN0YXR1cyA9IG1zZy5zdGF0dXM7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9zdGF0dXNfY2hhbmdlZCcsIHBlZXIsIHBlZXIuc3RhdHVzKTtcbiAgICAgICAgICAgICAgICBwZWVyLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgcGVlci5zdGF0dXMpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICgobXNnLnBlbmRpbmcgIT0gbnVsbCkgJiYgbXNnLnBlbmRpbmcgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcGVlci5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcGVlci5hY2NlcHRlZF9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2FjY2VwdGVkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBlZXIuZW1pdCgnYWNjZXB0ZWQnKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3Jvb21fcGVlcl9mcm9tJzpcbiAgICAgICAgICAgICAgaWYgKChtc2cudXNlciA9PSBudWxsKSB8fCAobXNnLmV2ZW50ID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJJbnZhbGlkIG1lc3NhZ2VcIiwgbXNnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGVlciA9IF90aGlzLnBlZXJzW21zZy51c2VyXTtcbiAgICAgICAgICAgICAgaWYgKHBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVW5rbm93biBwZWVyIGFjY2VwdGVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2xlZnQnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHBlZXIuZW1pdChtc2cuZXZlbnQsIG1zZy5kYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGluZy5jaGFubmVsLm9uKCdtZXNzYWdlJywgbWVzc2FnZV9oYW5kbGVyKTtcbiAgICAgIHRoaXMub24oJ2xlZnQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCBtZXNzYWdlX2hhbmRsZXIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIENhbGxpbmdTaWduYWxpbmcucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgZW50cnksIHJlZjEsIHVzZXI7XG4gICAgICBpZiAodGhpcy5pbml0aWFsaXplZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSb29tIGlzIGFscmVhZHkgaW5pdGlhbGl6ZWRcIik7XG4gICAgICB9XG4gICAgICBpZiAoKGRhdGEucm9vbSA9PSBudWxsKSB8fCAoZGF0YS5wZWVycyA9PSBudWxsKSB8fCAoZGF0YS5zdGF0dXMgPT0gbnVsbCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW5pdGlhbGl6YXRpb24gZGF0YVwiKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaWQgPSBkYXRhLnJvb207XG4gICAgICB0aGlzLnN0YXR1cyA9IGRhdGEuc3RhdHVzO1xuICAgICAgcmVmMSA9IGRhdGEucGVlcnM7XG4gICAgICBmb3IgKHVzZXIgaW4gcmVmMSkge1xuICAgICAgICBlbnRyeSA9IHJlZjFbdXNlcl07XG4gICAgICAgIHRoaXMuYWRkUGVlcih1c2VyLCBlbnRyeS5zdGF0dXMsIGVudHJ5LnBlbmRpbmcsIGZhbHNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY29ubmVjdF9mdW4oX3RoaXMucGVlcl9zdGF0dXMsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIF90aGlzLmluaXQocmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFfdGhpcy5pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIk1pc3NpbmcgaW5mb3JtYXRpb24gZnJvbSBjb25uZWN0IHJlc3BvbnNlXCIpKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS5hZGRQZWVyID0gZnVuY3Rpb24oaWQsIHN0YXR1cywgcGVuZGluZywgZmlyc3QpIHtcbiAgICAgIHZhciBwZWVyO1xuICAgICAgcGVlciA9IG5ldyBDYWxsaW5nU2lnbmFsaW5nUGVlcih0aGlzLCBpZCwgc3RhdHVzLCBwZW5kaW5nLCBmaXJzdCk7XG4gICAgICB0aGlzLnBlZXJzW2lkXSA9IHBlZXI7XG4gICAgICB0aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICByZXR1cm4gcGVlcjtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZy5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ3Jvb21fbGVhdmUnLFxuICAgICAgICAgICAgcm9vbTogX3RoaXMuaWRcbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHZhciBfLCBwZWVyLCByZWYxO1xuICAgICAgICAgICAgX3RoaXMuZW1pdCgnbGVmdCcpO1xuICAgICAgICAgICAgcmVmMSA9IF90aGlzLnBlZXJzO1xuICAgICAgICAgICAgZm9yIChfIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgcGVlciA9IHJlZjFbX107XG4gICAgICAgICAgICAgIHBlZXIuZW1pdCgnbGVmdCcpO1xuICAgICAgICAgICAgICBwZWVyLmFjY2VwdGVkX2QucmVqZWN0KFwiWW91IGxlZnQgdGhlIHJvb21cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS5zZXRTdGF0dXMgPSBmdW5jdGlvbihzdGF0dXMpIHtcbiAgICAgIHRoaXMucGVlcl9zdGF0dXMgPSBzdGF0dXM7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgIHR5cGU6ICdyb29tX3BlZXJfc3RhdHVzJyxcbiAgICAgICAgICByb29tOiB0aGlzLmlkLFxuICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS5pbnZpdGUgPSBmdW5jdGlvbih1c2VyLCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ2ludml0ZV9zZW5kJyxcbiAgICAgICAgICAgIHJvb206IF90aGlzLmlkLFxuICAgICAgICAgICAgdXNlcjogdXNlci5pZCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICB9LCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgICAgdmFyIGludml0YXRpb247XG4gICAgICAgICAgICBpZiAoZXJyICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKHJlcy5oYW5kbGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJJbnZhbGlkIHJlc3BvbnNlXCIpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW52aXRhdGlvbiA9IG5ldyBDYWxsaW5nT3V0SW52aXRhdGlvbihfdGhpcy5jYWxsaW5nLCByZXMuaGFuZGxlLCB1c2VyKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoaW52aXRhdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIENhbGxpbmdTaWduYWxpbmcucHJvdG90eXBlLnNldFJvb21TdGF0dXNTYWZlID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdHlwZTogJ3Jvb21fc3RhdHVzJyxcbiAgICAgICAgICAgIHJvb206IF90aGlzLmlkLFxuICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICBjaGVjazogdHJ1ZSxcbiAgICAgICAgICAgIHByZXZpb3VzOiBwcmV2aW91c1xuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuc3RhdHVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgX3RoaXMuc3RhdHVzKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIENhbGxpbmdTaWduYWxpbmcucHJvdG90eXBlLnNldFJvb21TdGF0dXMgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuY2FsbGluZy5yZXF1ZXN0KHtcbiAgICAgICAgICAgIHR5cGU6ICdyb29tX3N0YXR1cycsXG4gICAgICAgICAgICByb29tOiBfdGhpcy5pZCxcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlXG4gICAgICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfdGhpcy5zdGF0dXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgX3RoaXMuZW1pdCgnc3RhdHVzX2NoYW5nZWQnLCBfdGhpcy5zdGF0dXMpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZy5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbihuYW1lc3BhY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGxpbmcucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICduc19yb29tX3JlZ2lzdGVyJyxcbiAgICAgICAgbmFtZXNwYWNlOiBuYW1lc3BhY2UsXG4gICAgICAgIHJvb206IHRoaXMuaWRcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nLnByb3RvdHlwZS51bnJlZ2lzdGVyID0gZnVuY3Rpb24obmFtZXNwYWNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAnbnNfcm9vbV91bnJlZ2lzdGVyJyxcbiAgICAgICAgbmFtZXNwYWNlOiBuYW1lc3BhY2UsXG4gICAgICAgIHJvb206IHRoaXMuaWRcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ1NpZ25hbGluZztcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG4gIENhbGxpbmdTaWduYWxpbmdQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmdTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdTaWduYWxpbmdQZWVyKHJvb20xLCBpZDEsIHN0YXR1czEsIHBlbmRpbmcxLCBmaXJzdDEpIHtcbiAgICAgIHRoaXMucm9vbSA9IHJvb20xO1xuICAgICAgdGhpcy5pZCA9IGlkMTtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMucGVuZGluZyA9IHBlbmRpbmcxO1xuICAgICAgdGhpcy5maXJzdCA9IGZpcnN0MTtcbiAgICAgIHRoaXMuYWNjZXB0ZWRfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgaWYgKCF0aGlzLnBlbmRpbmcpIHtcbiAgICAgICAgdGhpcy5hY2NlcHRlZF9kLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBDYWxsaW5nU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuYWNjZXB0ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmFjY2VwdGVkX2QucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1NpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vbS5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAncm9vbV9wZWVyX3RvJyxcbiAgICAgICAgcm9vbTogdGhpcy5yb29tLmlkLFxuICAgICAgICB1c2VyOiB0aGlzLmlkLFxuICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgIGRhdGE6IGRhdGFcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2FsbGluZ1NpZ25hbGluZ1BlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nSW5JbnZpdGF0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmdJbkludml0YXRpb24sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ0luSW52aXRhdGlvbihjYWxsaW5nLCBoYW5kbGUsIHNlbmRlciwgZGF0YTEpIHtcbiAgICAgIHZhciBtZXNzYWdlX2hhbmRsZXI7XG4gICAgICB0aGlzLmNhbGxpbmcgPSBjYWxsaW5nO1xuICAgICAgdGhpcy5oYW5kbGUgPSBoYW5kbGU7XG4gICAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcbiAgICAgIHRoaXMuZGF0YSA9IGRhdGExO1xuICAgICAgdGhpcy5jYW5jZWxsZWQgPSBmYWxzZTtcbiAgICAgIG1lc3NhZ2VfaGFuZGxlciA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgaWYgKG1zZy5oYW5kbGUgIT09IF90aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdpbnZpdGVfY2FuY2VsbGVkJzpcbiAgICAgICAgICAgICAgX3RoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgnY2FuY2VsbGVkJyk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdoYW5kbGVkJywgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jYWxsaW5nLmNoYW5uZWwub24oJ21lc3NhZ2UnLCBtZXNzYWdlX2hhbmRsZXIpO1xuICAgICAgdGhpcy5vbignaGFuZGxlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNhbGxpbmcuY2hhbm5lbC5yZW1vdmVMaXN0ZW5lcignbWVzc2FnZScsIG1lc3NhZ2VfaGFuZGxlcik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgQ2FsbGluZ0luSW52aXRhdGlvbi5wcm90b3R5cGUuc2lnbmFsaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IENhbGxpbmdTaWduYWxpbmcodGhpcy5jYWxsaW5nLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0YXR1cywgY2IpIHtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdoYW5kbGVkJywgdHJ1ZSk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNhbGxpbmcucmVxdWVzdCh7XG4gICAgICAgICAgICB0eXBlOiAnaW52aXRlX2FjY2VwdCcsXG4gICAgICAgICAgICBoYW5kbGU6IF90aGlzLmhhbmRsZSxcbiAgICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgICAgfSwgY2IpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBDYWxsaW5nSW5JbnZpdGF0aW9uLnByb3RvdHlwZS5kZW55ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmVtaXQoJ2hhbmRsZWQnLCBmYWxzZSk7XG4gICAgICByZXR1cm4gdGhpcy5jYWxsaW5nLnJlcXVlc3Qoe1xuICAgICAgICB0eXBlOiAnaW52aXRlX2RlbnknLFxuICAgICAgICBoYW5kbGU6IHRoaXMuaGFuZGxlXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdJbkludml0YXRpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuICBDYWxsaW5nT3V0SW52aXRhdGlvbiA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBDYWxsaW5nT3V0SW52aXRhdGlvbihjYWxsaW5nLCBoYW5kbGUsIHVzZXIxKSB7XG4gICAgICB2YXIgY2xlYW51cCwgbWVzc2FnZV9oYW5kbGVyO1xuICAgICAgdGhpcy5jYWxsaW5nID0gY2FsbGluZztcbiAgICAgIHRoaXMuaGFuZGxlID0gaGFuZGxlO1xuICAgICAgdGhpcy51c2VyID0gdXNlcjE7XG4gICAgICB0aGlzLmRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLnBlbmRpbmcgPSB0cnVlO1xuICAgICAgbWVzc2FnZV9oYW5kbGVyID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICBpZiAobXNnLmhhbmRsZSAhPT0gX3RoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2ludml0ZV9yZXNwb25zZSc6XG4gICAgICAgICAgICAgIGlmIChtc2cuYWNjZXB0ZWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBfdGhpcy5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5kZWZlci5yZXNvbHZlKG1zZy5hY2NlcHRlZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLmNhbGxpbmcuY2hhbm5lbC5vbignbWVzc2FnZScsIG1lc3NhZ2VfaGFuZGxlcik7XG4gICAgICBjbGVhbnVwID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuY2FsbGluZy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgbWVzc2FnZV9oYW5kbGVyKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5kZWZlci5wcm9taXNlLnRoZW4oY2xlYW51cCwgY2xlYW51cCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgQ2FsbGluZ091dEludml0YXRpb24ucHJvdG90eXBlLnJlc3BvbnNlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5kZWZlci5wcm9taXNlO1xuICAgIH07XG5cbiAgICBDYWxsaW5nT3V0SW52aXRhdGlvbi5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnBlbmRpbmcgPSBmYWxzZTtcbiAgICAgIHJldHVybiB0aGlzLmNhbGxpbmcucmVxdWVzdCh7XG4gICAgICAgIHR5cGU6ICdpbnZpdGVfY2FuY2VsJyxcbiAgICAgICAgaGFuZGxlOiB0aGlzLmhhbmRsZVxuICAgICAgfSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF90aGlzLmRlZmVyLnJlamVjdChuZXcgRXJyb3IoXCJJbnZpdGF0aW9uIGNhbmNlbGxlZFwiKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWxsaW5nT3V0SW52aXRhdGlvbjtcblxuICB9KSgpO1xuXG4gIENhbGxpbmdSb29tID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQxKENhbGxpbmdSb29tLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENhbGxpbmdSb29tKHNpZ25hbGluZywgb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IGV4dGVuZCh7XG4gICAgICAgIGF1dG9fY29ubmVjdDogZmFsc2VcbiAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgQ2FsbGluZ1Jvb20uX19zdXBlcl9fLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgc2lnbmFsaW5nLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBDYWxsaW5nUm9vbS5wcm90b3R5cGUuY3JlYXRlUGVlciA9IGZ1bmN0aW9uKHBjLCBzaWduYWxpbmcpIHtcbiAgICAgIHJldHVybiBuZXcgQ2FsbGluZ1BlZXIocGMsIHNpZ25hbGluZywgdGhpcy5sb2NhbCwgdGhpcy5vcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1Jvb20ucHJvdG90eXBlLmludml0ZSA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5pbnZpdGUodXNlcik7XG4gICAgfTtcblxuICAgIENhbGxpbmdSb29tLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uKG5zaWQpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5yZWdpc3Rlcihuc2lkKTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ1Jvb20ucHJvdG90eXBlLnVucmVnaXN0ZXIgPSBmdW5jdGlvbihuc2lkKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcudW5yZWdpc3Rlcihuc2lkKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdSb29tO1xuXG4gIH0pKFJvb20pO1xuXG4gIENhbGxpbmdJbnZpdGF0aW9uUm9vbSA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kMShDYWxsaW5nSW52aXRhdGlvblJvb20sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ0ludml0YXRpb25Sb29tKGludml0YXRpb24xLCBvcHRpb25zLCBzZW5kZXJfaWQsIGRhdGExKSB7XG4gICAgICB0aGlzLmludml0YXRpb24gPSBpbnZpdGF0aW9uMTtcbiAgICAgIHRoaXMuc2VuZGVyX2lkID0gc2VuZGVyX2lkO1xuICAgICAgdGhpcy5kYXRhID0gZGF0YTE7XG4gICAgICBDYWxsaW5nSW52aXRhdGlvblJvb20uX19zdXBlcl9fLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgdGhpcy5pbnZpdGF0aW9uLnNpZ25hbGluZygpLCBvcHRpb25zKTtcbiAgICAgIHRoaXMuaW52aXRhdGlvbi5vbignY2FuY2VsbGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2FuY2VsbGVkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmludml0YXRpb24ub24oJ2hhbmRsZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGFjY2VwdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2hhbmRsZWQnLCBhY2NlcHRlZCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgQ2FsbGluZ0ludml0YXRpb25Sb29tLnByb3RvdHlwZS5zZW5kZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnBlZXJzW3RoaXMuc2VuZGVyX2lkXTtcbiAgICB9O1xuXG4gICAgQ2FsbGluZ0ludml0YXRpb25Sb29tLnByb3RvdHlwZS5kZW55ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pbnZpdGF0aW9uLmRlbnkoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENhbGxpbmdJbnZpdGF0aW9uUm9vbTtcblxuICB9KShDYWxsaW5nUm9vbSk7XG5cbiAgQ2FsbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZDEoQ2FsbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2FsbGluZ1BlZXIocGMsIHNpZ25hbGluZywgbG9jYWwsIG9wdGlvbnMpIHtcbiAgICAgIENhbGxpbmdQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5jYWxsKHRoaXMsIHBjLCBzaWduYWxpbmcsIGxvY2FsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBDYWxsaW5nUGVlci5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS5sb2coJ2Nvbm5lY3RpbmcgLi4nKTtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5hY2NlcHRlZCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnYWNjZXB0ZWQgLi4nKTtcbiAgICAgICAgICByZXR1cm4gQ2FsbGluZ1BlZXIuX19zdXBlcl9fLmNvbm5lY3QuY2FsbChfdGhpcyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBDYWxsaW5nUGVlcjtcblxuICB9KShSZW1vdGVQZWVyKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBDYWxsaW5nOiBDYWxsaW5nLFxuICAgIENhbGxpbmdOYW1lc3BhY2U6IENhbGxpbmdOYW1lc3BhY2UsXG4gICAgQ2FsbGluZ05hbWVzcGFjZVVzZXI6IENhbGxpbmdOYW1lc3BhY2VVc2VyLFxuICAgIENhbGxpbmdOYW1lc3BhY2VSb29tOiBDYWxsaW5nTmFtZXNwYWNlUm9vbSxcbiAgICBDYWxsaW5nTmFtZXNwYWNlUm9vbVBlZXI6IENhbGxpbmdOYW1lc3BhY2VSb29tUGVlcixcbiAgICBDYWxsaW5nU2lnbmFsaW5nOiBDYWxsaW5nU2lnbmFsaW5nLFxuICAgIENhbGxpbmdTaWduYWxpbmdQZWVyOiBDYWxsaW5nU2lnbmFsaW5nUGVlcixcbiAgICBDYWxsaW5nSW5JbnZpdGF0aW9uOiBDYWxsaW5nSW5JbnZpdGF0aW9uLFxuICAgIENhbGxpbmdPdXRJbnZpdGF0aW9uOiBDYWxsaW5nT3V0SW52aXRhdGlvblxuICB9O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgU2lnbmFsaW5nLCBTaWduYWxpbmdQZWVyLCByZWYsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICByZWYgPSByZXF1aXJlKCcuL3NpZ25hbGluZycpLCBTaWduYWxpbmcgPSByZWYuU2lnbmFsaW5nLCBTaWduYWxpbmdQZWVyID0gcmVmLlNpZ25hbGluZ1BlZXI7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgcGVlciBmb3IgbXVsdGkgdXNlciBjaGF0cy5cbiAgI1xuICAgKiBGb3IgYSBkZXRhaWxlZCBkZXNjcmlwdGlvbiBvZiB0aGUgc2lnbmFsaW5nIHByb3RvY29sIHNlZSBgcnRjLnNpZ25hbGluZy5NdWNTaWduYWxpbmdgXG4gICNcbiAgICogQGV4dGVuZHMgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLk11Y1NpZ25hbGluZ1BlZXJcbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtydGMuc2lnbmFsaW5nLkNoYW5uZWx9IGNoYW5uZWwgVGhlIGNoYW5uZWwgdG8gdGhlIHNpZ2FubGluZyBzZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBlZXJfaWQgVGhlIGlkIG9mIHRoZSByZW1vdGUgcGVlclxuICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIFRoZSBzdGF0dXMgb2YgdGhlIHJlbW90ZSBwZWVyXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gZmlyc3QgV2hldGhlciB0aGUgbG9jYWwgcGVlciB3YXMgaW4gdGhlIHJvb20gYmVmb3JlIHRoZSByZW1vdGUgcGVlclxuICAgKi9cblxuICBleHBvcnRzLk11Y1NpZ25hbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChNdWNTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogVGhlIGlkIG9mIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBwcm9wZXJ0eSBpZFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gTXVjU2lnbmFsaW5nUGVlcihjaGFubmVsLCBpZCwgc3RhdHVzMSwgZmlyc3QpIHtcbiAgICAgIHZhciByZWN2X21zZztcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLmlkID0gaWQ7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1czE7XG4gICAgICB0aGlzLmZpcnN0ID0gZmlyc3Q7XG4gICAgICByZWN2X21zZyA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLnBlZXIgIT09IF90aGlzLmlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhLnR5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZnJvbSc6XG4gICAgICAgICAgICAgIGlmICgoZGF0YS5ldmVudCA9PSBudWxsKSB8fCAoZGF0YS5kYXRhID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX2xlZnQnOlxuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdsZWZ0Jyk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgICAgICAgY2FzZSAncGVlcl9zdGF0dXMnOlxuICAgICAgICAgICAgICBfdGhpcy5zdGF0dXMgPSBkYXRhLnN0YXR1cztcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgX3RoaXMuc3RhdHVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIHJlY3ZfbXNnKTtcbiAgICB9XG5cbiAgICBNdWNTaWduYWxpbmdQZWVyLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIGlmIChkYXRhID09IG51bGwpIHtcbiAgICAgICAgZGF0YSA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgdHlwZTogJ3RvJyxcbiAgICAgICAgcGVlcjogdGhpcy5pZCxcbiAgICAgICAgZXZlbnQ6IGV2ZW50LFxuICAgICAgICBkYXRhOiBkYXRhXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE11Y1NpZ25hbGluZ1BlZXI7XG5cbiAgfSkoU2lnbmFsaW5nUGVlcik7XG5cblxuICAvKipcbiAgICogU2lnbmFsaW5nIGZvciBtdWx0aSB1c2VyIGNoYXRzXG4gICNcbiAgICogVGhlIGZvbGxvd2luZyBtZXNzYWdlcyBhcmUgc2VudCB0byB0aGUgc2VydmVyOlxuICAjXG4gICAqICAgICAvLyBqb2luIHRoZSByb29tLiBoYXMgdG8gYmUgc2VudCBiZWZvcmUgYW55IG90aGVyIG1lc3NhZ2UuXG4gICAqICAgICAvLyByZXNwb25zZSB3aWxsIGJlICdqb2luZWQnIG9uIHN1Y2Nlc3NcbiAgICogICAgIC8vIG90aGVyIHBlZXJzIGluIHRoZSByb29tIHdpbGwgZ2V0ICdwZWVyX2pvaW5lZCdcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwiam9pblwiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIGxlYXZlIHRoZSByb29tLiBzZXJ2ZXIgd2lsbCBjbG9zZSB0aGUgY29ubmVjdGluby5cbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwibGVhdmVcIlxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyB1cGRhdGUgc3RhdHVzIG9iamVjdFxuICAgKiAgICAgLy8gb3RoZXIgcGVlcnMgd2lsbCBnZXQgJ3BlZXJfc3RhdHVzJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJzdGF0dXNcIixcbiAgICogICAgICAgXCJzdGF0dXNcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBzZW5kIG1lc3NhZ2UgdG8gYSBwZWVyLiB3aWxsIGJlIHJlY2VpdmVkIGFzICdmcm9tJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJ0b1wiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCIsXG4gICAqICAgICAgIFwiZXZlbnRcIjogXCJldmVudF9pZFwiLFxuICAgKiAgICAgICBcImRhdGFcIjogeyAuLiBjdXN0b20gZGF0YSAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogVGhlIGZvbGxvd2luZyBtZXNzYWdlcyBhcmUgcmVjZWl2ZWQgZm9ybSB0aGUgc2VydmVyOlxuICAjXG4gICAqICAgICAvLyBqb2luZWQgdGhlIHJvb20uIGlzIHRoZSByZXNwb25zZSB0byAnam9pbidcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwiam9pbmVkXCIsXG4gICAqICAgICAgIFwiaWRcIjogXCJvd25faWRcIixcbiAgICogICAgICAgXCJwZWVyc1wiOiB7XG4gICAqICAgICAgICAgXCJwZWVyX2lkXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgICAgfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBhbm90aGVyIHBlZXIgam9pbmVkIHRoZSByb29tLlxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJwZWVyX2pvaW5lZFwiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gYW5vc3RoZXIgcGVlciB1cGRhdGVkIGl0cyBzdGF0dXMgb2JqZWN0IHVzaW5nICdzdGF0dXMnXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInBlZXJfc3RhdHVzXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJzdGF0dXNcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBhbm90aGVyIHBlZXIgbGVmdCB0aGUgcm9vbVxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJwZWVyX2xlZnRcIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiXG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIG1lc3NhZ2UgZnJvbSBhbm90aGVyIHBlZXIgc2VudCBieSAndG8nXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcImZyb21cIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiLFxuICAgKiAgICAgICBcImV2ZW50XCI6IFwiZXZlbnRfaWRcIixcbiAgICogICAgICAgXCJkYXRhXCI6IHsgLi4gY3VzdG9tIGRhdGEgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqIFRoZSBtZXNzYWdlcyB0cmFuc21pdHRlZCBpbiB0aGUgYHRvYC9gZnJvbWAgbWVzc2FnZXMgYXJlIGVtaXR0ZWQgYXMgZXZlbnRzIGluIGBNdWNTaWduYWxpbmdQZWVyYFxuICAjXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLk11Y1NpZ25hbGluZ1xuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge3J0Yy5zaWduYWxpbmcuQ2hhbm5lbH0gY2hhbm5lbCBUaGUgY2hhbm5lbCB0byB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgKi9cblxuICBleHBvcnRzLk11Y1NpZ25hbGluZyA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKE11Y1NpZ25hbGluZywgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBpZCBvZiB0aGUgbG9jYWwgcGVlci4gT25seSBhdmFpbGFibGUgYWZ0ZXIgam9pbmluZy5cbiAgICAgKiBAcHJvcGVydHkgaWRcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIE11Y1NpZ25hbGluZyhjaGFubmVsKSB7XG4gICAgICB2YXIgam9pbl9kO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMuc3RhdHVzID0ge307XG4gICAgICBqb2luX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuam9pbl9wID0gam9pbl9kLnByb21pc2U7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgdmFyIHBlZXIsIHBlZXJfaWQsIHJlZjEsIHN0YXR1cztcbiAgICAgICAgICBpZiAoZGF0YS50eXBlID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3dpdGNoIChkYXRhLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2pvaW5lZCc6XG4gICAgICAgICAgICAgIGlmIChkYXRhLnBlZXJzID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVmMSA9IGRhdGEucGVlcnM7XG4gICAgICAgICAgICAgIGZvciAocGVlcl9pZCBpbiByZWYxKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzID0gcmVmMVtwZWVyX2lkXTtcbiAgICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuTXVjU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBwZWVyX2lkLCBzdGF0dXMsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF90aGlzLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgICAgcmV0dXJuIGpvaW5fZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX2pvaW5lZCc6XG4gICAgICAgICAgICAgIGlmIChkYXRhLnBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuTXVjU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBkYXRhLnBlZXIsIGRhdGEuc3RhdHVzLCB0cnVlKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSB0aGlzLmNoYW5uZWwuY29ubmVjdCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgICAgICAgIHR5cGU6ICdqb2luJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiBfdGhpcy5zdGF0dXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5qb2luX2Q7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBNdWNTaWduYWxpbmcucHJvdG90eXBlLnNldFN0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXM7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3ApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgICAgICAgIHR5cGU6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNdWNTaWduYWxpbmcucHJvdG90eXBlLmxlYXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICB0eXBlOiAnbGVhdmUnXG4gICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE11Y1NpZ25hbGluZztcblxuICB9KShTaWduYWxpbmcpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIFNpZ25hbGluZywgU2lnbmFsaW5nUGVlciwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9wcm9taXNlJykuRGVmZXJyZWQ7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9zaWduYWxpbmcnKSwgU2lnbmFsaW5nID0gcmVmLlNpZ25hbGluZywgU2lnbmFsaW5nUGVlciA9IHJlZi5TaWduYWxpbmdQZWVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgcGVlciBjb21wYXRpYmxlIHdpdGggdGhlIGZyYW1pbmcgb2YgcGFsYXZhIHNpZ25hbGluZ1xuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5QYWxhdmFTaWduYWxpbmdQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nUGVlclxuICAgKi9cblxuICBleHBvcnRzLlBhbGF2YVNpZ25hbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQYWxhdmFTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBhbGF2YVNpZ25hbGluZ1BlZXIoY2hhbm5lbCwgaWQsIHN0YXR1czEsIGZpcnN0KSB7XG4gICAgICB2YXIgcmVjdl9tc2c7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5pZCA9IGlkO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5maXJzdCA9IGZpcnN0O1xuICAgICAgcmVjdl9tc2cgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBpZiAoZGF0YS5zZW5kZXJfaWQgIT09IF90aGlzLmlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhLmV2ZW50ID09IG51bGwpIHtcbiAgICAgICAgICAgIF90aGlzLnNlbmQoJ2Vycm9yJywgXCJJbnZhbGlkIG1lc3NhZ2VcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIHJlY3ZfbXNnKTtcbiAgICAgIHRoaXMub24oJ3BlZXJfdXBkYXRlZF9zdGF0dXMnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHN0YXR1cyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLm9uKCdwZWVyX2xlZnQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIFBhbGF2YVNpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkYXRhID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICBldmVudDogJ3NlbmRfdG9fcGVlcicsXG4gICAgICAgIHBlZXJfaWQ6IHRoaXMuaWQsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBhbGF2YVNpZ25hbGluZ1BlZXI7XG5cbiAgfSkoU2lnbmFsaW5nUGVlcik7XG5cblxuICAvKipcbiAgICogU2lnbmFsaW5nIGltcGxlbWVudGF0aW9uIGNvbXBhdGlibGUgd2l0aCB0aGUgZnJhbWluZyBvZiBwYWxhdmEgc2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLlBhbGF2YVNpZ25hbGluZ1xuICAgKiBAZXh0ZW5kcyBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1xuICAgKi9cblxuICBleHBvcnRzLlBhbGF2YVNpZ25hbGluZyA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFBhbGF2YVNpZ25hbGluZywgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBQYWxhdmFTaWduYWxpbmcoY2hhbm5lbCwgcm9vbTEsIHN0YXR1czEpIHtcbiAgICAgIHZhciBqb2luX2Q7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5yb29tID0gcm9vbTE7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1czE7XG4gICAgICB0aGlzLnBlZXJzID0ge307XG4gICAgICB0aGlzLmpvaW5lZCA9IGZhbHNlO1xuICAgICAgam9pbl9kID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLmpvaW5fcCA9IGpvaW5fZC5wcm9taXNlO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdjbG9zZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIHZhciBpLCBwZWVyLCByZWYxO1xuICAgICAgICAgIGlmIChkYXRhLmV2ZW50ID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3dpdGNoIChkYXRhLmV2ZW50KSB7XG4gICAgICAgICAgICBjYXNlICdqb2luZWRfcm9vbSc6XG4gICAgICAgICAgICAgIGlmICgoZGF0YS5wZWVycyA9PSBudWxsKSB8fCAoZGF0YS5vd25faWQgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVmMSA9IGRhdGEucGVlcnM7XG4gICAgICAgICAgICAgIGZvciAoaSBpbiByZWYxKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHJlZjFbaV07XG4gICAgICAgICAgICAgICAgcGVlciA9IG5ldyBleHBvcnRzLlBhbGF2YVNpZ25hbGluZ1BlZXIoX3RoaXMuY2hhbm5lbCwgZGF0YS5wZWVyX2lkLCBkYXRhLnN0YXR1cywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIF90aGlzLnBlZXJzW2RhdGEucGVlcl9pZF0gPSBwZWVyO1xuICAgICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGpvaW5fZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICBjYXNlICduZXdfcGVlcic6XG4gICAgICAgICAgICAgIGlmIChkYXRhLnBlZXJfaWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBkYXRhLnBlZXJfaWQsIGRhdGEuc3RhdHVzLCB0cnVlKTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcnNbZGF0YS5wZWVyXSA9IHBlZXI7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9XG5cbiAgICBQYWxhdmFTaWduYWxpbmcucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdF9wID0gdGhpcy5jaGFubmVsLmNvbm5lY3QoKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICAgICAgICBldmVudDogJ2pvaW5fcm9vbScsXG4gICAgICAgICAgICAgIHJvb21faWQ6IHJvb20sXG4gICAgICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3A7XG4gICAgfTtcblxuICAgIFBhbGF2YVNpZ25hbGluZy5wcm90b3R5cGUuc2V0X3N0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgZXZlbnQ6ICd1cGRhdGVfc3RhdHVzJyxcbiAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBQYWxhdmFTaWduYWxpbmcucHJvdG90eXBlLmxlYXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmNsb3NlKCk7XG4gICAgfTtcblxuICAgIHJldHVybiBQYWxhdmFTaWduYWxpbmc7XG5cbiAgfSkoU2lnbmFsaW5nKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlcixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICovXG5cblxuICAvKipcbiAgICogQ29uY2VwdCBvZiBhIGNsYXNzIGltcGxlbWVudGluZyBzaWduYWxpbmcuIE1pZ2h0IHVzZSBhIGBydGMuc2lnbmFsaW5nLkNoYW5uZWxgIHRvIGFic3RyYWN0IHRoZSBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIuXG4gICNcbiAgICogWW91IGRvIG5vdCBoYXZlIHRvIGV4dGVuZCB0aGlzIGNsYWFzcywganVzdCBpbXBsZW1lbnQgdGhlIGZ1bmN0aW9uYWxpdHkuXG4gICNcbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdcbiAgICovXG5cbiAgZXhwb3J0cy5TaWduYWxpbmcgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChTaWduYWxpbmcsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gU2lnbmFsaW5nKCkge1xuICAgICAgcmV0dXJuIFNpZ25hbGluZy5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IHBlZXIgam9pbmVkIHRoZSByb29tXG4gICAgICogQGV2ZW50IHBlZXJfam9pbmVkXG4gICAgICogQHBhcmFtIHtydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1BlZXJ9IHBlZXIgVGhlIG5ldyBwZWVyXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb25uZWN0aW9uIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIEVzdGFibGlzaGVzIHRoZSBjb25uZWN0aW9uIHdpdGggdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gdGhlIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWRcbiAgICAgKi9cblxuICAgIFNpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiB0byB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIFNpZ25hbGluZy5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBsb2NhbCBzdGF0dXMgb2JqZWN0IGFuZCBicm9hZGNhc3RzIHRoZSBjaGFuZ2UgdG8gdGhlIHBlZXJzXG4gICAgICogQG1ldGhvZCBzZXRTdGF0dXNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIE5ldyBzdGF0dXMgb2JqZWN0XG4gICAgICovXG5cbiAgICBTaWduYWxpbmcucHJvdG90eXBlLnNldFN0YXR1cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2lnbmFsaW5nO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cblxuICAvKipcbiAgICogQ29uY2VwdCBvZiBhIGNsYXNzIGltcGxlbWVudGluZyBhIHNpZ25hbGluZyBjb25uZWN0aW9uIHRvIGEgcGVlci5cbiAgI1xuICAgKiBZb3UgZG8gbm90IGhhdmUgdG8gZXh0ZW5kIHRoaXMgY2xhc3MsIGp1c3QgaW1wbGVtZW50IHRoZSBmdW5jdGlvbmFsaXR5LlxuICAjXG4gICAqIEBleHRlbmRzIGV2ZW50cy5FdmVudEVtaXR0ZXJcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nUGVlclxuICAgKi9cblxuICBleHBvcnRzLlNpZ25hbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFNpZ25hbGluZ1BlZXIoKSB7XG4gICAgICByZXR1cm4gU2lnbmFsaW5nUGVlci5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW1vdGUgcGVlciBsZWZ0IHRoZSByb29tXG4gICAgICogQGV2ZW50IGxlZnRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogUmVjZWl2ZWQgYSBtZXNzYWdlIGZyb20gdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQGV2ZW50IG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgSUQgb2YgdGhlIGV2ZW50XG4gICAgICogQHBhcmFtIHtPYmVqY3R9IGRhdGEgUGF5bG9hZCBvZiB0aGUgZXZlbnRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXR1cyBvYmplY3Qgb2YgdGhlIHJlbW90ZSBwZWVyIHdhcyB1cGRhdGVkXG4gICAgICogQGV2ZW50IHN0YXR1c19jaGFuZ2VkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHN0YXR1cyBUaGUgbmV3IHN0YXR1c1xuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9iamVjdCBvZiB0aGUgcmVtb3RlIHBlZXJcbiAgICAgKiBAcHJvcGVydHkgc3RhdHVzXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGxvY2FsIHVzZXIgd2FzIGluIHRoZSByb29tIGJlZm9yZSB0aGUgcmVtb3RlIHVzZXIgKHVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIHBlZXIgd2lsbCBpbml0aWF0ZSB0aGUgY29ubmVjdGlvbilcbiAgICAgKiBAcHJvcGVydHkgZmlyc3RcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFNlbmRzIHRoZSBldmVudCB3aXRoIHRoZSBnaXZlbiBwYXlsb2FkIHRvIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2Qgc2VuZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBUaGUgaWQgb2YgdGhlIGV2ZW50XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIHBheWxvYWQgb2YgdGhlIGV2ZW50XG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIG1lc3NhZ2UgaXMgc2VudFxuICAgICAqL1xuXG4gICAgU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFNpZ25hbGluZ1BlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuXG4gIC8qKlxuICAgKiBDb25jZXB0IG9mIGEgY2xhc3MgaW1wbGVtZW50aW5nIGEgc2lnbmFsaW5nIGNoYW5uZWwuIE1pZ2h0IGJlIHVzZWQgYnkgc2lnbmFsaW5nIGltcGxlbWVudGF0aW9ucyB0byBjb25uZWN0IHRvIGEgc2lnbmFsaW5nIHNlcnZlci5cbiAgI1xuICAgKiBZb3UgZG8gbm90IGhhdmUgdG8gZXh0ZW5kIHRoaXMgY2xhc3MsIGp1c3QgaW1wbGVtZW50IHRoZSBmdW5jdGlvbmFsaXR5LlxuICAjXG4gICAqIEBleHRlbmRzIGV2ZW50cy5FdmVudEVtaXR0ZXJcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuQ2hhbm5lbFxuICAgKi9cblxuICBleHBvcnRzLkNoYW5uZWwgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChDaGFubmVsLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIENoYW5uZWwoKSB7XG4gICAgICByZXR1cm4gQ2hhbm5lbC5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEEgbWVzc2FnZSB3YXMgcmVjZWl2ZWQgZnJvbSB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBldmVudCBtZXNzYWdlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG1zZyBUaGUgcmVjZWl2ZWQgbWVzc2FnZVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29ubmVjdGlvbiB0byB0aGUgc2lnbmFsaW5nIHNlcnZlciB3YXMgY2xvc2VkXG4gICAgICogQGV2ZW50IGNsb3NlZFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBFc3RhYmxpc2hlcyB0aGUgY29ubmVjdGlvbiB3aXRoIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQG1ldGhvZCBjb25uZWN0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBDaGFubmVsLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2VuZHMgYSBtZXNzYWdlIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQG1ldGhvZCBzZW5kXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG1zZyBUaGUgbWVzc2FnZSB0byBzZW5kXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBtZXNzYWdlIGlzIHNlbnRcbiAgICAgKi9cblxuICAgIENoYW5uZWwucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIGNsb3NlXG4gICAgICovXG5cbiAgICBDaGFubmVsLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2hhbm5lbDtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQ2hhbm5lbCwgUHJvbWlzZSxcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5LFxuICAgIHNsaWNlID0gW10uc2xpY2U7XG5cbiAgUHJvbWlzZSA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKS5Qcm9taXNlO1xuXG4gIENoYW5uZWwgPSByZXF1aXJlKCcuL3NpZ25hbGluZycpLkNoYW5uZWw7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLldlYlNvY2tldENoYW5uZWxcbiAgICogQGV4dGVuZHMgcnRjLnNpZ25hbGluZy5DaGFubmVsXG4gICAqL1xuXG4gIGV4cG9ydHMuV2ViU29ja2V0Q2hhbm5lbCA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFdlYlNvY2tldENoYW5uZWwsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gV2ViU29ja2V0Q2hhbm5lbCgpIHtcbiAgICAgIHZhciBhZGRyZXNzLCBpLCBsZW4sIHBhcnQsIHBhcnRzO1xuICAgICAgYWRkcmVzcyA9IGFyZ3VtZW50c1swXSwgcGFydHMgPSAyIDw9IGFyZ3VtZW50cy5sZW5ndGggPyBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkgOiBbXTtcbiAgICAgIHRoaXMuYWRkcmVzcyA9IGFkZHJlc3M7XG4gICAgICBpZiAocGFydHMubGVuZ3RoID4gMCkge1xuICAgICAgICB3aGlsZSAodGhpcy5hZGRyZXNzLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgICAgICB0aGlzLmFkZHJlc3MgPSB0aGlzLmFkZHJlc3Muc3Vic3RyKDAsIHRoaXMuYWRkcmVzcy5sZW5ndGggLSAxKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBwYXJ0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgIHBhcnQgPSBwYXJ0c1tpXTtcbiAgICAgICAgICB0aGlzLmFkZHJlc3MgKz0gJy8nICsgZW5jb2RlVXJpQ29tcG9uZW50KHBhcnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgV2ViU29ja2V0Q2hhbm5lbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICB2YXIgc29ja2V0O1xuICAgICAgICAgICAgc29ja2V0ID0gbmV3IFdlYlNvY2tldChfdGhpcy5hZGRyZXNzKTtcbiAgICAgICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgX3RoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5zb2NrZXQ7XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoXCJVbmFibGUgdG8gY29ubmVjdCB0byBzb2NrZXRcIikpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgICB2YXIgZGF0YTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgnZXJyb3InLCBcIlVuYWJsZSB0byBwYXJzZSBpbmNvbWluZyBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG4gICAgV2ViU29ja2V0Q2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgdmFyIGVycjtcbiAgICAgIGlmICh0aGlzLnNvY2tldCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgICAgIGVyciA9IF9lcnJvcjtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIlRyeWluZyB0byBzZW5kIG9uIFdlYlNvY2tldCB3aXRob3V0IGJlaW5nIGNvbm5lY3RlZFwiKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFdlYlNvY2tldENoYW5uZWwucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZXJyO1xuICAgICAgaWYgKHRoaXMuc29ja2V0ICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgZXJyID0gX2Vycm9yO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiVHJ5aW5nIHRvIGNsb3NlIFdlYlNvY2tldCB3aXRob3V0IGJlaW5nIGNvbm5lY3RlZFwiKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBXZWJTb2NrZXRDaGFubmVsO1xuXG4gIH0pKENoYW5uZWwpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgY29tcGF0O1xuXG4gIGNvbXBhdCA9IHJlcXVpcmUoJy4vY29tcGF0JykuY29tcGF0O1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBhcm91bmQgYW4gSFRNTDUgTWVkaWFTdHJlYW1cbiAgICogQGNsYXNzIHJ0Yy5TdHJlYW1cbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtSVENEYXRhU3RyZWFtfSBzdHJlYW0gVGhlIG5hdGl2ZSBzdHJlYW1cbiAgICovXG5cbiAgZXhwb3J0cy5TdHJlYW0gPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gU3RyZWFtKHN0cmVhbTEpIHtcbiAgICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtMTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgaWQgb2YgdGhlIHN0cmVhbS4gVGhpcyBpcyBuZWl0aGVyIHVzZXIgZGVmaW5lZCBub3IgaHVtYW4gcmVhZGFibGUuXG4gICAgICogQG1ldGhvZCBpZFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gVGhlIGlkIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbVxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5pZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtLmlkO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIHRoZSBzdHJlYW0gaGFzIGFueSB0cmFja3Mgb2YgdGhlIGdpdmVuIHR5cGVcbiAgICAgKiBAbWV0aG9kIGhhc1RyYWNrc1xuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdib3RoJ10gVGhlIHR5cGUgb2YgdHJhY2sgdG8gY2hlY2sgZm9yXG4gICAgICogQHJldHVybiB7TnVtYmVyfSBUaGUgYW1vdW50IG9mIHRyYWNrcyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5oYXNUcmFja3MgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRUcmFja3ModHlwZSkubGVuZ3RoO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHRyYWNrcyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICAgICAqIEBtZXRob2QgZ2V0VHJhY2tzXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2JvdGgnXSBUaGUgdHlwZSBvZiB0cmFja3MgdG8gZ2V0XG4gICAgICogQHJldHVybiB7QXJyYXl9IEFuIEFycmF5IG9mIHRoZSB0cmFja3NcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUuZ2V0VHJhY2tzID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmVhbS5nZXRBdWRpb1RyYWNrcygpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3ZpZGVvJykge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJlYW1fcC50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgIHJldHVybiBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdib3RoJykge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJlYW1fcC50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgIHZhciB2YXVkaW8sIHZpZGVvO1xuICAgICAgICAgIHZpZGVvID0gc3RyZWFtLmdldFZpZGVvVHJhY2tzKCk7XG4gICAgICAgICAgdmF1ZGlvID0gc3RyZWFtLmdldEF1ZGlvVHJhY2tzKCk7XG4gICAgICAgICAgcmV0dXJuIHZpZGVvLmNvbmNhdChhdWRpbyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzdHJlYW0gcGFydCAnXCIgKyB0eXBlICsgXCInXCIpO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE11dGVzIG9yIHVubXV0ZXMgdHJhY2tzIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIG11dGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFttdXRlZD10cnVlXSBNdXRlIG9uIGB0cnVlYCBhbmQgdW5tdXRlIG9uIGBmYWxzZWBcbiAgICAgKiBAcGFyYW0geydhdWRpbycgfCAndmlkZW8nIHwgJ2JvdGgnfSBbdHlwZT0nYXVkaW8nXSBUaGUgdHlwZSBvZiB0cmFja3MgdG8gbXV0ZSBvciB1bm11dGVcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBXaGV0aGVyIHRoZSB0cmFja3Mgd2VyZSBtdXRlZCBvciB1bm11dGVkXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLm11dGUgPSBmdW5jdGlvbihtdXRlZCwgdHlwZSkge1xuICAgICAgdmFyIGksIGxlbiwgcmVmLCB0cmFjaztcbiAgICAgIGlmIChtdXRlZCA9PSBudWxsKSB7XG4gICAgICAgIG11dGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgICAgdHlwZSA9ICdhdWRpbyc7XG4gICAgICB9XG4gICAgICByZWYgPSBnZXRUcmFja3ModHlwZSk7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByZWYubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdHJhY2sgPSByZWZbaV07XG4gICAgICAgIHRyYWNrLmVuYWJsZWQgPSAhbXV0ZWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gbXV0ZWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyB0aGUgbXV0ZSBzdGF0ZSBvZiB0cmFja3Mgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2QgdG9nZ2xlTXV0ZVxuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdhdWRpbyddIFRoZSB0eXBlIG9mIHRyYWNrcyB0byBtdXRlIG9yIHVubXV0ZVxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHRyYWNrcyB3ZXJlIG11dGVkIG9yIHVubXV0ZWRcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUudG9nZ2xlTXV0ZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgIHZhciBpLCBsZW4sIG11dGVkLCByZWYsIHRyYWNrLCB0cmFja3M7XG4gICAgICBpZiAodHlwZSA9PSBudWxsKSB7XG4gICAgICAgIHR5cGUgPSAnYXVkaW8nO1xuICAgICAgfVxuICAgICAgdHJhY2tzID0gZ2V0VHJhY2tzKHR5cGUpO1xuICAgICAgbXV0ZWQgPSAhKChyZWYgPSB0cmFja3NbMF0pICE9IG51bGwgPyByZWYuZW5hYmxlZCA6IHZvaWQgMCk7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSB0cmFja3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdHJhY2sgPSB0cmFja3NbaV07XG4gICAgICAgIHRyYWNrLmVuYWJsZWQgPSAhbXV0ZWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gbXV0ZWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2Qgc3RvcFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgbGVuLCByZWYsIHJlc3VsdHMsIHRyYWNrO1xuICAgICAgaWYgKHRoaXMuc3RyZWFtLmdldFRyYWNrcyAhPSBudWxsKSB7XG4gICAgICAgIHJlZiA9IHRoaXMuc3RyZWFtLmdldFRyYWNrcygpO1xuICAgICAgICByZXN1bHRzID0gW107XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgIHRyYWNrID0gcmVmW2ldO1xuICAgICAgICAgIHJlc3VsdHMucHVzaCh0cmFjay5zdG9wKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtLnN0b3AoKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc3RyZWFtIHVzaW5nIGBnZXRVc2VyTWVkaWEoKWBcbiAgICAgKiBAbWV0aG9kIGNyZWF0ZVN0cmVhbVxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbmZpZz17YXVkaW86IHRydWUsIHZpZGVvOiB0cnVlfV0gVGhlIGNvbmZpZ3VyYXRpb24gdG8gcGFzcyB0byBgZ2V0VXNlck1lZGlhKClgXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIHRvIHRoZSBzdHJlYW1cbiAgICAjXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAgICAgdmFyIHN0cmVhbSA9IHJ0Yy5TdHJlYW0uY3JlYXRlU3RyZWFtKHthdWRpbzogdHJ1ZSwgdmlkZW86IGZhbHNlfSk7XG4gICAgICogICAgIHJ0Yy5NZWRpYURvbUVsZW1lbnQoJCgndmlkZW8nKSwgc3RyZWFtKTtcbiAgICAgKi9cblxuICAgIFN0cmVhbS5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgIGlmIChjb25maWcgPT0gbnVsbCkge1xuICAgICAgICBjb25maWcgPSB7XG4gICAgICAgICAgYXVkaW86IHRydWUsXG4gICAgICAgICAgdmlkZW86IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHN1Y2Nlc3M7XG4gICAgICAgIHN1Y2Nlc3MgPSBmdW5jdGlvbihuYXRpdmVfc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUobmV3IFN0cmVhbShuYXRpdmVfc3RyZWFtKSk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBjb21wYXQuZ2V0VXNlck1lZGlhKGNvbmZpZywgc3VjY2VzcywgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gU3RyZWFtO1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBQZWVyLCBTdHJlYW07XG5cbiAgU3RyZWFtID0gcmVxdWlyZSgnLi9zdHJlYW0nKS5TdHJlYW07XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQGNsYXNzIHJ0Yy5NZWRpYURvbUVsZW1lbnRcbiAgICovXG5cbiAgZXhwb3J0cy5NZWRpYURvbUVsZW1lbnQgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gTWVkaWFEb21FbGVtZW50KGRvbSwgZGF0YSkge1xuICAgICAgdGhpcy5kb20gPSBkb207XG4gICAgICBpZiAodGhpcy5kb20uanF1ZXJ5ICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5kb20gPSB0aGlzLmRvbVswXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYXR0YWNoKGRhdGEpO1xuICAgIH1cblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkZWxldGUgdGhpcy5zdHJlYW07XG4gICAgICAgIHRoaXMuZG9tLnBhdXNlKCk7XG4gICAgICAgIHJldHVybiB0aGlzLmRvbS5zcmMgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgU3RyZWFtKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtID0gZGF0YTtcbiAgICAgICAgaWYgKHR5cGVvZiBtb3pHZXRVc2VyTWVkaWEgIT09IFwidW5kZWZpbmVkXCIgJiYgbW96R2V0VXNlck1lZGlhICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5kb20ubW96U3JjT2JqZWN0ID0gZGF0YS5zdHJlYW07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kb20uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChkYXRhLnN0cmVhbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZG9tLnBsYXkoKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YSBpbnN0YW5jZW9mIFBlZXIpIHtcbiAgICAgICAgaWYgKGRhdGEuaXNMb2NhbCgpKSB7XG4gICAgICAgICAgdGhpcy5tdXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoKGRhdGEuc3RyZWFtKCkpO1xuICAgICAgfSBlbHNlIGlmICgoZGF0YSAhPSBudWxsID8gZGF0YS50aGVuIDogdm9pZCAwKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkYXRhLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmF0dGFjaChyZXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKVtcImNhdGNoXCJdKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5lcnJvcihlcnIpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yKFwiVHJpZWQgdG8gYXR0YWNoIGludmFsaWQgZGF0YVwiKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5lcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGVycik7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmF0dGFjaCgpO1xuICAgIH07XG5cbiAgICBNZWRpYURvbUVsZW1lbnQucHJvdG90eXBlLm11dGUgPSBmdW5jdGlvbihtdXRlZCkge1xuICAgICAgaWYgKG11dGVkID09IG51bGwpIHtcbiAgICAgICAgbXV0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZG9tLm11dGVkID0gbXV0ZWQ7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUudG9nZ2xlTXV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZG9tLm11dGVkID0gIXRoaXMuZG9tLm11dGVkO1xuICAgIH07XG5cbiAgICByZXR1cm4gTWVkaWFEb21FbGVtZW50O1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iXX0=
