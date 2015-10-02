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

},{}],5:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter, Promise, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  ref = require('./internal/promise'), Deferred = ref.Deferred, Promise = ref.Promise;

  EventEmitter = require('events').EventEmitter;


  /**
   * A wrapper for RTCDataChannel. Used to transfer custom data between peers.
   * @module rtc
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

},{"./internal/promise":7,"events":1}],6:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter, Promise, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  ref = require('./promise'), Deferred = ref.Deferred, Promise = ref.Promise;

  EventEmitter = require('events').EventEmitter;


  /**
   * Helper which handles DataChannel negotiation for RemotePeer
   * @module rtc.internal
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

},{"./promise":7,"events":1}],7:[function(require,module,exports){
(function (global){
// Generated by CoffeeScript 1.9.2

/**
 * Alias for native promises or a polyfill if not supported
 * @module rtc.internal
 * @class rtc.internal.Promise
 */

(function() {
  exports.Promise = global.Promise || require('es6-promise').Promise;


  /**
   * Helper to implement deferred execution with promises
   * @module rtc.internal
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

}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"es6-promise":3}],8:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('./promise').Deferred;

  EventEmitter = require('events').EventEmitter;


  /**
   * Helper handling the mapping of streams for RemotePeer
   * @module rtc.internal
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

},{"./promise":7,"events":1}],9:[function(require,module,exports){
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

}).call(this);

},{"./compat":4,"./internal/channel_collection":6,"./internal/promise":7,"./internal/stream_collection":8,"./local_peer":10,"./peer":11,"./peer_connection":12,"./remote_peer":13,"./room":14,"./signaling/palava_signaling":16,"./signaling/web_socket_channel":17,"./stream":18,"./video_element":19}],10:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Peer, Stream,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Peer = require('./peer').Peer;

  Stream = require('./stream').Stream;


  /**
   * Represents the local user of the room
   * @module rtc
   * @class rtc.LocalPeer
   * @extends rtc.Peer
  #
   * @constructor
   */

  exports.LocalPeer = (function(superClass) {
    extend(LocalPeer, superClass);

    function LocalPeer() {

      /**
       * Contains local streams offered to all remote peers
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
     * @param {Object} [desc] Options passed to `RTCDataChannel.createDataChannel()`
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
     */

    LocalPeer.prototype.stream = function(name) {
      if (name == null) {
        name = this.DEFAULT_STREAM;
      }
      return this.streams[name];
    };

    return LocalPeer;

  })(Peer);

}).call(this);

},{"./peer":11,"./stream":18}],11:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;


  /**
   * A user in the room
   * @module rtc
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
     * @param {String} key Key of the changed stats
     * @param value Value of the changed status
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

},{"events":1}],12:[function(require,module,exports){
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
   * @class rtc.PeerConnection
   * @module rtc
   */

  exports.PeerConnection = (function(superClass) {
    extend(PeerConnection, superClass);

    function PeerConnection(offering, options1) {
      this.offering = offering;
      this.options = options1;
      this.pc = new compat.PeerConnection(this._iceOptions());
      this.connect_d = new Deferred();
      this.connected = false;
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

    PeerConnection.prototype.addIceCandidate = function(desc) {
      var candidate;
      if (desc.candidate != null) {
        candidate = new compat.IceCandidate(desc);
        return this.pc.addIceCandidate(candidate);
      } else {
        return console.log("ICE trickling stopped");
      }
    };

    PeerConnection.prototype._iceOptions = function() {
      var servers;
      servers = [];
      if (this.options.stun != null) {
        servers.push({
          url: this.options.stun
        });
      }
      return {
        iceServers: servers
      };
    };

    PeerConnection.prototype._oaOptions = function() {
      return {
        optional: [],
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      };
    };

    PeerConnection.prototype._setRemoteDescription = function(sdp) {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          var description;
          description = new rtc.compat.SessionDescription(sdp);
          return _this.pc.setRemoteDescription(sdp, resolve, reject);
        };
      })(this));
    };

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

    PeerConnection.prototype._connectError = function(err) {
      this.connect_d.reject(err);
      console.log(err);
      return this.emit('error', err);
    };

    PeerConnection.prototype.addStream = function(stream) {
      return this.pc.addStream(stream.stream);
    };

    PeerConnection.prototype.removeSream = function(stream) {
      return this.pc.removeStream(stream.stream);
    };

    PeerConnection.prototype.addDataChannel = function(name, options) {
      var channel;
      if (this.offering) {
        channel = this.pc.createDataChannel(name, options);
        return channel.onopen = (function(_this) {
          return function() {
            return _this.emit('data_channel_ready', new DataChannel(channel));
          };
        })(this);
      }
    };

    PeerConnection.prototype.connect = function() {
      if (!this.connected) {
        if (this.offering) {
          this._offer();
        } else if (this.pc.signalingState === 'have-remote-offer') {
          this._answer();
        }
        this.connected = true;
      }
      return this.connect_d.promise;
    };

    PeerConnection.prototype.close = function() {
      this.pc.close();
      return this.emit('closed');
    };

    return PeerConnection;

  })(EventEmitter);

}).call(this);

},{"./compat":4,"./data_channel":5,"./internal/promise":7,"./stream":18,"events":1}],13:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var ChannelCollection, Peer, Promise, StreamCollection,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Promise = require('./internal/promise').Promise;

  Peer = require('./peer').Peer;

  StreamCollection = require('./internal/stream_collection').StreamCollection;

  ChannelCollection = require('./internal/channel_collection').ChannelCollection;


  /**
   * Represents a remote user of the room
   * @module rtc
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
     * @param {Promise -> rtc.Stream} stream Promise of the channel
     */

    function RemotePeer(peer_connection, signaling, local, options1) {
      this.peer_connection = peer_connection;
      this.signaling = signaling;
      this.local = local;
      this.options = options1;
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
        return function(key, value) {
          return _this.emit('status_changed', key, value);
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
      if ((this.options.auto_connect == null) || !this.options.auto_connect) {
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
        ref = this.local.streams;
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
            ref2 = _this.local.channels;
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

    return RemotePeer;

  })(Peer);

}).call(this);

},{"./internal/channel_collection":6,"./internal/promise":7,"./internal/stream_collection":8,"./peer":11}],14:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter, LocalPeer, MucSignaling, PeerConnection, RemotePeer, WebSocketChannel,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  WebSocketChannel = require('./signaling/web_socket_channel.coffee').WebSocketChannel;

  MucSignaling = require('./signaling/muc_signaling.coffee').MucSignaling;

  RemotePeer = require('./remote_peer.coffee').RemotePeer;

  LocalPeer = require('./local_peer.coffee').LocalPeer;

  PeerConnection = require('./peer_connection.coffee').PeerConnection;


  /**
   * A virtual room which connects multiple Peers
   * @module rtc
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
     * The connection to the room was closed
     * @event closed
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
      this.signaling.on('peer_joined', (function(_this) {
        return function(signaling_peer) {
          var pc, peer;
          pc = new PeerConnection(signaling_peer.first, _this.options);
          peer = new RemotePeer(pc, signaling_peer, _this.local, _this.options);
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

    return Room;

  })(EventEmitter);

}).call(this);

},{"./local_peer.coffee":10,"./peer_connection.coffee":12,"./remote_peer.coffee":13,"./signaling/muc_signaling.coffee":15,"./signaling/web_socket_channel.coffee":17,"events":1}],15:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('../internal/promise').Deferred;

  EventEmitter = require('events').EventEmitter;


  /**
   * Signaling peer for multi user chats.
  #
   * For a detailed description of the signaling protocol see `rtc.signaling.MucSignaling`
  #
   * @module rtc.signaling
   * @class rtc.signaling.MucSignalingPeer
   */

  exports.MucSignalingPeer = (function(superClass) {
    extend(MucSignalingPeer, superClass);

    function MucSignalingPeer(channel, peer_id1, status1, first) {
      var recv_msg;
      this.channel = channel;
      this.peer_id = peer_id1;
      this.status = status1;
      this.first = first;
      recv_msg = (function(_this) {
        return function(data) {
          if (data.peer !== _this.peer_id) {
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
              return _this.emit('new_status', _this.status);
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
        peer: this.peer_id,
        event: event,
        data: data
      });
    };

    return MucSignalingPeer;

  })(EventEmitter);


  /**
   * Signaling for multi user chats
  #
   * The following messages are sent to the server:
  #
   *     // join the room
   *     {
   *       "type": "join",
   *       "status": {}
   *     }
  #
   *     // leave the room
   *     {
   *       "type": "leave"
   *     }
  #
   *     // update status
   *     {
   *       "type": "status",
   *       "status": {}
   *     }
  #
   *     // send message to a peer
   *     {
   *       "type": "to",
   *       "peer": "peer_id",
   *       "data": { .. custom data .. }
   *     }
  #
   * The following messages are received form the server:
  #
   *     // joined the room
   *     {
   *       "type": "joined",
   *       "peers": {
   *         "peer_id": { .. status .. }
   *       }
   *     }
  #
   *     // peer joined the room
   *     {
   *       "type": "peer_joined",
   *       "peer": "peer_id",
   *       "status": { .. status .. }
   *     }
  #
   *     // peer updated its status
   *     {
   *       "type": "peer_status",
   *       "peer": "peer_id",
   *       "status": { .. status .. }
   *     }
  #
   *     // peer left
   *     {
   *       "type": "peer_left",
   *       "peer": "peer_id"
   *     }
  #
   *     // message from peer
   *     {
   *       "type": "from",
   *       "peer": "peer_id",
   *       "event": "event_id",
   *       "data": { .. custom data .. }
   *     }
  #
   * The messages transmitted in the `to`/`from` messages are emitted as events in `MucSignalingPeer`
  #
   * @module rtc.signaling
   * @class rtc.signaling.MucSignaling
   */

  exports.MucSignaling = (function(superClass) {
    extend(MucSignaling, superClass);

    function MucSignaling(channel, status1) {
      var join_d;
      this.channel = channel;
      this.status = status1;
      join_d = new Deferred();
      this.join_p = join_d.promise;
      this.channel.on('closed', (function(_this) {
        return function() {
          return _this.emit('closed');
        };
      })(this));
      this.channel.on('message', (function(_this) {
        return function(data) {
          var peer, peer_id, ref, status;
          if (data.type == null) {
            return;
          }
          switch (data.type) {
            case 'joined':
              if (data.peers == null) {
                return;
              }
              ref = data.peers;
              for (peer_id in ref) {
                status = ref[peer_id];
                peer = new exports.MucSignalingPeer(_this.channel, peer_id, status, false);
                _this.emit('peer_joined', peer);
              }
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
        return this.connect_p.then(function() {
          return this.channel.send({
            type: 'status',
            status: status
          });
        });
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

  })(EventEmitter);

}).call(this);

},{"../internal/promise":7,"events":1}],16:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('../internal/promise').Deferred;

  EventEmitter = require('events').EventEmitter;


  /**
   * Signaling peer compatible with the framing of palava signaling
  #
   * @module rtc.signaling
   * @class rtc.signaling.PalavaSignalingPeer
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
          return _this.emit('new_status', status);
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

  })(EventEmitter);


  /**
   * Signaling implementation compatible with the framing of palava signaling
  #
   * @module rtc.signaling
   * @class rtc.signaling.PalavaSignaling
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
          var i, peer, ref;
          if (data.event == null) {
            return;
          }
          switch (data.event) {
            case 'joined_room':
              if ((data.peers == null) || (data.own_id == null)) {
                return;
              }
              ref = data.peers;
              for (i in ref) {
                data = ref[i];
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

  })(EventEmitter);

}).call(this);

},{"../internal/promise":7,"events":1}],17:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter, Promise,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Promise = require('../internal/promise').Promise;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.signaling
   * @class rtc.signaling.WebSocketChannel
   */

  exports.WebSocketChannel = (function(superClass) {
    extend(WebSocketChannel, superClass);

    function WebSocketChannel(address) {
      this.address = address;
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

  })(EventEmitter);

}).call(this);

},{"../internal/promise":7,"events":1}],18:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var compat;

  compat = require('./compat').compat;


  /**
   * A wrapper around an HTML5 MediaStream
   * @module rtc
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
      return stream.stop();
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

},{"./compat":4}],19:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Peer, Stream;

  Stream = require('./stream').Stream;

  Peer = require('./peer').Peer;


  /**
   * @module rtc
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

},{"./peer":11,"./stream":18}]},{},[9])(9)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsInNyYy9jb21wYXQuY29mZmVlIiwic3JjL2RhdGFfY2hhbm5lbC5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvY2hhbm5lbF9jb2xsZWN0aW9uLmNvZmZlZSIsInNyYy9pbnRlcm5hbC9wcm9taXNlLmNvZmZlZSIsInNyYy9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbi5jb2ZmZWUiLCJzcmMvbGliLmNvZmZlZSIsInNyYy9sb2NhbF9wZWVyLmNvZmZlZSIsInNyYy9wZWVyLmNvZmZlZSIsInNyYy9wZWVyX2Nvbm5lY3Rpb24uY29mZmVlIiwic3JjL3JlbW90ZV9wZWVyLmNvZmZlZSIsInNyYy9yb29tLmNvZmZlZSIsInNyYy9zaWduYWxpbmcvbXVjX3NpZ25hbGluZy5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwuY29mZmVlIiwic3JjL3N0cmVhbS5jb2ZmZWUiLCJzcmMvdmlkZW9fZWxlbWVudC5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3Y4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDakpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qIVxuICogQG92ZXJ2aWV3IGVzNi1wcm9taXNlIC0gYSB0aW55IGltcGxlbWVudGF0aW9uIG9mIFByb21pc2VzL0ErLlxuICogQGNvcHlyaWdodCBDb3B5cmlnaHQgKGMpIDIwMTQgWWVodWRhIEthdHosIFRvbSBEYWxlLCBTdGVmYW4gUGVubmVyIGFuZCBjb250cmlidXRvcnMgKENvbnZlcnNpb24gdG8gRVM2IEFQSSBieSBKYWtlIEFyY2hpYmFsZClcbiAqIEBsaWNlbnNlICAgTGljZW5zZWQgdW5kZXIgTUlUIGxpY2Vuc2VcbiAqICAgICAgICAgICAgU2VlIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9qYWtlYXJjaGliYWxkL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG4gKiBAdmVyc2lvbiAgIDMuMC4yXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbicgfHwgKHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNNYXliZVRoZW5hYmxlKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheSA9IGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXk7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkdG9TdHJpbmcgPSB7fS50b1N0cmluZztcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbl0gPSBjYWxsYmFjaztcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuICsgMV0gPSBhcmc7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuICs9IDI7XG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9PT0gMikge1xuICAgICAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbihsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyKHNjaGVkdWxlRm4pIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXAoYXNhcEZuKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcCA9IGFzYXBGbjtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gd2luZG93IDogdW5kZWZpbmVkO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93IHx8IHt9O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc05vZGUgPSB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nO1xuXG4gICAgLy8gdGVzdCBmb3Igd2ViIHdvcmtlciBidXQgbm90IGluIElFMTBcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyID0gdHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xuXG4gICAgLy8gbm9kZVxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VOZXh0VGljaygpIHtcbiAgICAgIC8vIG5vZGUgdmVyc2lvbiAwLjEwLnggZGlzcGxheXMgYSBkZXByZWNhdGlvbiB3YXJuaW5nIHdoZW4gbmV4dFRpY2sgaXMgdXNlZCByZWN1cnNpdmVseVxuICAgICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jdWpvanMvd2hlbi9pc3N1ZXMvNDEwIGZvciBkZXRhaWxzXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2sobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gdmVydHhcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlVmVydHhUaW1lcigpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgICAgIHZhciBpdGVyYXRpb25zID0gMDtcbiAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgbm9kZS5kYXRhID0gKGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gd2ViIHdvcmtlclxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcbiAgICAgIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaDtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBzZXRUaW1lb3V0KGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCwgMSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuOyBpKz0yKSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXTtcbiAgICAgICAgdmFyIGFyZyA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpKzFdO1xuXG4gICAgICAgIGNhbGxiYWNrKGFyZyk7XG5cbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2ldID0gdW5kZWZpbmVkO1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJGF0dGVtcHRWZXJ0eCgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByID0gcmVxdWlyZTtcbiAgICAgICAgdmFyIHZlcnR4ID0gcigndmVydHgnKTtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHZlcnR4TmV4dCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlVmVydHhUaW1lcigpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaDtcbiAgICAvLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNOb2RlKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VOZXh0VGljaygpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNXb3JrZXIpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU1lc3NhZ2VDaGFubmVsKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiByZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AoKSB7fVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgICA9IHZvaWQgMDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEID0gMTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQgID0gMjtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUiA9IG5ldyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc2VsZkZ1bGZpbGxtZW50KCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJZb3UgY2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGNhbm5vdFJldHVybk93bigpIHtcbiAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbihwcm9taXNlKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuO1xuICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUi5lcnJvciA9IGVycm9yO1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcik7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuKSB7XG4gICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24ocHJvbWlzZSkge1xuICAgICAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG4gICAgICAgIHZhciBlcnJvciA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeVRoZW4odGhlbiwgdGhlbmFibGUsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGlmICh0aGVuYWJsZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgIGlmIChzZWFsZWQpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG4gICAgICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9LCBwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuICAgICAgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpIHtcbiAgICAgIGlmIChtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yID09PSBwcm9taXNlLmNvbnN0cnVjdG9yKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHRoZW4gPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKG1heWJlVGhlbmFibGUpO1xuXG4gICAgICAgIGlmICh0aGVuID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUi5lcnJvcik7XG4gICAgICAgIH0gZWxzZSBpZiAodGhlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24odGhlbikpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpIHtcbiAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc2VsZkZ1bGZpbGxtZW50KCkpO1xuICAgICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkdXRpbHMkJG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuICAgICAgICBwcm9taXNlLl9vbmVycm9yKHByb21pc2UuX3Jlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuXG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcbiAgICAgIHByb21pc2UuX3N0YXRlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEO1xuXG4gICAgICBpZiAocHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gsIHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykgeyByZXR1cm47IH1cbiAgICAgIHByb21pc2UuX3N0YXRlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQ7XG4gICAgICBwcm9taXNlLl9yZXN1bHQgPSByZWFzb247XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgICAgIHZhciBsZW5ndGggPSBzdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgICAgIHBhcmVudC5fb25lcnJvciA9IG51bGw7XG5cbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aCArIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURURdICA9IG9uUmVqZWN0aW9uO1xuXG4gICAgICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoKHByb21pc2UpIHtcbiAgICAgIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIHNldHRsZWQgPSBwcm9taXNlLl9zdGF0ZTtcblxuICAgICAgaWYgKHN1YnNjcmliZXJzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgICAgdmFyIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsID0gcHJvbWlzZS5fcmVzdWx0O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG4gICAgICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKSB7XG4gICAgICB0aGlzLmVycm9yID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soZGV0YWlsKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBlO1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHZhciBoYXNDYWxsYmFjayA9IGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICAgICAgdmFsdWUsIGVycm9yLCBzdWNjZWVkZWQsIGZhaWxlZDtcblxuICAgICAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgICAgIHZhbHVlID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCk7XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IpIHtcbiAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgIGVycm9yID0gdmFsdWUuZXJyb3I7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgIC8vIG5vb3BcbiAgICAgIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlcihmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSl7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcihDb25zdHJ1Y3RvciwgaW5wdXQpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgZW51bWVyYXRvci5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICAgICAgZW51bWVyYXRvci5wcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoZW51bWVyYXRvci5fdmFsaWRhdGVJbnB1dChpbnB1dCkpIHtcbiAgICAgICAgZW51bWVyYXRvci5faW5wdXQgICAgID0gaW5wdXQ7XG4gICAgICAgIGVudW1lcmF0b3IubGVuZ3RoICAgICA9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgZW51bWVyYXRvci5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXG4gICAgICAgIGVudW1lcmF0b3IuX2luaXQoKTtcblxuICAgICAgICBpZiAoZW51bWVyYXRvci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKGVudW1lcmF0b3IucHJvbWlzZSwgZW51bWVyYXRvci5fcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnVtZXJhdG9yLmxlbmd0aCA9IGVudW1lcmF0b3IubGVuZ3RoIHx8IDA7XG4gICAgICAgICAgZW51bWVyYXRvci5fZW51bWVyYXRlKCk7XG4gICAgICAgICAgaWYgKGVudW1lcmF0b3IuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChlbnVtZXJhdG9yLnByb21pc2UsIGVudW1lcmF0b3IuX3Jlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QoZW51bWVyYXRvci5wcm9taXNlLCBlbnVtZXJhdG9yLl92YWxpZGF0aW9uRXJyb3IoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl92YWxpZGF0ZUlucHV0ID0gZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkoaW5wdXQpO1xuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3ZhbGlkYXRpb25FcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5faW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fcmVzdWx0ID0gbmV3IEFycmF5KHRoaXMubGVuZ3RoKTtcbiAgICB9O1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3I7XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2VudW1lcmF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICB2YXIgbGVuZ3RoICA9IGVudW1lcmF0b3IubGVuZ3RoO1xuICAgICAgdmFyIHByb21pc2UgPSBlbnVtZXJhdG9yLnByb21pc2U7XG4gICAgICB2YXIgaW5wdXQgICA9IGVudW1lcmF0b3IuX2lucHV0O1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgcHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX2VhY2hFbnRyeShpbnB1dFtpXSwgaSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fZWFjaEVudHJ5ID0gZnVuY3Rpb24oZW50cnksIGkpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcbiAgICAgIHZhciBjID0gZW51bWVyYXRvci5faW5zdGFuY2VDb25zdHJ1Y3RvcjtcblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNNYXliZVRoZW5hYmxlKGVudHJ5KSkge1xuICAgICAgICBpZiAoZW50cnkuY29uc3RydWN0b3IgPT09IGMgJiYgZW50cnkuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgICAgZW50cnkuX29uZXJyb3IgPSBudWxsO1xuICAgICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChlbnRyeS5fc3RhdGUsIGksIGVudHJ5Ll9yZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVudW1lcmF0b3IuX3dpbGxTZXR0bGVBdChjLnJlc29sdmUoZW50cnkpLCBpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW51bWVyYXRvci5fcmVtYWluaW5nLS07XG4gICAgICAgIGVudW1lcmF0b3IuX3Jlc3VsdFtpXSA9IGVudHJ5O1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3NldHRsZWRBdCA9IGZ1bmN0aW9uKHN0YXRlLCBpLCB2YWx1ZSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuICAgICAgdmFyIHByb21pc2UgPSBlbnVtZXJhdG9yLnByb21pc2U7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICBlbnVtZXJhdG9yLl9yZW1haW5pbmctLTtcblxuICAgICAgICBpZiAoc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnVtZXJhdG9yLl9yZXN1bHRbaV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZW51bWVyYXRvci5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgZW51bWVyYXRvci5fcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl93aWxsU2V0dGxlQXQgPSBmdW5jdGlvbihwcm9taXNlLCBpKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwcm9taXNlLCB1bmRlZmluZWQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQsIGksIHZhbHVlKTtcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQsIGksIHJlYXNvbik7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsKGVudHJpZXMpIHtcbiAgICAgIHJldHVybiBuZXcgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQodGhpcywgZW50cmllcykucHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkYWxsO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2UoZW50cmllcykge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuXG4gICAgICBpZiAoIWxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICB9XG5cbiAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcblxuICAgICAgZnVuY3Rpb24gb25GdWxmaWxsbWVudCh2YWx1ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gb25SZWplY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgcHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLCB1bmRlZmluZWQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkcmFjZTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlKG9iamVjdCkge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgICAgIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gb2JqZWN0O1xuICAgICAgfVxuXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgb2JqZWN0KTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJHJlc29sdmU7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRyZWplY3QocmVhc29uKSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkcmVqZWN0O1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRjb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc1Jlc29sdmVyKCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc05ldygpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2U7XG4gICAgLyoqXG4gICAgICBQcm9taXNlIG9iamVjdHMgcmVwcmVzZW50IHRoZSBldmVudHVhbCByZXN1bHQgb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gVGhlXG4gICAgICBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLCB3aGljaFxuICAgICAgcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGUgcmVhc29uXG4gICAgICB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICAgICAgVGVybWlub2xvZ3lcbiAgICAgIC0tLS0tLS0tLS0tXG5cbiAgICAgIC0gYHByb21pc2VgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB3aXRoIGEgYHRoZW5gIG1ldGhvZCB3aG9zZSBiZWhhdmlvciBjb25mb3JtcyB0byB0aGlzIHNwZWNpZmljYXRpb24uXG4gICAgICAtIGB0aGVuYWJsZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyBhIGB0aGVuYCBtZXRob2QuXG4gICAgICAtIGB2YWx1ZWAgaXMgYW55IGxlZ2FsIEphdmFTY3JpcHQgdmFsdWUgKGluY2x1ZGluZyB1bmRlZmluZWQsIGEgdGhlbmFibGUsIG9yIGEgcHJvbWlzZSkuXG4gICAgICAtIGBleGNlcHRpb25gIGlzIGEgdmFsdWUgdGhhdCBpcyB0aHJvd24gdXNpbmcgdGhlIHRocm93IHN0YXRlbWVudC5cbiAgICAgIC0gYHJlYXNvbmAgaXMgYSB2YWx1ZSB0aGF0IGluZGljYXRlcyB3aHkgYSBwcm9taXNlIHdhcyByZWplY3RlZC5cbiAgICAgIC0gYHNldHRsZWRgIHRoZSBmaW5hbCByZXN0aW5nIHN0YXRlIG9mIGEgcHJvbWlzZSwgZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuXG4gICAgICBBIHByb21pc2UgY2FuIGJlIGluIG9uZSBvZiB0aHJlZSBzdGF0ZXM6IHBlbmRpbmcsIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQuXG5cbiAgICAgIFByb21pc2VzIHRoYXQgYXJlIGZ1bGZpbGxlZCBoYXZlIGEgZnVsZmlsbG1lbnQgdmFsdWUgYW5kIGFyZSBpbiB0aGUgZnVsZmlsbGVkXG4gICAgICBzdGF0ZS4gIFByb21pc2VzIHRoYXQgYXJlIHJlamVjdGVkIGhhdmUgYSByZWplY3Rpb24gcmVhc29uIGFuZCBhcmUgaW4gdGhlXG4gICAgICByZWplY3RlZCBzdGF0ZS4gIEEgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmV2ZXIgYSB0aGVuYWJsZS5cblxuICAgICAgUHJvbWlzZXMgY2FuIGFsc28gYmUgc2FpZCB0byAqcmVzb2x2ZSogYSB2YWx1ZS4gIElmIHRoaXMgdmFsdWUgaXMgYWxzbyBhXG4gICAgICBwcm9taXNlLCB0aGVuIHRoZSBvcmlnaW5hbCBwcm9taXNlJ3Mgc2V0dGxlZCBzdGF0ZSB3aWxsIG1hdGNoIHRoZSB2YWx1ZSdzXG4gICAgICBzZXR0bGVkIHN0YXRlLiAgU28gYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpbGxcbiAgICAgIGl0c2VsZiByZWplY3QsIGFuZCBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdpbGxcbiAgICAgIGl0c2VsZiBmdWxmaWxsLlxuXG5cbiAgICAgIEJhc2ljIFVzYWdlOlxuICAgICAgLS0tLS0tLS0tLS0tXG5cbiAgICAgIGBgYGpzXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvLyBvbiBzdWNjZXNzXG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuXG4gICAgICAgIC8vIG9uIGZhaWx1cmVcbiAgICAgICAgcmVqZWN0KHJlYXNvbik7XG4gICAgICB9KTtcblxuICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgLy8gb24gcmVqZWN0aW9uXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBZHZhbmNlZCBVc2FnZTpcbiAgICAgIC0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICBQcm9taXNlcyBzaGluZSB3aGVuIGFic3RyYWN0aW5nIGF3YXkgYXN5bmNocm9ub3VzIGludGVyYWN0aW9ucyBzdWNoIGFzXG4gICAgICBgWE1MSHR0cFJlcXVlc3Rgcy5cblxuICAgICAgYGBganNcbiAgICAgIGZ1bmN0aW9uIGdldEpTT04odXJsKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICAgICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBoYW5kbGVyO1xuICAgICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgeGhyLnNlbmQoKTtcblxuICAgICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkRPTkUpIHtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2dldEpTT046IGAnICsgdXJsICsgJ2AgZmFpbGVkIHdpdGggc3RhdHVzOiBbJyArIHRoaXMuc3RhdHVzICsgJ10nKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgZ2V0SlNPTignL3Bvc3RzLmpzb24nKS50aGVuKGZ1bmN0aW9uKGpzb24pIHtcbiAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAvLyBvbiByZWplY3Rpb25cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFVubGlrZSBjYWxsYmFja3MsIHByb21pc2VzIGFyZSBncmVhdCBjb21wb3NhYmxlIHByaW1pdGl2ZXMuXG5cbiAgICAgIGBgYGpzXG4gICAgICBQcm9taXNlLmFsbChbXG4gICAgICAgIGdldEpTT04oJy9wb3N0cycpLFxuICAgICAgICBnZXRKU09OKCcvY29tbWVudHMnKVxuICAgICAgXSkudGhlbihmdW5jdGlvbih2YWx1ZXMpe1xuICAgICAgICB2YWx1ZXNbMF0gLy8gPT4gcG9zdHNKU09OXG4gICAgICAgIHZhbHVlc1sxXSAvLyA9PiBjb21tZW50c0pTT05cblxuICAgICAgICByZXR1cm4gdmFsdWVzO1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQGNsYXNzIFByb21pc2VcbiAgICAgIEBwYXJhbSB7ZnVuY3Rpb259IHJlc29sdmVyXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAY29uc3RydWN0b3JcbiAgICAqL1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlKHJlc29sdmVyKSB7XG4gICAgICB0aGlzLl9pZCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRjb3VudGVyKys7XG4gICAgICB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wICE9PSByZXNvbHZlcikge1xuICAgICAgICBpZiAoIWxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbihyZXNvbHZlcikpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc05ldygpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW5pdGlhbGl6ZVByb21pc2UodGhpcywgcmVzb2x2ZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLmFsbCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJGFsbCQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yYWNlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yZXNvbHZlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5yZWplY3QgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX3NldFNjaGVkdWxlciA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRTY2hlZHVsZXI7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX3NldEFzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0QXNhcDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fYXNhcCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwO1xuXG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucHJvdG90eXBlID0ge1xuICAgICAgY29uc3RydWN0b3I6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLFxuXG4gICAgLyoqXG4gICAgICBUaGUgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCxcbiAgICAgIHdoaWNoIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlXG4gICAgICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgIC8vIHVzZXIgaXMgYXZhaWxhYmxlXG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQ2hhaW5pbmdcbiAgICAgIC0tLS0tLS0tXG5cbiAgICAgIFRoZSByZXR1cm4gdmFsdWUgb2YgYHRoZW5gIGlzIGl0c2VsZiBhIHByb21pc2UuICBUaGlzIHNlY29uZCwgJ2Rvd25zdHJlYW0nXG4gICAgICBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZmlyc3QgcHJvbWlzZSdzIGZ1bGZpbGxtZW50XG4gICAgICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gdXNlci5uYW1lO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh1c2VyTmFtZSkge1xuICAgICAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG4gICAgICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuICAgICAgfSk7XG5cbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jyk7XG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBpZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHJlYXNvbmAgd2lsbCBiZSAnRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknLlxuICAgICAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cbiAgICAgIH0pO1xuICAgICAgYGBgXG4gICAgICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBc3NpbWlsYXRpb25cbiAgICAgIC0tLS0tLS0tLS0tLVxuXG4gICAgICBTb21ldGltZXMgdGhlIHZhbHVlIHlvdSB3YW50IHRvIHByb3BhZ2F0ZSB0byBhIGRvd25zdHJlYW0gcHJvbWlzZSBjYW4gb25seSBiZVxuICAgICAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuICAgICAgZnVsZmlsbG1lbnQgb3IgcmVqZWN0aW9uIGhhbmRsZXIuIFRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCB0aGVuIGJlIHBlbmRpbmdcbiAgICAgIHVudGlsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlzIHNldHRsZWQuIFRoaXMgaXMgY2FsbGVkICphc3NpbWlsYXRpb24qLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAgIC8vIFRoZSB1c2VyJ3MgY29tbWVudHMgYXJlIG5vdyBhdmFpbGFibGVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCByZWplY3RzLCB3ZSdsbCBoYXZlIHRoZSByZWFzb24gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgU2ltcGxlIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIHJlc3VsdDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gZmluZFJlc3VsdCgpO1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9XG4gICAgICBgYGBcblxuICAgICAgRXJyYmFjayBFeGFtcGxlXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kUmVzdWx0KGZ1bmN0aW9uKHJlc3VsdCwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIC8vIGZhaWx1cmVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFByb21pc2UgRXhhbXBsZTtcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQWR2YW5jZWQgRXhhbXBsZVxuICAgICAgLS0tLS0tLS0tLS0tLS1cblxuICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICB2YXIgYXV0aG9yLCBib29rcztcblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXV0aG9yID0gZmluZEF1dGhvcigpO1xuICAgICAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9XG4gICAgICBgYGBcblxuICAgICAgRXJyYmFjayBFeGFtcGxlXG5cbiAgICAgIGBgYGpzXG5cbiAgICAgIGZ1bmN0aW9uIGZvdW5kQm9va3MoYm9va3MpIHtcblxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuXG4gICAgICB9XG5cbiAgICAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIC8vIGZhaWx1cmVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBmb3VuZEJvb2tzKGJvb2tzKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAgICAgICAgICAgZmFpbHVyZShyZWFzb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFByb21pc2UgRXhhbXBsZTtcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgZmluZEF1dGhvcigpLlxuICAgICAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cbiAgICAgICAgdGhlbihmdW5jdGlvbihib29rcyl7XG4gICAgICAgICAgLy8gZm91bmQgYm9va3NcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIHRoZW5cbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uRnVsZmlsbGVkXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAgICovXG4gICAgICB0aGVuOiBmdW5jdGlvbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcztcbiAgICAgICAgdmFyIHN0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuICAgICAgICBpZiAoc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCAmJiAhb25GdWxmaWxsbWVudCB8fCBzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQgJiYgIW9uUmVqZWN0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hpbGQgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHBhcmVudC5fcmVzdWx0O1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1tzdGF0ZSAtIDFdO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCByZXN1bHQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICB9LFxuXG4gICAgLyoqXG4gICAgICBgY2F0Y2hgIGlzIHNpbXBseSBzdWdhciBmb3IgYHRoZW4odW5kZWZpbmVkLCBvblJlamVjdGlvbilgIHdoaWNoIG1ha2VzIGl0IHRoZSBzYW1lXG4gICAgICBhcyB0aGUgY2F0Y2ggYmxvY2sgb2YgYSB0cnkvY2F0Y2ggc3RhdGVtZW50LlxuXG4gICAgICBgYGBqc1xuICAgICAgZnVuY3Rpb24gZmluZEF1dGhvcigpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkbid0IGZpbmQgdGhhdCBhdXRob3InKTtcbiAgICAgIH1cblxuICAgICAgLy8gc3luY2hyb25vdXNcbiAgICAgIHRyeSB7XG4gICAgICAgIGZpbmRBdXRob3IoKTtcbiAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9XG5cbiAgICAgIC8vIGFzeW5jIHdpdGggcHJvbWlzZXNcbiAgICAgIGZpbmRBdXRob3IoKS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQG1ldGhvZCBjYXRjaFxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3Rpb25cbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICAgKi9cbiAgICAgICdjYXRjaCc6IGZ1bmN0aW9uKG9uUmVqZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICAgICAgfVxuICAgIH07XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRwb2x5ZmlsbCgpIHtcbiAgICAgIHZhciBsb2NhbDtcblxuICAgICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbG9jYWwgPSBnbG9iYWw7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsID0gc2VsZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgbG9jYWwgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBQID0gbG9jYWwuUHJvbWlzZTtcblxuICAgICAgaWYgKFAgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKSA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsb2NhbC5Qcm9taXNlID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQ7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJHBvbHlmaWxsO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2UgPSB7XG4gICAgICAnUHJvbWlzZSc6IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0LFxuICAgICAgJ3BvbHlmaWxsJzogbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0XG4gICAgfTtcblxuICAgIC8qIGdsb2JhbCBkZWZpbmU6dHJ1ZSBtb2R1bGU6dHJ1ZSB3aW5kb3c6IHRydWUgKi9cbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmVbJ2FtZCddKSB7XG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlOyB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZVsnZXhwb3J0cyddKSB7XG4gICAgICBtb2R1bGVbJ2V4cG9ydHMnXSA9IGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXNbJ0VTNlByb21pc2UnXSA9IGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0KCk7XG59KS5jYWxsKHRoaXMpO1xuXG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG5cbi8qKlxuICogQ29yZSBmdW5jdGlvbmFsaXR5XG4gKiBAbW9kdWxlIHJ0Y1xuICogQG1haW4gcnRjXG4gKi9cblxuXG4vKipcbiAqIFNpZ25hbGluZyBhbmQgc2lnbmFsaW5nIGNoYW5uZWxzXG4gKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAqIEBtYWluIHJ0Yy5zaWduYWxpbmdcbiAqL1xuXG5cbi8qKlxuICogSW50ZXJuYWwgaGVscGVyc1xuICogQG1vZHVsZSBydGMuaW50ZXJuYWxcbiAqIEBtYWluIHJ0Yy5pbnRlcm5hbFxuICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIGJpbmRIZWxwZXIsIGNvbXBhdDtcblxuICBiaW5kSGVscGVyID0gZnVuY3Rpb24ob2JqLCBmdW4pIHtcbiAgICBpZiAoZnVuID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bi5iaW5kKG9iaik7XG4gIH07XG5cbiAgZXhwb3J0cy5jb21wYXQgPSBjb21wYXQgPSB7XG4gICAgUGVlckNvbm5lY3Rpb246IHdpbmRvdy5QZWVyQ29ubmVjdGlvbiB8fCB3aW5kb3cud2Via2l0UGVlckNvbm5lY3Rpb24wMCB8fCB3aW5kb3cud2Via2l0UlRDUGVlckNvbm5lY3Rpb24gfHwgd2luZG93Lm1velJUQ1BlZXJDb25uZWN0aW9uLFxuICAgIEljZUNhbmRpZGF0ZTogd2luZG93LlJUQ0ljZUNhbmRpZGF0ZSB8fCB3aW5kb3cubW96UlRDSWNlQ2FuZGlkYXRlLFxuICAgIFNlc3Npb25EZXNjcmlwdGlvbjogd2luZG93Lm1velJUQ1Nlc3Npb25EZXNjcmlwdGlvbiB8fCB3aW5kb3cuUlRDU2Vzc2lvbkRlc2NyaXB0aW9uLFxuICAgIE1lZGlhU3RyZWFtOiB3aW5kb3cuTWVkaWFTdHJlYW0gfHwgd2luZG93Lm1vek1lZGlhU3RyZWFtIHx8IHdpbmRvdy53ZWJraXRNZWRpYVN0cmVhbSxcbiAgICBnZXRVc2VyTWVkaWE6IGJpbmRIZWxwZXIobmF2aWdhdG9yLCBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWEpLFxuICAgIHN1cHBvcnRlZDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gKGNvbXBhdC5QZWVyQ29ubmVjdGlvbiAhPSBudWxsKSAmJiAoY29tcGF0LkljZUNhbmRpZGF0ZSAhPSBudWxsKSAmJiAoY29tcGF0LlNlc3Npb25EZXNjcmlwdGlvbiAhPSBudWxsKSAmJiAoY29tcGF0LmdldFVzZXJNZWRpYSAhPSBudWxsKTtcbiAgICB9XG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLCBQcm9taXNlLCByZWYsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICByZWYgPSByZXF1aXJlKCcuL2ludGVybmFsL3Byb21pc2UnKSwgRGVmZXJyZWQgPSByZWYuRGVmZXJyZWQsIFByb21pc2UgPSByZWYuUHJvbWlzZTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQSB3cmFwcGVyIGZvciBSVENEYXRhQ2hhbm5lbC4gVXNlZCB0byB0cmFuc2ZlciBjdXN0b20gZGF0YSBiZXR3ZWVuIHBlZXJzLlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKiBAY2xhc3MgcnRjLkRhdGFDaGFubmVsXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7UlRDRGF0YUNoYW5uZWx9IGNoYW5uZWwgVGhlIHdyYXBwZWQgbmF0aXZlIGRhdGEgY2hhbm5lbFxuICAgKiBAcGFyYW0ge051bWJlcn0gW21heF9idWZmZXJdIFRoZSBzaXplIG9mIHRoZSBzZW5kIGJ1ZmZlciBhZnRlciB3aGljaCB3ZSB3aWxsIGRlbGF5IHNlbmRpbmdcbiAgICovXG5cbiAgZXhwb3J0cy5EYXRhQ2hhbm5lbCA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKERhdGFDaGFubmVsLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgbWVzc2FnZXMgd2FzIHJlY2VpdmVkLiBUcmlnZ2VycyBvbmx5IGFmdGVyIGBjb25uZWN0KClgIHdhcyBjYWxsZWRcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHJlY2VpdmVkXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBjaGFubmVsIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBEYXRhQ2hhbm5lbChjaGFubmVsLCBtYXhfYnVmZmVyKSB7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5tYXhfYnVmZmVyID0gbWF4X2J1ZmZlciAhPSBudWxsID8gbWF4X2J1ZmZlciA6IDEwMjQgKiAxMDtcbiAgICAgIHRoaXMuX2Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5fY29ubmVjdF9xdWV1ZSA9IFtdO1xuICAgICAgdGhpcy5fc2VuZF9idWZmZXIgPSBbXTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbm1lc3NhZ2UgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKCFfdGhpcy5fY29ubmVjdGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RfcXVldWUucHVzaChldmVudC5kYXRhKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ21lc3NhZ2UnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbmNsb3NlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbmVycm9yID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRvIHRoZSBEYXRhQ2hhbm5lbC4gWW91IHdpbGwgcmVjZWl2ZSBtZXNzYWdlcyBhbmQgd2lsbCBiZSBhYmxlIHRvIHNlbmQgYWZ0ZXIgY2FsbGluZyB0aGlzLlxuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggcmVzb2x2ZXMgYXMgc29vbiBhcyB0aGUgRGF0YUNoYW5uZWwgaXMgb3BlblxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkYXRhLCBpLCBsZW4sIHJlZjE7XG4gICAgICB0aGlzLl9jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgcmVmMSA9IHRoaXMuX2Nvbm5lY3RfcXVldWU7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByZWYxLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGRhdGEgPSByZWYxW2ldO1xuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0X3F1ZXVlO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBsYWJlbCBvZiB0aGUgRGF0YUNoYW5uZWwgdXNlZCB0byBkaXN0aW5ndWlzaCBtdWx0aXBsZSBjaGFubmVsc1xuICAgICAqIEBtZXRob2QgbGFiZWxcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSBsYWJlbFxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmxhYmVsID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmxhYmVsO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNlbmQgZGF0YSB0byB0aGUgcGVlciB0aHJvdWdoIHRoZSBEYXRhQ2hhbm5lbFxuICAgICAqIEBtZXRob2Qgc2VuZFxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIGJlIHRyYW5zZmVycmVkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIHdoZW4gdGhlIGRhdGEgd2FzIHBhc3NlZCB0byB0aGUgbmF0aXZlIGRhdGEgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgZGVmZXI7XG4gICAgICBpZiAoIXRoaXMuX2Nvbm5lY3RlZCkge1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTZW5kaW5nIHdpdGhvdXQgYmVpbmcgY29ubmVjdGVkLiBQbGVhc2UgY2FsbCBjb25uZWN0KCkgb24gdGhlIGRhdGEgY2hhbm5lbCB0byBzdGFydCB1c2luZyBpdC5cIik7XG4gICAgICB9XG4gICAgICBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5fc2VuZF9idWZmZXIucHVzaChbZGF0YSwgZGVmZXJdKTtcbiAgICAgIGlmICh0aGlzLl9zZW5kX2J1ZmZlci5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgdGhpcy5fYWN0dWFsU2VuZCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTWV0aG9kIHdoaWNoIGFjdHVhbGx5IHNlbmRzIHRoZSBkYXRhLiBJbXBsZW1lbnRzIGJ1ZmZlcmluZ1xuICAgICAqIEBtZXRob2QgX2FjdHVhbFNlbmRcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLl9hY3R1YWxTZW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGF0YSwgZGVmZXIsIHJlZjEsIHJlZjIsIHJlc3VsdHM7XG4gICAgICBpZiAodGhpcy5jaGFubmVsLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICB3aGlsZSAodGhpcy5fc2VuZF9idWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKHRoaXMuY2hhbm5lbC5idWZmZXJlZEFtb3VudCA+PSB0aGlzLm1heF9idWZmZXIpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQodGhpcy5fYWN0dWFsU2VuZC5iaW5kKHRoaXMpLCAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVmMSA9IHRoaXMuX3NlbmRfYnVmZmVyWzBdLCBkYXRhID0gcmVmMVswXSwgZGVmZXIgPSByZWYxWzFdO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNoYW5uZWwuc2VuZChkYXRhKTtcbiAgICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQodGhpcy5fYWN0dWFsU2VuZC5iaW5kKHRoaXMpLCAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVmZXIucmVzb2x2ZSgpO1xuICAgICAgICAgIHRoaXMuX3NlbmRfYnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlbmRfYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICAgIHJlZjIgPSB0aGlzLl9zZW5kX2J1ZmZlci5zaGlmdCgpLCBkYXRhID0gcmVmMlswXSwgZGVmZXIgPSByZWYyWzFdO1xuICAgICAgICAgIHJlc3VsdHMucHVzaChkZWZlci5yZWplY3QobmV3IEVycm9yKFwiRGF0YUNoYW5uZWwgY2xvc2VkXCIpKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhQ2hhbm5lbDtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9wcm9taXNlJyksIERlZmVycmVkID0gcmVmLkRlZmVycmVkLCBQcm9taXNlID0gcmVmLlByb21pc2U7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEhlbHBlciB3aGljaCBoYW5kbGVzIERhdGFDaGFubmVsIG5lZ290aWF0aW9uIGZvciBSZW1vdGVQZWVyXG4gICAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gICAqIEBjbGFzcyBydGMuaW50ZXJuYWwuQ2hhbm5lbENvbGxlY3Rpb25cbiAgICovXG5cbiAgZXhwb3J0cy5DaGFubmVsQ29sbGVjdGlvbiA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKENoYW5uZWxDb2xsZWN0aW9uLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgZGF0YSBjaGFubmVsIGlzIGF2YWlsYWJsZVxuICAgICAqIEBldmVudCBkYXRhX2NoYW5uZWxfYWRkZWRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBjaGFubmVsXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIG9mIHRoZSBjaGFubmVsXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBDaGFubmVsQ29sbGVjdGlvbigpIHtcbiAgICAgIHRoaXMuY2hhbm5lbHMgPSB7fTtcbiAgICAgIHRoaXMuZGVmZXJzID0ge307XG4gICAgICB0aGlzLnBlbmRpbmcgPSB7fTtcbiAgICAgIHRoaXMud2FpdF9kID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLndhaXRfcCA9IHRoaXMud2FpdF9kLnByb21pc2U7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGxvY2FsIGNoYW5uZWwgZGVzY3JpcHRpb24uXG4gICAgICogQG1ldGhvZCBzZXRMb2NhbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIE9iamVjdCBkZXNjcmliaW5nIGVhY2ggb2ZmZXJlZCBEYXRhQ2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLnNldExvY2FsID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdGhpcy5sb2NhbCA9IGRhdGE7XG4gICAgICBpZiAodGhpcy5yZW1vdGUgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByZW1vdGUgY2hhbm5lbCBkZXNjcmlwdGlvbi5cbiAgICAgKiBAbWV0aG9kIHNldFJlbW90ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIE9iamVjdCBkZXNjcmliaW5nIGVhY2ggb2ZmZXJlZCBEYXRhQ2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLnNldFJlbW90ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHRoaXMucmVtb3RlID0gZGF0YTtcbiAgICAgIGlmICh0aGlzLmxvY2FsICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VwZGF0ZSgpO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE1hdGNoZXMgcmVtb3RlIGFuZCBsb2NhbCBkZXNjcmlwdGlvbnMgYW5kIGNyZWF0ZXMgcHJvbWlzZXMgY29tbW9uIERhdGFDaGFubmVsc1xuICAgICAqIEBtZXRob2QgX3VwZGF0ZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuX3VwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNoYW5uZWwsIGNvbmZpZywgZGVmZXIsIG5hbWUsIHJlZjE7XG4gICAgICByZWYxID0gdGhpcy5yZW1vdGU7XG4gICAgICBmb3IgKG5hbWUgaW4gcmVmMSkge1xuICAgICAgICBjb25maWcgPSByZWYxW25hbWVdO1xuICAgICAgICBpZiAodGhpcy5sb2NhbFtuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuY2hhbm5lbHNbbmFtZV0gIT0gbnVsbCkge1xuXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBlbmRpbmdbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY2hhbm5lbCA9IHRoaXMucGVuZGluZ1tuYW1lXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdbbmFtZV07XG4gICAgICAgICAgICB0aGlzLmNoYW5uZWxzW25hbWVdID0gUHJvbWlzZS5yZXNvbHZlKGNoYW5uZWwpO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdkYXRhX2NoYW5uZWxfYWRkZWQnLCBuYW1lLCB0aGlzLmNoYW5uZWxzW25hbWVdKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbbmFtZV0gPSBkZWZlci5wcm9taXNlO1xuICAgICAgICAgICAgdGhpcy5kZWZlcnNbbmFtZV0gPSBkZWZlcjtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgdGhpcy5jaGFubmVsc1tuYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiRGF0YUNoYW5uZWwgb2ZmZXJlZCBieSByZW1vdGUgYnV0IG5vdCBieSBsb2NhbFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChuYW1lIGluIHRoaXMubG9jYWwpIHtcbiAgICAgICAgaWYgKHRoaXMucmVtb3RlW25hbWVdID09IG51bGwpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkRhdGFDaGFubmVsIG9mZmVyZWQgYnkgbG9jYWwgYnV0IG5vdCBieSByZW1vdGVcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLndhaXRfZC5yZXNvbHZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZXMgcHJvbWlzZXMgd2FpdGluZyBmb3IgdGhlIGdpdmVuIERhdGFDaGFubmVsXG4gICAgICogQG1ldGhvZCByZXNvbHZlXG4gICAgICogQHBhcmFtIHtEYXRhQ2hhbm5lbH0gY2hhbm5lbCBUaGUgbmV3IGNoYW5uZWxcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAgdmFyIGxhYmVsO1xuICAgICAgbGFiZWwgPSBjaGFubmVsLmxhYmVsKCk7XG4gICAgICBpZiAodGhpcy5kZWZlcnNbbGFiZWxdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZWZlcnNbbGFiZWxdLnJlc29sdmUoY2hhbm5lbCk7XG4gICAgICAgIHJldHVybiBkZWxldGUgdGhpcy5kZWZlcnNbbGFiZWxdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGVuZGluZ1tsYWJlbF0gPSBjaGFubmVsO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBhIHByb21pc2UgdG8gYSBEYXRhQ2hhbm5lbC4gV2lsbCByZXNvbHZlIGlmIERhdGFDaGFubmVsIHdhcyBvZmZlcmVkIGFuZCBnZXRzIGluaXRpYXRlZC4gTWlnaHQgcmVqZWN0IGFmdGVyIHJlbW90ZSBhbmQgbG9jYWwgZGVzY3JpcHRpb24gYXJlIHByb2Nlc3NlZC5cbiAgICAgKiBAbWV0aG9kIGdldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBsYWJlbCBvZiB0aGUgY2hhbm5lbCB0byBnZXRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IERhdGFDaGFubmVsfSBQcm9taXNlIGZvciB0aGUgRGF0YUNoYW5uZWxcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy53YWl0X3AudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChfdGhpcy5jaGFubmVsc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbHNbbmFtZV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRhdGFDaGFubmVsIG5vdCBuZWdvdGlhdGVkXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENoYW5uZWxDb2xsZWN0aW9uO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG5cbi8qKlxuICogQWxpYXMgZm9yIG5hdGl2ZSBwcm9taXNlcyBvciBhIHBvbHlmaWxsIGlmIG5vdCBzdXBwb3J0ZWRcbiAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gKiBAY2xhc3MgcnRjLmludGVybmFsLlByb21pc2VcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIGV4cG9ydHMuUHJvbWlzZSA9IGdsb2JhbC5Qcm9taXNlIHx8IHJlcXVpcmUoJ2VzNi1wcm9taXNlJykuUHJvbWlzZTtcblxuXG4gIC8qKlxuICAgKiBIZWxwZXIgdG8gaW1wbGVtZW50IGRlZmVycmVkIGV4ZWN1dGlvbiB3aXRoIHByb21pc2VzXG4gICAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gICAqIEBjbGFzcyBydGMuaW50ZXJuYWwuRGVmZXJyZWRcbiAgICovXG5cblxuICAvKipcbiAgICogUmVzb2x2ZXMgdGhlIHByb21pc2VcbiAgICogQG1ldGhvZCByZXNvbHZlXG4gICAqIEBwYXJhbSBbZGF0YV0gVGhlIHBheWxvYWQgdG8gd2hpY2ggdGhlIHByb21pc2Ugd2lsbCByZXNvbHZlXG4gICNcbiAgICogQGV4YW1wbGVcbiAgICogICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpXG4gICAqICAgICBkZWZlci5yZXNvbHZlKDQyKTtcbiAgICogICAgIGRlZmVyLnByb21pc2UudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICogICAgICAgY29uc29sZS5sb2cocmVzKTsgICAvLyA0MlxuICAgKiAgICAgfVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZWplY3QgdGhlIHByb21pc2VcbiAgICogQG1ldGhvZCByZWplY3RcbiAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIHBheWxvYWQgdG8gd2hpY2ggdGhlIHByb21pc2Ugd2lsbCByZXNvbHZlXG4gICNcbiAgICogQGV4YW1wbGVcbiAgICogICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpXG4gICAqICAgICBkZWZlci5yZWplY3QobmV3IEVycm9yKFwiUmVqZWN0IGJlY2F1c2Ugd2UgY2FuIVwiKSk7XG4gICAqICAgICBkZWZlci5wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgKiAgICAgICAvLyB3b250IGhhcHBlblxuICAgKiAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAqICAgICAgIC8vIHdpbGwgaGFwcGVuXG4gICAqICAgICB9XG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFRoZSBwcm9taXNlIHdoaWNoIHdpbGwgZ2V0IHJlc29sdmVkIG9yIHJlamVjdGVkIGJ5IHRoaXMgZGVmZXJyZWRcbiAgICogQHByb3BlcnR5IHtQcm9taXNlfSBwcm9taXNlXG4gICAqL1xuXG4gIGV4cG9ydHMuRGVmZXJyZWQgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gRGVmZXJyZWQoKSB7XG4gICAgICB0aGlzLnByb21pc2UgPSBuZXcgZXhwb3J0cy5Qcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgX3RoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnJlamVjdCA9IHJlamVjdDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gRGVmZXJyZWQ7XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4vcHJvbWlzZScpLkRlZmVycmVkO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBIZWxwZXIgaGFuZGxpbmcgdGhlIG1hcHBpbmcgb2Ygc3RyZWFtcyBmb3IgUmVtb3RlUGVlclxuICAgKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICAgKiBAY2xhc3MgcnRjLmludGVybmFsLlN0cmVhbUNvbGxlY3Rpb25cbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG5cbiAgZXhwb3J0cy5TdHJlYW1Db2xsZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoU3RyZWFtQ29sbGVjdGlvbiwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IHN0cmVhbSB3YXMgYWRkZWQgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgKiBAZXZlbnQgc3RlYW1fYWRkZWRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgdXNlciBkZWZpbmVkIG5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBzdHJlYW0gUHJvbWlzZSB0byB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBTdHJlYW1Db2xsZWN0aW9uKCkge1xuXG4gICAgICAvKipcbiAgICAgICAqIENvbnRhaW5zIHRoZSBwcm9taXNlcyB3aGljaCB3aWxsIHJlc29sdmUgdG8gdGhlIHN0cmVhbXNcbiAgICAgICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBzdHJlYW1zXG4gICAgICAgKi9cbiAgICAgIHRoaXMuc3RyZWFtcyA9IHt9O1xuICAgICAgdGhpcy5fZGVmZXJzID0ge307XG4gICAgICB0aGlzLl93YWl0aW5nID0ge307XG4gICAgICB0aGlzLl9wZW5kaW5nID0ge307XG4gICAgICB0aGlzLndhaXRfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy53YWl0X3AgPSB0aGlzLndhaXRfZC5wcm9taXNlO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogU2V0IHN0cmVhbSBkZXNjcmlwdGlvbiBhbmQgZ2VuZXJhdGUgcHJvbWlzZXNcbiAgICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgICAqIEBwYXJhbSBkYXRhIHtPYmplY3R9IEFuIG9iamVjdCBtYXBwaW5nIHRoZSBzdHJlYW0gaWRzIHRvIHN0cmVhbSBuYW1lc1xuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdmFyIGRlZmVyLCBpLCBpZCwgbGVuLCBtZW1iZXJzLCBuYW1lLCByZWYsIHN0cmVhbSwgc3RyZWFtX3A7XG4gICAgICBtZW1iZXJzID0gW107XG4gICAgICB0aGlzLl93YWl0aW5nID0ge307XG4gICAgICByZWYgPSB0aGlzLnN0cmVhbXM7XG4gICAgICBmb3IgKHN0cmVhbV9wID0gaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IHN0cmVhbV9wID0gKytpKSB7XG4gICAgICAgIG5hbWUgPSByZWZbc3RyZWFtX3BdO1xuICAgICAgICBpZiAoZGF0YVtuYW1lXSA9PSBudWxsKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICAgICAgICB0aGlzLmVtaXQoJ3N0cmVhbV9yZW1vdmVkJywgbmFtZSk7XG4gICAgICAgICAgaWYgKHN0cmVhbV9wLmlzRnVsbGZpbGxlZCgpKSB7XG4gICAgICAgICAgICBzdHJlYW1fcC50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgICAgICByZXR1cm4gc3RyZWFtLmNsb3NlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0cmVhbV9wLmlzUGVuZGluZygpKSB7XG4gICAgICAgICAgICBzdHJlYW1fcC5yZWplY3QobmV3IEVycm9yKFwiU3RyZWFtIHJlbW92ZWQgYmVmb3JlIGJlaW5nIGVzdGFibGlzaGVkXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAobmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlkID0gZGF0YVtuYW1lXTtcbiAgICAgICAgaWYgKHRoaXMuc3RyZWFtc1tuYW1lXSA9PSBudWxsKSB7XG4gICAgICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgICB0aGlzLnN0cmVhbXNbbmFtZV0gPSBkZWZlci5wcm9taXNlO1xuICAgICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXSA9IGRlZmVyO1xuICAgICAgICAgIHRoaXMuZW1pdCgnc3RyZWFtX2FkZGVkJywgbmFtZSwgZGVmZXIucHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2RlZmVyc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX3BlbmRpbmdbaWRdICE9IG51bGwpIHtcbiAgICAgICAgICAgIHN0cmVhbSA9IHRoaXMuX3BlbmRpbmdbaWRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3BlbmRpbmdbaWRdO1xuICAgICAgICAgICAgdGhpcy5fZGVmZXJzW25hbWVdLnJlc29sdmUoc3RyZWFtKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9kZWZlcnNbbmFtZV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3dhaXRpbmdbaWRdID0gbmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLndhaXRfZC5yZXNvbHZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIHN0cmVhbSB0byB0aGUgY29sbGVjdGlvbiBhbmQgcmVzb2x2ZSBwcm9taXNlcyB3YWl0aW5nIGZvciBpdFxuICAgICAqIEBtZXRob2QgcmVzb2x2ZVxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtXG4gICAgICovXG5cbiAgICBTdHJlYW1Db2xsZWN0aW9uLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICB2YXIgaWQsIG5hbWU7XG4gICAgICBpZCA9IHN0cmVhbS5pZCgpO1xuICAgICAgaWYgKHRoaXMuX3dhaXRpbmdbaWRdICE9IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuX3dhaXRpbmdbaWRdO1xuICAgICAgICBkZWxldGUgdGhpcy5fd2FpdGluZ1tpZF07XG4gICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXS5yZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgIHJldHVybiBkZWxldGUgdGhpcy5fZGVmZXJzW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BlbmRpbmdbaWRdID0gc3RyZWFtO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldHMgYSBwcm9taXNlIGZvciBhIHN0cmVhbSB3aXRoIHRoZSBnaXZlbiBuYW1lLiBNaWdodCBiZSByZWplY3RlZCBhZnRlciBgdXBkYXRlKClgXG4gICAgI1xuICAgICAqIEBtZXRob2QgZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBUaGUgcHJvbWlzZSBmb3IgdGhlIGBydGMuU3RyZWFtYFxuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMud2FpdF9wLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoX3RoaXMuc3RyZWFtc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU3RyZWFtIG5vdCBvZmZlcmVkXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFN0cmVhbUNvbGxlY3Rpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIGV4cG9ydHMsIGV4dGVuZDtcblxuICBleHRlbmQgPSBmdW5jdGlvbihyb290LCBvYmopIHtcbiAgICB2YXIga2V5LCB2YWx1ZTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgIHZhbHVlID0gb2JqW2tleV07XG4gICAgICByb290W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGV4cG9ydHM7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0ge1xuICAgIGludGVybmFsOiB7fSxcbiAgICBzaWduYWxpbmc6IHt9XG4gIH07XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9yZW1vdGVfcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9sb2NhbF9wZWVyJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3BlZXJfY29ubmVjdGlvbicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9zdHJlYW0nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vY29tcGF0JykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3Jvb20nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vdmlkZW9fZWxlbWVudCcpKTtcblxuICBleHRlbmQoZXhwb3J0cy5pbnRlcm5hbCwgcmVxdWlyZSgnLi9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbicpKTtcblxuICBleHRlbmQoZXhwb3J0cy5pbnRlcm5hbCwgcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL3dlYl9zb2NrZXRfY2hhbm5lbCcpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcnKSk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBQZWVyLCBTdHJlYW0sXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBQZWVyID0gcmVxdWlyZSgnLi9wZWVyJykuUGVlcjtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhbCB1c2VyIG9mIHRoZSByb29tXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqIEBjbGFzcyBydGMuTG9jYWxQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIGV4cG9ydHMuTG9jYWxQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTG9jYWxQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIExvY2FsUGVlcigpIHtcblxuICAgICAgLyoqXG4gICAgICAgKiBDb250YWlucyBsb2NhbCBzdHJlYW1zIG9mZmVyZWQgdG8gYWxsIHJlbW90ZSBwZWVyc1xuICAgICAgICogQHByb3BlcnR5IHN0cmVhbXNcbiAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICovXG4gICAgICB0aGlzLnN0cmVhbXMgPSB7fTtcblxuICAgICAgLyoqXG4gICAgICAgKiBDb250YWlucyBhbGwgRGF0YUNoYW5uZWwgY29uZmlndXJhdGlvbnMgbmVnb3RpYXRlZCB3aXRoIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgICAqIEBwcm9wZXJ0eSBjaGFubmVsc1xuICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgKi9cbiAgICAgIHRoaXMuY2hhbm5lbHMgPSB7fTtcbiAgICAgIHRoaXMuX3N0YXR1cyA9IHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogR2V0IGFuIGl0ZW0gb2YgdGhlIHN0YXR1cyB0cmFuc2ZlcnJlZCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBzdGF0dXNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHZhbHVlLiBXaWxsIHJldHVyblxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgYW4gaXRlbSBvZiB0aGUgc3RhdHVzIHRyYW5zZmVycmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUuIFdpbGwgcmV0dXJuXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBzdG9yZVxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9zdGF0dXNba2V5XSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgdGhpcy5fc3RhdHVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXNba2V5XTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgZGF0YSBjaGFubmVsIHdoaWNoIHdpbGwgYmUgbmVnb3RpYXRlZCB3aXRoIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIGFkZERhdGFDaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdkYXRhJ10gTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtkZXNjXSBPcHRpb25zIHBhc3NlZCB0byBgUlRDRGF0YUNoYW5uZWwuY3JlYXRlRGF0YUNoYW5uZWwoKWBcbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuYWRkRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihuYW1lLCBkZXNjKSB7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2MgPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX0NIQU5ORUw7XG4gICAgICB9XG4gICAgICBpZiAoZGVzYyA9PSBudWxsKSB7XG4gICAgICAgIGRlc2MgPSB7XG4gICAgICAgICAgb3JkZXJlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5jaGFubmVsc1tuYW1lXSA9IGRlc2M7XG4gICAgICB0aGlzLmVtaXQoJ2NvbmZpZ3VyYXRpb25fY2hhbmdlZCcpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW0gdG8gYmUgc2VudCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBhZGRTdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7UHJvbWlzZSAtPiBydGMuU3RyZWFtIHwgcnRjLlN0cmVhbSB8IE9iamVjdH0gc3RyZWFtIFRoZSBzdHJlYW0sIGEgcHJvbWlzZSB0byB0aGUgc3RyZWFtIG9yIHRoZSBjb25maWd1cmF0aW9uIHRvIGNyZWF0ZSBhIHN0cmVhbSB3aXRoIGBydGMuU3RyZWFtLmNyZWF0ZVN0cmVhbSgpYFxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihuYW1lLCBvYmopIHtcbiAgICAgIHZhciBzYXZlU3RyZWFtLCBzdHJlYW1fcDtcbiAgICAgIHNhdmVTdHJlYW0gPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbV9wKSB7XG4gICAgICAgICAgX3RoaXMuc3RyZWFtc1tuYW1lXSA9IHN0cmVhbV9wO1xuICAgICAgICAgIF90aGlzLmVtaXQoJ2NvbmZpZ3VyYXRpb25fY2hhbmdlZCcpO1xuICAgICAgICAgIHJldHVybiBzdHJlYW1fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIGlmICgob2JqICE9IG51bGwgPyBvYmoudGhlbiA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShvYmopO1xuICAgICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oUHJvbWlzZS5yZXNvbHZlKG9iaikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyZWFtX3AgPSBTdHJlYW0uY3JlYXRlU3RyZWFtKG9iaik7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKHN0cmVhbV9wKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgbG9jYWwgc3RyZWFtXG4gICAgICogQG1ldGhvZCBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5zdHJlYW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIExvY2FsUGVlcjtcblxuICB9KShQZWVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlcixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBBIHVzZXIgaW4gdGhlIHJvb21cbiAgICogQG1vZHVsZSBydGNcbiAgICogQGNsYXNzIHJ0Yy5QZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFBlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gUGVlcigpIHtcbiAgICAgIHJldHVybiBQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXR1cyBvZiB0aGUgcGVlciBoYXMgY2hhbmdlZFxuICAgICAqIEBldmVudCBzdGF0dXNfY2hhbmdlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgS2V5IG9mIHRoZSBjaGFuZ2VkIHN0YXRzXG4gICAgICogQHBhcmFtIHZhbHVlIFZhbHVlIG9mIHRoZSBjaGFuZ2VkIHN0YXR1c1xuICAgICAqL1xuXG4gICAgUGVlci5wcm90b3R5cGUuREVGQVVMVF9DSEFOTkVMID0gJ2RhdGEnO1xuXG4gICAgUGVlci5wcm90b3R5cGUuREVGQVVMVF9TVFJFQU0gPSAnc3RyZWFtJztcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgdmFsdWUgb2YgdGhlIHN0YXR1cyBvYmplY3RcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBcbiAgICAgKiBAcmV0dXJuIFRoZSB2YWx1ZVxuICAgICAqL1xuXG4gICAgUGVlci5wcm90b3R5cGUuc3RhdHVzID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEYXRhQ2hhbm5lbCwgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgU3RyZWFtLCBjb21wYXQsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZCwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuICBEYXRhQ2hhbm5lbCA9IHJlcXVpcmUoJy4vZGF0YV9jaGFubmVsJykuRGF0YUNoYW5uZWw7XG5cbiAgY29tcGF0ID0gcmVxdWlyZSgnLi9jb21wYXQnKS5jb21wYXQ7XG5cblxuICAvKipcbiAgICogQGNsYXNzIHJ0Yy5QZWVyQ29ubmVjdGlvblxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuICBleHBvcnRzLlBlZXJDb25uZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGVlckNvbm5lY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gUGVlckNvbm5lY3Rpb24ob2ZmZXJpbmcsIG9wdGlvbnMxKSB7XG4gICAgICB0aGlzLm9mZmVyaW5nID0gb2ZmZXJpbmc7XG4gICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zMTtcbiAgICAgIHRoaXMucGMgPSBuZXcgY29tcGF0LlBlZXJDb25uZWN0aW9uKHRoaXMuX2ljZU9wdGlvbnMoKSk7XG4gICAgICB0aGlzLmNvbm5lY3RfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nX3BlbmRpbmcgPSBbXTtcbiAgICAgIHRoaXMucGMub25pY2VjYW5kaWRhdGUgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2ljZV9jYW5kaWRhdGUnLCBldmVudC5jYW5kaWRhdGUpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uYWRkc3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdHJlYW1fYWRkZWQnLCBuZXcgU3RyZWFtKGV2ZW50LnN0cmVhbSkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uZGF0YWNoYW5uZWwgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChldmVudC5jaGFubmVsKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25yZW1vdmVzdHJlYW0gPSBmdW5jdGlvbihldmVudCkge307XG4gICAgICB0aGlzLnBjLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKCdvbm5lZ290aWF0aW9ubmVlZGVkIGNhbGxlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcmVmMTtcbiAgICAgICAgICBpZiAoX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZmFpbGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0RXJyb3IobmV3IEVycm9yKFwiVW5hYmxlIHRvIGVzdGFibGlzaCBJQ0UgY29ubmVjdGlvblwiKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChfdGhpcy5wYy5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdjbG9zZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY29ubmVjdF9kLnJlamVjdChuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gd2FzIGNsb3NlZCcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKChyZWYxID0gX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlKSA9PT0gJ2Nvbm5lY3RlZCcgfHwgcmVmMSA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jb25uZWN0X2QucmVzb2x2ZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5wYy5vbnNpZ25hbGluZ3N0YXRlY2hhbmdlID0gZnVuY3Rpb24oZXZlbnQpIHt9O1xuICAgIH1cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5zaWduYWxpbmcgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgc2RwO1xuICAgICAgc2RwID0gbmV3IGNvbXBhdC5TZXNzaW9uRGVzY3JpcHRpb24oZGF0YSk7XG4gICAgICByZXR1cm4gdGhpcy5fc2V0UmVtb3RlRGVzY3JpcHRpb24oc2RwKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGRhdGEudHlwZSA9PT0gJ29mZmVyJyAmJiBfdGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5fYW5zd2VyKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpW1wiY2F0Y2hcIl0oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RFcnJvcihlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuYWRkSWNlQ2FuZGlkYXRlID0gZnVuY3Rpb24oZGVzYykge1xuICAgICAgdmFyIGNhbmRpZGF0ZTtcbiAgICAgIGlmIChkZXNjLmNhbmRpZGF0ZSAhPSBudWxsKSB7XG4gICAgICAgIGNhbmRpZGF0ZSA9IG5ldyBjb21wYXQuSWNlQ2FuZGlkYXRlKGRlc2MpO1xuICAgICAgICByZXR1cm4gdGhpcy5wYy5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhcIklDRSB0cmlja2xpbmcgc3RvcHBlZFwiKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9pY2VPcHRpb25zID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VydmVycztcbiAgICAgIHNlcnZlcnMgPSBbXTtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3R1biAhPSBudWxsKSB7XG4gICAgICAgIHNlcnZlcnMucHVzaCh7XG4gICAgICAgICAgdXJsOiB0aGlzLm9wdGlvbnMuc3R1blxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGljZVNlcnZlcnM6IHNlcnZlcnNcbiAgICAgIH07XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fb2FPcHRpb25zID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcHRpb25hbDogW10sXG4gICAgICAgIG1hbmRhdG9yeToge1xuICAgICAgICAgIE9mZmVyVG9SZWNlaXZlQXVkaW86IHRydWUsXG4gICAgICAgICAgT2ZmZXJUb1JlY2VpdmVWaWRlbzogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX3NldFJlbW90ZURlc2NyaXB0aW9uID0gZnVuY3Rpb24oc2RwKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICB2YXIgZGVzY3JpcHRpb247XG4gICAgICAgICAgZGVzY3JpcHRpb24gPSBuZXcgcnRjLmNvbXBhdC5TZXNzaW9uRGVzY3JpcHRpb24oc2RwKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGMuc2V0UmVtb3RlRGVzY3JpcHRpb24oc2RwLCByZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX29mZmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGMuY3JlYXRlT2ZmZXIocmVzb2x2ZSwgcmVqZWN0LCBfdGhpcy5fb2FPcHRpb25zKCkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzZHApIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX3Byb2Nlc3NMb2NhbFNkcChzZHApO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpW1wiY2F0Y2hcIl0oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RFcnJvcihlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Fuc3dlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLmNyZWF0ZUFuc3dlcihyZXNvbHZlLCByZWplY3QsIF90aGlzLl9vYU9wdGlvbnMoKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNkcCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fcHJvY2Vzc0xvY2FsU2RwKHNkcCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fcHJvY2Vzc0xvY2FsU2RwID0gZnVuY3Rpb24oc2RwKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICB2YXIgc3VjY2VzcztcbiAgICAgICAgICBzdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZGF0YTtcbiAgICAgICAgICAgIGRhdGEgPSB7XG4gICAgICAgICAgICAgIHNkcDogc2RwLnNkcCxcbiAgICAgICAgICAgICAgdHlwZTogc2RwLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBfdGhpcy5lbWl0KCdzaWduYWxpbmcnLCBkYXRhKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHNkcCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGMuc2V0TG9jYWxEZXNjcmlwdGlvbihzZHAsIHN1Y2Nlc3MsIHJlamVjdCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fY29ubmVjdEVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICB0aGlzLmNvbm5lY3RfZC5yZWplY3QoZXJyKTtcbiAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHJldHVybiB0aGlzLnBjLmFkZFN0cmVhbShzdHJlYW0uc3RyZWFtKTtcbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLnJlbW92ZVNyZWFtID0gZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYy5yZW1vdmVTdHJlYW0oc3RyZWFtLnN0cmVhbSk7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGREYXRhQ2hhbm5lbCA9IGZ1bmN0aW9uKG5hbWUsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjaGFubmVsO1xuICAgICAgaWYgKHRoaXMub2ZmZXJpbmcpIHtcbiAgICAgICAgY2hhbm5lbCA9IHRoaXMucGMuY3JlYXRlRGF0YUNoYW5uZWwobmFtZSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBjaGFubmVsLm9ub3BlbiA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdkYXRhX2NoYW5uZWxfcmVhZHknLCBuZXcgRGF0YUNoYW5uZWwoY2hhbm5lbCkpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCF0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICBpZiAodGhpcy5vZmZlcmluZykge1xuICAgICAgICAgIHRoaXMuX29mZmVyKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wYy5zaWduYWxpbmdTdGF0ZSA9PT0gJ2hhdmUtcmVtb3RlLW9mZmVyJykge1xuICAgICAgICAgIHRoaXMuX2Fuc3dlcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucGMuY2xvc2UoKTtcbiAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgIH07XG5cbiAgICByZXR1cm4gUGVlckNvbm5lY3Rpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIENoYW5uZWxDb2xsZWN0aW9uLCBQZWVyLCBQcm9taXNlLCBTdHJlYW1Db2xsZWN0aW9uLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgUHJvbWlzZSA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLlByb21pc2U7XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cbiAgU3RyZWFtQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24nKS5TdHJlYW1Db2xsZWN0aW9uO1xuXG4gIENoYW5uZWxDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKS5DaGFubmVsQ29sbGVjdGlvbjtcblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgcmVtb3RlIHVzZXIgb2YgdGhlIHJvb21cbiAgICogQG1vZHVsZSBydGNcbiAgICogQGNsYXNzIHJ0Yy5SZW1vdGVQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLlBlZXJDb25uZWN0aW9ufSBwZWVyX2Nvbm5lY3Rpb24gVGhlIHVuZGVybHlpbmcgcGVlciBjb25uZWN0aW9uXG4gICAqIEBwYXJhbSB7cnRjLlNpZ25hbGluZ1BlZXJ9IHNpZ25hbGluZyBUaGUgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICogQHBhcmFtIHtydGMuTG9jYWxQZWVyfSBsb2NhbCBUaGUgbG9jYWwgcGVlclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBUaGUgb3B0aW9ucyBvYmplY3QgYXMgcGFzc2VkIHRvIGBSb29tYFxuICAgKi9cblxuICBleHBvcnRzLlJlbW90ZVBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChSZW1vdGVQZWVyLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogTWVzc2FnZSByZWNlaXZlZCBmcm9tIHBlZXIgdGhyb3VnaCBzaWduYWxpbmdcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkIG9mIHRoZSBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW1vdGUgcGVlciBsZWZ0IG9yIHNpZ25hbGluZyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBzdHJlYW0gaXMgYXZhaWxhYmxlIGZyb20gdGhlIHBlZXJcbiAgICAgKiBAZXZlbnQgc3RyZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgZGF0YSBjaGFubmVsIGlzIGF2YWlsYWJsZSBmcm9tIHRoZSBwZWVyXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gc3RyZWFtIFByb21pc2Ugb2YgdGhlIGNoYW5uZWxcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFJlbW90ZVBlZXIocGVlcl9jb25uZWN0aW9uLCBzaWduYWxpbmcsIGxvY2FsLCBvcHRpb25zMSkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24gPSBwZWVyX2Nvbm5lY3Rpb247XG4gICAgICB0aGlzLnNpZ25hbGluZyA9IHNpZ25hbGluZztcbiAgICAgIHRoaXMubG9jYWwgPSBsb2NhbDtcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMxO1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbiA9IG5ldyBTdHJlYW1Db2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLnN0cmVhbXMgPSB0aGlzLnN0cmVhbV9jb2xsZWN0aW9uLnN0cmVhbXM7XG4gICAgICB0aGlzLnN0cmVhbXNfZGVzYyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihuYW1lLCBzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RyZWFtX2FkZGVkJywgbmFtZSwgc3RyZWFtKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uID0gbmV3IENoYW5uZWxDb2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLmNoYW5uZWxzID0gdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uY2hhbm5lbHM7XG4gICAgICB0aGlzLmNoYW5uZWxzX2Rlc2MgPSB7fTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLm9uKCdkYXRhX2NoYW5uZWxfYWRkZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUsIGNoYW5uZWwpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgY2hhbm5lbCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtX2NvbGxlY3Rpb24ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2RhdGFfY2hhbm5lbF9yZWFkeScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24ucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBkYXRhLnN0cmVhbXMgPSBfdGhpcy5zdHJlYW1zX2Rlc2M7XG4gICAgICAgICAgZGF0YS5jaGFubmVscyA9IF90aGlzLmNoYW5uZWxzX2Rlc2M7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnNpZ25hbGluZy5zZW5kKCdzaWduYWxpbmcnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBfdGhpcy5zdHJlYW1fY29sbGVjdGlvbi51cGRhdGUoZGF0YS5zdHJlYW1zKTtcbiAgICAgICAgICBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uc2V0UmVtb3RlKGRhdGEuY2hhbm5lbHMpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uc2lnbmFsaW5nKGRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2ljZV9jYW5kaWRhdGUnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zaWduYWxpbmcuc2VuZCgnaWNlX2NhbmRpZGF0ZScsIGNhbmRpZGF0ZSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbignaWNlX2NhbmRpZGF0ZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBlZXJfY29ubmVjdGlvbi5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzdGF0dXNfY2hhbmdlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIGtleSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ21lc3NhZ2UnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ2xlZnQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF90aGlzLnBlZXJfY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdsZWZ0Jyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignY29ubmVjdGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHt9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7fTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIGlmICgodGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCA9PSBudWxsKSB8fCAhdGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCkge1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5zdGF0dXNba2V5XTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGEgbWVzc2FnZSB0byB0aGUgcGVlciB0aHJvdWdoIHNpZ25hbGluZ1xuICAgICAqIEBtZXRob2QgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBkYXRhIHdhcyBzZW50XG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5tZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLnNlbmQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRvIHRoZSByZW1vdGUgcGVlciB0byBleGNoYW5nZSBzdHJlYW1zIGFuZCBjcmVhdGUgZGF0YSBjaGFubmVsc1xuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCByZXNvbHZlZCB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbmFtZSwgcHJvbWlzZSwgcmVmLCBzdHJlYW0sIHN0cmVhbV9wcm9taXNlcztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHN0cmVhbV9wcm9taXNlcyA9IFtdO1xuICAgICAgICByZWYgPSB0aGlzLmxvY2FsLnN0cmVhbXM7XG4gICAgICAgIGZvciAobmFtZSBpbiByZWYpIHtcbiAgICAgICAgICBzdHJlYW0gPSByZWZbbmFtZV07XG4gICAgICAgICAgcHJvbWlzZSA9IHN0cmVhbS50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgICAgcmV0dXJuIFtuYW1lLCBzdHJlYW1dO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHN0cmVhbV9wcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29ubmVjdF9wID0gUHJvbWlzZS5hbGwoc3RyZWFtX3Byb21pc2VzKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW1zKSB7XG4gICAgICAgICAgICB2YXIgaSwgbGVuLCBvcHRpb25zLCByZWYxLCByZWYyO1xuICAgICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gc3RyZWFtcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICByZWYxID0gc3RyZWFtc1tpXSwgbmFtZSA9IHJlZjFbMF0sIHN0cmVhbSA9IHJlZjFbMV07XG4gICAgICAgICAgICAgIF90aGlzLnBlZXJfY29ubmVjdGlvbi5hZGRTdHJlYW0oc3RyZWFtKTtcbiAgICAgICAgICAgICAgX3RoaXMuc3RyZWFtc19kZXNjW25hbWVdID0gc3RyZWFtLmlkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWYyID0gX3RoaXMubG9jYWwuY2hhbm5lbHM7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gcmVmMikge1xuICAgICAgICAgICAgICBvcHRpb25zID0gcmVmMltuYW1lXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZERhdGFDaGFubmVsKG5hbWUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICBfdGhpcy5jaGFubmVsc19kZXNjW25hbWVdID0gb3B0aW9ucztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5zZXRMb2NhbChfdGhpcy5jaGFubmVsc19kZXNjKTtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY29ubmVjdCgpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKiBAbWV0aG9kIGNsb3NlXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzdHJlYW0gZnJvbSB0aGUgcGVlci4gSGFzIHRvIGJlIHNlbnQgYnkgdGhlIHJlbW90ZSBwZWVyIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gUHJvbWlzZSBvZiB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdHJlYW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtX2NvbGxlY3Rpb24uZ2V0KG5hbWUpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBhIGRhdGEgY2hhbm5lbCB0byB0aGUgcmVtb3RlIHBlZXIuIEhhcyB0byBiZSBhZGRlZCBieSBsb2NhbCBhbmQgcmVtb3RlIHNpZGUgdG8gc3VjY2VlZC5cbiAgICAgKiBAbWV0aG9kIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J2RhdGEnXSBOYW1lIG9mIHRoZSBkYXRhIGNoYW5uZWxcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5EYXRhQ2hhbm5lbH0gUHJvbWlzZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jaGFubmVsID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX0NIQU5ORUw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uZ2V0KG5hbWUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gUmVtb3RlUGVlcjtcblxuICB9KShQZWVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlciwgTG9jYWxQZWVyLCBNdWNTaWduYWxpbmcsIFBlZXJDb25uZWN0aW9uLCBSZW1vdGVQZWVyLCBXZWJTb2NrZXRDaGFubmVsLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIFdlYlNvY2tldENoYW5uZWwgPSByZXF1aXJlKCcuL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwuY29mZmVlJykuV2ViU29ja2V0Q2hhbm5lbDtcblxuICBNdWNTaWduYWxpbmcgPSByZXF1aXJlKCcuL3NpZ25hbGluZy9tdWNfc2lnbmFsaW5nLmNvZmZlZScpLk11Y1NpZ25hbGluZztcblxuICBSZW1vdGVQZWVyID0gcmVxdWlyZSgnLi9yZW1vdGVfcGVlci5jb2ZmZWUnKS5SZW1vdGVQZWVyO1xuXG4gIExvY2FsUGVlciA9IHJlcXVpcmUoJy4vbG9jYWxfcGVlci5jb2ZmZWUnKS5Mb2NhbFBlZXI7XG5cbiAgUGVlckNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL3BlZXJfY29ubmVjdGlvbi5jb2ZmZWUnKS5QZWVyQ29ubmVjdGlvbjtcblxuXG4gIC8qKlxuICAgKiBBIHZpcnR1YWwgcm9vbSB3aGljaCBjb25uZWN0cyBtdWx0aXBsZSBQZWVyc1xuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKiBAY2xhc3MgcnRjLlJvb21cbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIHJvb20uIFdpbGwgYmUgcGFzc2VkIG9uIHRvIHNpZ25hbGluZ1xuICAgKiBAcGFyYW0ge3J0Yy5TaWduYWxpbmcgfCBTdHJpbmd9IHNpZ25hbGluZyBUaGUgc2lnbmFsaW5nIHRvIGJlIHVzZWQuIElmIHlvdSBwYXNzIGEgc3RyaW5nIGl0IHdpbGwgYmUgaW50ZXJwcmV0ZWQgYXMgYSB3ZWJzb2NrZXQgYWRkcmVzcyBhbmQgYSBwYWxhdmEgc2lnbmFsaW5nIGNvbm5lY3Rpb24gd2lsbCBiZSBlc3RhYmxpc2hlZCB3aXRoIGl0LlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFZhcmlvdXMgb3B0aW9ucyB0byBiZSB1c2VkIGluIGNvbm5lY3Rpb25zIGNyZWF0ZWQgYnkgdGhpcyByb29tXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW29wdGlvbnMuYXV0b19jb25uZWN0PXRydWVdIFdoZXRoZXIgcmVtb3RlIHBlZXJzIGFyZSBjb25uZWN0ZWQgYXV0b21hdGljYWxseSBvciBhbiBleHBsaWNpdCBgUmVtb3RlUGVlci5jb25uZWN0KClgIGNhbGwgaXMgbmVlZGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5zdHVuXSBUaGUgVVJJIG9mIHRoZSBTVFVOIHNlcnZlciB0byB1c2VcbiAgICogQHBhcmFtIHtydGMuTG9jYWxQZWVyfSBbb3B0aW9ucy5sb2NhbF0gVGhlIGxvY2FsIHVzZXJcbiAgICovXG5cbiAgZXhwb3J0cy5Sb29tID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUm9vbSwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IHBlZXIgaXMgZW5jb3VudGVyZWQgaW4gdGhlIHJvb20uIEZpcmVzIG9uIG5ldyByZW1vdGUgcGVlcnMgYWZ0ZXIgam9pbmluZyBhbmQgZm9yIGFsbCBwZWVycyBpbiB0aGUgcm9vbSB3aGVuIGpvaW5pbmcuXG4gICAgICogQGV2ZW50IHBlZXJfam9waW5lZFxuICAgICAqIEBwYXJhbSB7cnRjLlJlbW90ZVBlZXJ9IHBlZXIgVGhlIG5ldyBwZWVyXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb25uZWN0aW9uIHRvIHRoZSByb29tIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBSb29tKHNpZ25hbGluZywgb3B0aW9ucykge1xuICAgICAgdmFyIGNoYW5uZWw7XG4gICAgICB0aGlzLnNpZ25hbGluZyA9IHNpZ25hbGluZztcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgIT0gbnVsbCA/IG9wdGlvbnMgOiB7fTtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zaWduYWxpbmcgPT09ICdzdHJpbmcnIHx8IHRoaXMuc2lnbmFsaW5nIGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgIGNoYW5uZWwgPSBuZXcgV2ViU29ja2V0Q2hhbm5lbCh0aGlzLnNpZ25hbGluZyk7XG4gICAgICAgIHRoaXMuc2lnbmFsaW5nID0gbmV3IE11Y1NpZ25hbGluZyhjaGFubmVsKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWwgPSB0aGlzLm9wdGlvbnMubG9jYWwgfHwgbmV3IExvY2FsUGVlcigpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ3BlZXJfam9pbmVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzaWduYWxpbmdfcGVlcikge1xuICAgICAgICAgIHZhciBwYywgcGVlcjtcbiAgICAgICAgICBwYyA9IG5ldyBQZWVyQ29ubmVjdGlvbihzaWduYWxpbmdfcGVlci5maXJzdCwgX3RoaXMub3B0aW9ucyk7XG4gICAgICAgICAgcGVlciA9IG5ldyBSZW1vdGVQZWVyKHBjLCBzaWduYWxpbmdfcGVlciwgX3RoaXMubG9jYWwsIF90aGlzLm9wdGlvbnMpO1xuICAgICAgICAgIF90aGlzLnBlZXJzW3NpZ25hbGluZ19wZWVyLmlkXSA9IHBlZXI7XG4gICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICByZXR1cm4gcGVlci5vbignY2xvc2VkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVsZXRlIF90aGlzLnBlZXJzW3NpZ25hbGluZ19wZWVyLmlkXTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcnMgPSB7fTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEpvaW5zIHRoZSByb29tLiBJbml0aWF0ZXMgY29ubmVjdGlvbiB0byBzaWduYWxpbmcgc2VydmVyIGlmIG5vdCBkb25lIGJlZm9yZS5cbiAgICAgKiBAbWV0aG9kIGpvaW5cbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBBIHByb21pc2Ugd2hpY2ggd2lsbCBiZSByZXNvbHZlZCBvbmNlIHRoZSByb29tIHdhcyBqb2luZWRcbiAgICAgKi9cblxuICAgIFJvb20ucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmpvaW5fcCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuam9pbl9wID0gdGhpcy5zaWduYWxpbmcuY29ubmVjdCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuam9pbl9wO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIExlYXZlcyB0aGUgcm9vbSBhbmQgY2xvc2VzIGFsbCBlc3RhYmxpc2hlZCBwZWVyIGNvbm5lY3Rpb25zXG4gICAgICogQG1ldGhvZCBsZWF2ZVxuICAgICAqL1xuXG4gICAgUm9vbS5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5sZWF2ZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsZWFucyB1cCBhbGwgcmVzb3VyY2VzIHVzZWQgYnkgdGhlIHJvb20uXG4gICAgICogQG1ldGhvZCBsZWF2ZVxuICAgICAqL1xuXG4gICAgUm9vbS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLmxlYXZlKCk7XG4gICAgfTtcblxuICAgIHJldHVybiBSb29tO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9wcm9taXNlJykuRGVmZXJyZWQ7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBwZWVyIGZvciBtdWx0aSB1c2VyIGNoYXRzLlxuICAjXG4gICAqIEZvciBhIGRldGFpbGVkIGRlc2NyaXB0aW9uIG9mIHRoZSBzaWduYWxpbmcgcHJvdG9jb2wgc2VlIGBydGMuc2lnbmFsaW5nLk11Y1NpZ25hbGluZ2BcbiAgI1xuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuTXVjU2lnbmFsaW5nUGVlclxuICAgKi9cblxuICBleHBvcnRzLk11Y1NpZ25hbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChNdWNTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIE11Y1NpZ25hbGluZ1BlZXIoY2hhbm5lbCwgcGVlcl9pZDEsIHN0YXR1czEsIGZpcnN0KSB7XG4gICAgICB2YXIgcmVjdl9tc2c7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5wZWVyX2lkID0gcGVlcl9pZDE7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1czE7XG4gICAgICB0aGlzLmZpcnN0ID0gZmlyc3Q7XG4gICAgICByZWN2X21zZyA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLnBlZXIgIT09IF90aGlzLnBlZXJfaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGEudHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAoZGF0YS50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdmcm9tJzpcbiAgICAgICAgICAgICAgaWYgKChkYXRhLmV2ZW50ID09IG51bGwpIHx8IChkYXRhLmRhdGEgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgICAgIGNhc2UgJ3BlZXJfbGVmdCc6XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX3N0YXR1cyc6XG4gICAgICAgICAgICAgIF90aGlzLnN0YXR1cyA9IGRhdGEuc3RhdHVzO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbmV3X3N0YXR1cycsIF90aGlzLnN0YXR1cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgfVxuXG4gICAgTXVjU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIHR5cGU6ICd0bycsXG4gICAgICAgIHBlZXI6IHRoaXMucGVlcl9pZCxcbiAgICAgICAgZXZlbnQ6IGV2ZW50LFxuICAgICAgICBkYXRhOiBkYXRhXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE11Y1NpZ25hbGluZ1BlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgZm9yIG11bHRpIHVzZXIgY2hhdHNcbiAgI1xuICAgKiBUaGUgZm9sbG93aW5nIG1lc3NhZ2VzIGFyZSBzZW50IHRvIHRoZSBzZXJ2ZXI6XG4gICNcbiAgICogICAgIC8vIGpvaW4gdGhlIHJvb21cbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwiam9pblwiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7fVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBsZWF2ZSB0aGUgcm9vbVxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJsZWF2ZVwiXG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHVwZGF0ZSBzdGF0dXNcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwic3RhdHVzXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHt9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHNlbmQgbWVzc2FnZSB0byBhIHBlZXJcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwidG9cIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiLFxuICAgKiAgICAgICBcImRhdGFcIjogeyAuLiBjdXN0b20gZGF0YSAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogVGhlIGZvbGxvd2luZyBtZXNzYWdlcyBhcmUgcmVjZWl2ZWQgZm9ybSB0aGUgc2VydmVyOlxuICAjXG4gICAqICAgICAvLyBqb2luZWQgdGhlIHJvb21cbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwiam9pbmVkXCIsXG4gICAqICAgICAgIFwicGVlcnNcIjoge1xuICAgKiAgICAgICAgIFwicGVlcl9pZFwiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICAgIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gcGVlciBqb2luZWQgdGhlIHJvb21cbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwicGVlcl9qb2luZWRcIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHBlZXIgdXBkYXRlZCBpdHMgc3RhdHVzXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInBlZXJfc3RhdHVzXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJzdGF0dXNcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBwZWVyIGxlZnRcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwicGVlcl9sZWZ0XCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIlxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBtZXNzYWdlIGZyb20gcGVlclxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJmcm9tXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJldmVudFwiOiBcImV2ZW50X2lkXCIsXG4gICAqICAgICAgIFwiZGF0YVwiOiB7IC4uIGN1c3RvbSBkYXRhIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiBUaGUgbWVzc2FnZXMgdHJhbnNtaXR0ZWQgaW4gdGhlIGB0b2AvYGZyb21gIG1lc3NhZ2VzIGFyZSBlbWl0dGVkIGFzIGV2ZW50cyBpbiBgTXVjU2lnbmFsaW5nUGVlcmBcbiAgI1xuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuTXVjU2lnbmFsaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuTXVjU2lnbmFsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTXVjU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIE11Y1NpZ25hbGluZyhjaGFubmVsLCBzdGF0dXMxKSB7XG4gICAgICB2YXIgam9pbl9kO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIGpvaW5fZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5qb2luX3AgPSBqb2luX2QucHJvbWlzZTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignY2xvc2VkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ21lc3NhZ2UnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICB2YXIgcGVlciwgcGVlcl9pZCwgcmVmLCBzdGF0dXM7XG4gICAgICAgICAgaWYgKGRhdGEudHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAoZGF0YS50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdqb2luZWQnOlxuICAgICAgICAgICAgICBpZiAoZGF0YS5wZWVycyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlZiA9IGRhdGEucGVlcnM7XG4gICAgICAgICAgICAgIGZvciAocGVlcl9pZCBpbiByZWYpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSByZWZbcGVlcl9pZF07XG4gICAgICAgICAgICAgICAgcGVlciA9IG5ldyBleHBvcnRzLk11Y1NpZ25hbGluZ1BlZXIoX3RoaXMuY2hhbm5lbCwgcGVlcl9pZCwgc3RhdHVzLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gam9pbl9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGNhc2UgJ3BlZXJfam9pbmVkJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIGRhdGEucGVlciwgZGF0YS5zdGF0dXMsIHRydWUpO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgTXVjU2lnbmFsaW5nLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbm5lY3RfcCA9IHRoaXMuY2hhbm5lbC5jb25uZWN0KCkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2pvaW4nLFxuICAgICAgICAgICAgICBzdGF0dXM6IF90aGlzLnN0YXR1c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmpvaW5fZDtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3A7XG4gICAgfTtcblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUuc2V0U3RhdHVzID0gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3AudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICAgICAgdHlwZTogJ3N0YXR1cycsXG4gICAgICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTXVjU2lnbmFsaW5nLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgdHlwZTogJ2xlYXZlJ1xuICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBNdWNTaWduYWxpbmc7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogU2lnbmFsaW5nIHBlZXIgY29tcGF0aWJsZSB3aXRoIHRoZSBmcmFtaW5nIG9mIHBhbGF2YSBzaWduYWxpbmdcbiAgI1xuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuUGFsYXZhU2lnbmFsaW5nUGVlclxuICAgKi9cblxuICBleHBvcnRzLlBhbGF2YVNpZ25hbGluZ1BlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQYWxhdmFTaWduYWxpbmdQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBhbGF2YVNpZ25hbGluZ1BlZXIoY2hhbm5lbCwgaWQsIHN0YXR1czEsIGZpcnN0KSB7XG4gICAgICB2YXIgcmVjdl9tc2c7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5pZCA9IGlkO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5maXJzdCA9IGZpcnN0O1xuICAgICAgcmVjdl9tc2cgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBpZiAoZGF0YS5zZW5kZXJfaWQgIT09IF90aGlzLmlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhLmV2ZW50ID09IG51bGwpIHtcbiAgICAgICAgICAgIF90aGlzLnNlbmQoJ2Vycm9yJywgXCJJbnZhbGlkIG1lc3NhZ2VcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIHJlY3ZfbXNnKTtcbiAgICAgIHRoaXMub24oJ3BlZXJfdXBkYXRlZF9zdGF0dXMnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCduZXdfc3RhdHVzJywgc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMub24oJ3BlZXJfbGVmdCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgUGFsYXZhU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIGV2ZW50OiAnc2VuZF90b19wZWVyJyxcbiAgICAgICAgcGVlcl9pZDogdGhpcy5pZCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gUGFsYXZhU2lnbmFsaW5nUGVlcjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBpbXBsZW1lbnRhdGlvbiBjb21wYXRpYmxlIHdpdGggdGhlIGZyYW1pbmcgb2YgcGFsYXZhIHNpZ25hbGluZ1xuICAjXG4gICAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5QYWxhdmFTaWduYWxpbmdcbiAgICovXG5cbiAgZXhwb3J0cy5QYWxhdmFTaWduYWxpbmcgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQYWxhdmFTaWduYWxpbmcsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gUGFsYXZhU2lnbmFsaW5nKGNoYW5uZWwsIHJvb20xLCBzdGF0dXMxKSB7XG4gICAgICB2YXIgam9pbl9kO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMucm9vbSA9IHJvb20xO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgICAgdGhpcy5qb2luZWQgPSBmYWxzZTtcbiAgICAgIGpvaW5fZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5qb2luX3AgPSBqb2luX2QucHJvbWlzZTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignY2xvc2VkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ21lc3NhZ2UnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICB2YXIgaSwgcGVlciwgcmVmO1xuICAgICAgICAgIGlmIChkYXRhLmV2ZW50ID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3dpdGNoIChkYXRhLmV2ZW50KSB7XG4gICAgICAgICAgICBjYXNlICdqb2luZWRfcm9vbSc6XG4gICAgICAgICAgICAgIGlmICgoZGF0YS5wZWVycyA9PSBudWxsKSB8fCAoZGF0YS5vd25faWQgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVmID0gZGF0YS5wZWVycztcbiAgICAgICAgICAgICAgZm9yIChpIGluIHJlZikge1xuICAgICAgICAgICAgICAgIGRhdGEgPSByZWZbaV07XG4gICAgICAgICAgICAgICAgcGVlciA9IG5ldyBleHBvcnRzLlBhbGF2YVNpZ25hbGluZ1BlZXIoX3RoaXMuY2hhbm5lbCwgZGF0YS5wZWVyX2lkLCBkYXRhLnN0YXR1cywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIF90aGlzLnBlZXJzW2RhdGEucGVlcl9pZF0gPSBwZWVyO1xuICAgICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGpvaW5fZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICBjYXNlICduZXdfcGVlcic6XG4gICAgICAgICAgICAgIGlmIChkYXRhLnBlZXJfaWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBkYXRhLnBlZXJfaWQsIGRhdGEuc3RhdHVzLCB0cnVlKTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcnNbZGF0YS5wZWVyXSA9IHBlZXI7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9XG5cbiAgICBQYWxhdmFTaWduYWxpbmcucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdF9wID0gdGhpcy5jaGFubmVsLmNvbm5lY3QoKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICAgICAgICBldmVudDogJ2pvaW5fcm9vbScsXG4gICAgICAgICAgICAgIHJvb21faWQ6IHJvb20sXG4gICAgICAgICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3A7XG4gICAgfTtcblxuICAgIFBhbGF2YVNpZ25hbGluZy5wcm90b3R5cGUuc2V0X3N0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgZXZlbnQ6ICd1cGRhdGVfc3RhdHVzJyxcbiAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBQYWxhdmFTaWduYWxpbmcucHJvdG90eXBlLmxlYXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLmNsb3NlKCk7XG4gICAgfTtcblxuICAgIHJldHVybiBQYWxhdmFTaWduYWxpbmc7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlciwgUHJvbWlzZSxcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIFByb21pc2UgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9wcm9taXNlJykuUHJvbWlzZTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLldlYlNvY2tldENoYW5uZWxcbiAgICovXG5cbiAgZXhwb3J0cy5XZWJTb2NrZXRDaGFubmVsID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoV2ViU29ja2V0Q2hhbm5lbCwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBXZWJTb2NrZXRDaGFubmVsKGFkZHJlc3MpIHtcbiAgICAgIHRoaXMuYWRkcmVzcyA9IGFkZHJlc3M7XG4gICAgfVxuXG4gICAgV2ViU29ja2V0Q2hhbm5lbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICB2YXIgc29ja2V0O1xuICAgICAgICAgICAgc29ja2V0ID0gbmV3IFdlYlNvY2tldChfdGhpcy5hZGRyZXNzKTtcbiAgICAgICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgX3RoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5zb2NrZXQ7XG4gICAgICAgICAgICAgIF90aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoXCJVbmFibGUgdG8gY29ubmVjdCB0byBzb2NrZXRcIikpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgICB2YXIgZGF0YTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgnZXJyb3InLCBcIlVuYWJsZSB0byBwYXJzZSBpbmNvbWluZyBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG4gICAgV2ViU29ja2V0Q2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgdmFyIGVycjtcbiAgICAgIGlmICh0aGlzLnNvY2tldCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgICAgIGVyciA9IF9lcnJvcjtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIlRyeWluZyB0byBzZW5kIG9uIFdlYlNvY2tldCB3aXRob3V0IGJlaW5nIGNvbm5lY3RlZFwiKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFdlYlNvY2tldENoYW5uZWwucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZXJyO1xuICAgICAgaWYgKHRoaXMuc29ja2V0ICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgZXJyID0gX2Vycm9yO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiVHJ5aW5nIHRvIGNsb3NlIFdlYlNvY2tldCB3aXRob3V0IGJlaW5nIGNvbm5lY3RlZFwiKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBXZWJTb2NrZXRDaGFubmVsO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBjb21wYXQ7XG5cbiAgY29tcGF0ID0gcmVxdWlyZSgnLi9jb21wYXQnKS5jb21wYXQ7XG5cblxuICAvKipcbiAgICogQSB3cmFwcGVyIGFyb3VuZCBhbiBIVE1MNSBNZWRpYVN0cmVhbVxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKiBAY2xhc3MgcnRjLlN0cmVhbVxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JUQ0RhdGFTdHJlYW19IHN0cmVhbSBUaGUgbmF0aXZlIHN0cmVhbVxuICAgKi9cblxuICBleHBvcnRzLlN0cmVhbSA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBTdHJlYW0oc3RyZWFtMSkge1xuICAgICAgdGhpcy5zdHJlYW0gPSBzdHJlYW0xO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBpZCBvZiB0aGUgc3RyZWFtLiBUaGlzIGlzIG5laXRoZXIgdXNlciBkZWZpbmVkIG5vciBodW1hbiByZWFkYWJsZS5cbiAgICAgKiBAbWV0aG9kIGlkXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBUaGUgaWQgb2YgdGhlIHVuZGVybHlpbmcgc3RyZWFtXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLmlkID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zdHJlYW0uaWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHN0cmVhbSBoYXMgYW55IHRyYWNrcyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICAgICAqIEBtZXRob2QgaGFzVHJhY2tzXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2JvdGgnXSBUaGUgdHlwZSBvZiB0cmFjayB0byBjaGVjayBmb3JcbiAgICAgKiBAcmV0dXJuIHtOdW1iZXJ9IFRoZSBhbW91bnQgb2YgdHJhY2tzIG9mIHRoZSBnaXZlbiB0eXBlXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLmhhc1RyYWNrcyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFRyYWNrcyh0eXBlKS5sZW5ndGg7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdHJhY2tzIG9mIHRoZSBnaXZlbiB0eXBlXG4gICAgICogQG1ldGhvZCBnZXRUcmFja3NcbiAgICAgKiBAcGFyYW0geydhdWRpbycgfCAndmlkZW8nIHwgJ2JvdGgnfSBbdHlwZT0nYm90aCddIFRoZSB0eXBlIG9mIHRyYWNrcyB0byBnZXRcbiAgICAgKiBAcmV0dXJuIHtBcnJheX0gQW4gQXJyYXkgb2YgdGhlIHRyYWNrc1xuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5nZXRUcmFja3MgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICB0eXBlID0gdHlwZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKHR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtX3AudGhlbihmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gc3RyZWFtLmdldEF1ZGlvVHJhY2tzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAndmlkZW8nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmVhbS5nZXRWaWRlb1RyYWNrcygpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgdmFyIHZhdWRpbywgdmlkZW87XG4gICAgICAgICAgdmlkZW8gPSBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKTtcbiAgICAgICAgICB2YXVkaW8gPSBzdHJlYW0uZ2V0QXVkaW9UcmFja3MoKTtcbiAgICAgICAgICByZXR1cm4gdmlkZW8uY29uY2F0KGF1ZGlvKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHN0cmVhbSBwYXJ0ICdcIiArIHR5cGUgKyBcIidcIik7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTXV0ZXMgb3IgdW5tdXRlcyB0cmFja3Mgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2QgbXV0ZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW211dGVkPXRydWVdIE11dGUgb24gYHRydWVgIGFuZCB1bm11dGUgb24gYGZhbHNlYFxuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdhdWRpbyddIFRoZSB0eXBlIG9mIHRyYWNrcyB0byBtdXRlIG9yIHVubXV0ZVxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHRyYWNrcyB3ZXJlIG11dGVkIG9yIHVubXV0ZWRcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUubXV0ZSA9IGZ1bmN0aW9uKG11dGVkLCB0eXBlKSB7XG4gICAgICB2YXIgaSwgbGVuLCByZWYsIHRyYWNrO1xuICAgICAgaWYgKG11dGVkID09IG51bGwpIHtcbiAgICAgICAgbXV0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGUgPT0gbnVsbCkge1xuICAgICAgICB0eXBlID0gJ2F1ZGlvJztcbiAgICAgIH1cbiAgICAgIHJlZiA9IGdldFRyYWNrcyh0eXBlKTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB0cmFjayA9IHJlZltpXTtcbiAgICAgICAgdHJhY2suZW5hYmxlZCA9ICFtdXRlZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtdXRlZDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSBtdXRlIHN0YXRlIG9mIHRyYWNrcyBvZiB0aGUgc3RyZWFtXG4gICAgICogQG1ldGhvZCB0b2dnbGVNdXRlXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2F1ZGlvJ10gVGhlIHR5cGUgb2YgdHJhY2tzIHRvIG11dGUgb3IgdW5tdXRlXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gV2hldGhlciB0aGUgdHJhY2tzIHdlcmUgbXV0ZWQgb3IgdW5tdXRlZFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS50b2dnbGVNdXRlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgdmFyIGksIGxlbiwgbXV0ZWQsIHJlZiwgdHJhY2ssIHRyYWNrcztcbiAgICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgICAgdHlwZSA9ICdhdWRpbyc7XG4gICAgICB9XG4gICAgICB0cmFja3MgPSBnZXRUcmFja3ModHlwZSk7XG4gICAgICBtdXRlZCA9ICEoKHJlZiA9IHRyYWNrc1swXSkgIT0gbnVsbCA/IHJlZi5lbmFibGVkIDogdm9pZCAwKTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHRyYWNrcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1tpXTtcbiAgICAgICAgdHJhY2suZW5hYmxlZCA9ICFtdXRlZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtdXRlZDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyB0aGUgc3RyZWFtXG4gICAgICogQG1ldGhvZCBzdG9wXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzdHJlYW0uc3RvcCgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzdHJlYW0gdXNpbmcgYGdldFVzZXJNZWRpYSgpYFxuICAgICAqIEBtZXRob2QgY3JlYXRlU3RyZWFtXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29uZmlnPXthdWRpbzogdHJ1ZSwgdmlkZW86IHRydWV9XSBUaGUgY29uZmlndXJhdGlvbiB0byBwYXNzIHRvIGBnZXRVc2VyTWVkaWEoKWBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2UgdG8gdGhlIHN0cmVhbVxuICAgICNcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqICAgICB2YXIgc3RyZWFtID0gcnRjLlN0cmVhbS5jcmVhdGVTdHJlYW0oe2F1ZGlvOiB0cnVlLCB2aWRlbzogZmFsc2V9KTtcbiAgICAgKiAgICAgcnRjLk1lZGlhRG9tRWxlbWVudCgkKCd2aWRlbycpLCBzdHJlYW0pO1xuICAgICAqL1xuXG4gICAgU3RyZWFtLmNyZWF0ZVN0cmVhbSA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgaWYgKGNvbmZpZyA9PSBudWxsKSB7XG4gICAgICAgIGNvbmZpZyA9IHtcbiAgICAgICAgICBhdWRpbzogdHJ1ZSxcbiAgICAgICAgICB2aWRlbzogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgc3VjY2VzcztcbiAgICAgICAgc3VjY2VzcyA9IGZ1bmN0aW9uKG5hdGl2ZV9zdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShuZXcgU3RyZWFtKG5hdGl2ZV9zdHJlYW0pKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNvbXBhdC5nZXRVc2VyTWVkaWEoY29uZmlnLCBzdWNjZXNzLCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBTdHJlYW07XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIFBlZXIsIFN0cmVhbTtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuICBQZWVyID0gcmVxdWlyZSgnLi9wZWVyJykuUGVlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKiBAY2xhc3MgcnRjLk1lZGlhRG9tRWxlbWVudFxuICAgKi9cblxuICBleHBvcnRzLk1lZGlhRG9tRWxlbWVudCA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBNZWRpYURvbUVsZW1lbnQoZG9tLCBkYXRhKSB7XG4gICAgICB0aGlzLmRvbSA9IGRvbTtcbiAgICAgIGlmICh0aGlzLmRvbS5qcXVlcnkgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRvbSA9IHRoaXMuZG9tWzBdO1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRhY2goZGF0YSk7XG4gICAgfVxuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5hdHRhY2ggPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0cmVhbTtcbiAgICAgICAgdGhpcy5kb20ucGF1c2UoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZG9tLnNyYyA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKGRhdGEgaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBkYXRhO1xuICAgICAgICBpZiAodHlwZW9mIG1vekdldFVzZXJNZWRpYSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb3pHZXRVc2VyTWVkaWEgIT09IG51bGwpIHtcbiAgICAgICAgICB0aGlzLmRvbS5tb3pTcmNPYmplY3QgPSBkYXRhLnN0cmVhbTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRvbS5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGRhdGEuc3RyZWFtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5kb20ucGxheSgpO1xuICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgUGVlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2goZGF0YS5zdHJlYW0oKSk7XG4gICAgICB9IGVsc2UgaWYgKChkYXRhICE9IG51bGwgPyBkYXRhLnRoZW4gOiB2b2lkIDApICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGRhdGEudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuYXR0YWNoKHJlcyk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpW1wiY2F0Y2hcIl0oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVycm9yKGVycik7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoXCJUcmllZCB0byBhdHRhY2ggaW52YWxpZCBkYXRhXCIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNZWRpYURvbUVsZW1lbnQucHJvdG90eXBlLmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICByZXR1cm4gY29uc29sZS5sb2coZXJyKTtcbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoKCk7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUubXV0ZSA9IGZ1bmN0aW9uKG11dGVkKSB7XG4gICAgICBpZiAobXV0ZWQgPT0gbnVsbCkge1xuICAgICAgICBtdXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5kb20ubXV0ZWQgPSBtdXRlZDtcbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS50b2dnbGVNdXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5kb20ubXV0ZWQgPSAhdGhpcy5kb20ubXV0ZWQ7XG4gICAgfTtcblxuICAgIHJldHVybiBNZWRpYURvbUVsZW1lbnQ7XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiJdfQ==
