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

},{"./promise":7,"events":1}],7:[function(require,module,exports){
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

},{"./compat":4,"./internal/channel_collection":6,"./internal/promise":7,"./internal/stream_collection":8,"./local_peer":10,"./peer":11,"./peer_connection":12,"./remote_peer":13,"./room":14,"./signaling/palava_signaling":16,"./signaling/web_socket_channel":18,"./stream":19,"./video_element":20}],10:[function(require,module,exports){
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
     * @return {Promise -> rtc.Stream} Promise of the stream
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

},{"./peer":11,"./stream":19}],11:[function(require,module,exports){
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
   * @module rtc
   */


  /**
   * @class rtc.PeerConnection
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

},{"./compat":4,"./data_channel":5,"./internal/promise":7,"./stream":19,"events":1}],13:[function(require,module,exports){
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

},{"./local_peer.coffee":10,"./peer_connection.coffee":12,"./remote_peer.coffee":13,"./signaling/muc_signaling.coffee":15,"./signaling/web_socket_channel.coffee":18,"events":1}],15:[function(require,module,exports){
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
   *     // send message to a peer. will be received as 'to'
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
   * @param {Object} status The status of the local peer
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

  })(Signaling);

}).call(this);

},{"../internal/promise":7,"./signaling":17,"events":1}],16:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var Deferred, EventEmitter,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Deferred = require('../internal/promise').Deferred;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.signaling
   */


  /**
   * Signaling peer compatible with the framing of palava signaling
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
     * @event new_status
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

},{"events":1}],18:[function(require,module,exports){
// Generated by CoffeeScript 1.9.2
(function() {
  var EventEmitter, Promise,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Promise = require('../internal/promise').Promise;

  EventEmitter = require('events').EventEmitter;


  /**
   * @module rtc.signaling
   */


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

},{"../internal/promise":7,"events":1}],19:[function(require,module,exports){
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

},{"./compat":4}],20:[function(require,module,exports){
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

},{"./peer":11,"./stream":19}]},{},[9])(9)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsInNyYy9jb21wYXQuY29mZmVlIiwic3JjL2RhdGFfY2hhbm5lbC5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvY2hhbm5lbF9jb2xsZWN0aW9uLmNvZmZlZSIsInNyYy9pbnRlcm5hbC9wcm9taXNlLmNvZmZlZSIsInNyYy9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbi5jb2ZmZWUiLCJzcmMvbGliLmNvZmZlZSIsInNyYy9sb2NhbF9wZWVyLmNvZmZlZSIsInNyYy9wZWVyLmNvZmZlZSIsInNyYy9wZWVyX2Nvbm5lY3Rpb24uY29mZmVlIiwic3JjL3JlbW90ZV9wZWVyLmNvZmZlZSIsInNyYy9yb29tLmNvZmZlZSIsInNyYy9zaWduYWxpbmcvbXVjX3NpZ25hbGluZy5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwuY29mZmVlIiwic3JjL3N0cmVhbS5jb2ZmZWUiLCJzcmMvdmlkZW9fZWxlbWVudC5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3Y4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9KQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKiFcbiAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cbiAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG4gKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG4gKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vamFrZWFyY2hpYmFsZC9lczYtcHJvbWlzZS9tYXN0ZXIvTElDRU5TRVxuICogQHZlcnNpb24gICAzLjAuMlxuICovXG5cbihmdW5jdGlvbigpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJG9iamVjdE9yRnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nIHx8ICh0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzTWF5YmVUaGVuYWJsZSh4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXk7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkgPSBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID0gMDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQ7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRjdXN0b21TY2hlZHVsZXJGbjtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcCA9IGZ1bmN0aW9uIGFzYXAoY2FsbGJhY2ssIGFyZykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2xpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW5dID0gY2FsbGJhY2s7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiArIDFdID0gYXJnO1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiArPSAyO1xuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPT09IDIpIHtcbiAgICAgICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgICAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgICAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4obGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm4gPSBzY2hlZHVsZUZuO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRBc2FwKGFzYXBGbikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAgPSBhc2FwRm47XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93ID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyB8fCB7fTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNOb2RlID0gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHt9LnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblxuICAgIC8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcblxuICAgIC8vIG5vZGVcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKSB7XG4gICAgICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcbiAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHZlcnR4XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gICAgICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgbGliJGVzNiRwcm9taXNlJGFzYXAkJEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHdlYiB3b3JrZXJcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG4gICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2g7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlU2V0VGltZW91dCgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgc2V0VGltZW91dChsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gsIDEpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbjsgaSs9Mikge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaV07XG4gICAgICAgIHZhciBhcmcgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaSsxXTtcblxuICAgICAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2krMV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gPSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhdHRlbXB0VmVydHgoKSB7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgciA9IHJlcXVpcmU7XG4gICAgICAgIHZhciB2ZXJ0eCA9IHIoJ3ZlcnR4Jyk7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVZlcnR4VGltZXIoKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2g7XG4gICAgLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbiAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTmV4dFRpY2soKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTXV0YXRpb25PYnNlcnZlcigpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGlzV29ya2VyKSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNZXNzYWdlQ2hhbm5lbCgpO1xuICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXR0ZW1wdFZlcnR4KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKCkge31cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICAgPSB2b2lkIDA7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCA9IDE7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEICA9IDI7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IgPSBuZXcgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHNlbGZGdWxmaWxsbWVudCgpIHtcbiAgICAgIHJldHVybiBuZXcgVHlwZUVycm9yKFwiWW91IGNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRjYW5ub3RSZXR1cm5Pd24oKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcignQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGdldFRoZW4ocHJvbWlzZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHByb21pc2UudGhlbjtcbiAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IuZXJyb3IgPSBlcnJvcjtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeVRoZW4odGhlbiwgdmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhlbi5jYWxsKHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSwgdGhlbikge1xuICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGZ1bmN0aW9uKHByb21pc2UpIHtcbiAgICAgICAgdmFyIHNlYWxlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgZXJyb3IgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlUaGVuKHRoZW4sIHRoZW5hYmxlLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGlmIChzZWFsZWQpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgICAgICBpZiAodGhlbmFibGUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICBpZiAoc2VhbGVkKSB7IHJldHVybjsgfVxuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG5cbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSwgJ1NldHRsZTogJyArIChwcm9taXNlLl9sYWJlbCB8fCAnIHVua25vd24gcHJvbWlzZScpKTtcblxuICAgICAgICBpZiAoIXNlYWxlZCAmJiBlcnJvcikge1xuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSwgcHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUpIHtcbiAgICAgIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICAgICAgfSBlbHNlIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHN1YnNjcmliZSh0aGVuYWJsZSwgdW5kZWZpbmVkLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlKSB7XG4gICAgICBpZiAobWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3RvciA9PT0gcHJvbWlzZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciB0aGVuID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZ2V0VGhlbihtYXliZVRoZW5hYmxlKTtcblxuICAgICAgICBpZiAodGhlbiA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkR0VUX1RIRU5fRVJST1IuZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHNlbGZGdWxmaWxsbWVudCgpKTtcbiAgICAgIH0gZWxzZSBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuICAgICAgaWYgKHByb21pc2UuX29uZXJyb3IpIHtcbiAgICAgICAgcHJvbWlzZS5fb25lcnJvcihwcm9taXNlLl9yZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoKHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykgeyByZXR1cm47IH1cblxuICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gdmFsdWU7XG4gICAgICBwcm9taXNlLl9zdGF0ZSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRDtcblxuICAgICAgaWYgKHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoLCBwcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKSB7XG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gICAgICBwcm9taXNlLl9zdGF0ZSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEO1xuICAgICAgcHJvbWlzZS5fcmVzdWx0ID0gcmVhc29uO1xuXG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoUmVqZWN0aW9uLCBwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICAgIHZhciBzdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gICAgICB2YXIgbGVuZ3RoID0gc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG4gICAgICBwYXJlbnQuX29uZXJyb3IgPSBudWxsO1xuXG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGhdID0gY2hpbGQ7XG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGggKyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgICAgIHN1YnNjcmliZXJzW2xlbmd0aCArIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEXSAgPSBvblJlamVjdGlvbjtcblxuICAgICAgaWYgKGxlbmd0aCA9PT0gMCAmJiBwYXJlbnQuX3N0YXRlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gsIHBhcmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaChwcm9taXNlKSB7XG4gICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycztcbiAgICAgIHZhciBzZXR0bGVkID0gcHJvbWlzZS5fc3RhdGU7XG5cbiAgICAgIGlmIChzdWJzY3JpYmVycy5sZW5ndGggPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgICAgIHZhciBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCA9IHByb21pc2UuX3Jlc3VsdDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzY3JpYmVycy5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgICAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2soZGV0YWlsKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCkge1xuICAgICAgdGhpcy5lcnJvciA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUiA9IG5ldyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SLmVycm9yID0gZTtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG4gICAgICB2YXIgaGFzQ2FsbGJhY2sgPSBsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuICAgICAgICAgIHZhbHVlLCBlcnJvciwgc3VjY2VlZGVkLCBmYWlsZWQ7XG5cbiAgICAgIGlmIChoYXNDYWxsYmFjaykge1xuICAgICAgICB2YWx1ZSA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpO1xuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkVFJZX0NBVENIX0VSUk9SKSB7XG4gICAgICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICBlcnJvciA9IHZhbHVlLmVycm9yO1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGNhbm5vdFJldHVybk93bigpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICAvLyBub29wXG4gICAgICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoZmFpbGVkKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbml0aWFsaXplUHJvbWlzZShwcm9taXNlLCByZXNvbHZlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzb2x2ZXIoZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpe1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9LCBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IoQ29uc3RydWN0b3IsIGlucHV0KSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIGVudW1lcmF0b3IuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcbiAgICAgIGVudW1lcmF0b3IucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKGVudW1lcmF0b3IuX3ZhbGlkYXRlSW5wdXQoaW5wdXQpKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX2lucHV0ICAgICA9IGlucHV0O1xuICAgICAgICBlbnVtZXJhdG9yLmxlbmd0aCAgICAgPSBpbnB1dC5sZW5ndGg7XG4gICAgICAgIGVudW1lcmF0b3IuX3JlbWFpbmluZyA9IGlucHV0Lmxlbmd0aDtcblxuICAgICAgICBlbnVtZXJhdG9yLl9pbml0KCk7XG5cbiAgICAgICAgaWYgKGVudW1lcmF0b3IubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChlbnVtZXJhdG9yLnByb21pc2UsIGVudW1lcmF0b3IuX3Jlc3VsdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bWVyYXRvci5sZW5ndGggPSBlbnVtZXJhdG9yLmxlbmd0aCB8fCAwO1xuICAgICAgICAgIGVudW1lcmF0b3IuX2VudW1lcmF0ZSgpO1xuICAgICAgICAgIGlmIChlbnVtZXJhdG9yLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwoZW51bWVyYXRvci5wcm9taXNlLCBlbnVtZXJhdG9yLl9yZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KGVudW1lcmF0b3IucHJvbWlzZSwgZW51bWVyYXRvci5fdmFsaWRhdGlvbkVycm9yKCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fdmFsaWRhdGVJbnB1dCA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICByZXR1cm4gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5KGlucHV0KTtcbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl92YWxpZGF0aW9uRXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoJ0FycmF5IE1ldGhvZHMgbXVzdCBiZSBwcm92aWRlZCBhbiBBcnJheScpO1xuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBBcnJheSh0aGlzLmxlbmd0aCk7XG4gICAgfTtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yO1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9lbnVtZXJhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgdmFyIGxlbmd0aCAgPSBlbnVtZXJhdG9yLmxlbmd0aDtcbiAgICAgIHZhciBwcm9taXNlID0gZW51bWVyYXRvci5wcm9taXNlO1xuICAgICAgdmFyIGlucHV0ICAgPSBlbnVtZXJhdG9yLl9pbnB1dDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICYmIGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBlbnVtZXJhdG9yLl9lYWNoRW50cnkoaW5wdXRbaV0sIGkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX2VhY2hFbnRyeSA9IGZ1bmN0aW9uKGVudHJ5LCBpKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG4gICAgICB2YXIgYyA9IGVudW1lcmF0b3IuX2luc3RhbmNlQ29uc3RydWN0b3I7XG5cbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzTWF5YmVUaGVuYWJsZShlbnRyeSkpIHtcbiAgICAgICAgaWYgKGVudHJ5LmNvbnN0cnVjdG9yID09PSBjICYmIGVudHJ5Ll9zdGF0ZSAhPT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORykge1xuICAgICAgICAgIGVudHJ5Ll9vbmVycm9yID0gbnVsbDtcbiAgICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnVtZXJhdG9yLl93aWxsU2V0dGxlQXQoYy5yZXNvbHZlKGVudHJ5KSwgaSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3JlbWFpbmluZy0tO1xuICAgICAgICBlbnVtZXJhdG9yLl9yZXN1bHRbaV0gPSBlbnRyeTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbihzdGF0ZSwgaSwgdmFsdWUpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcbiAgICAgIHZhciBwcm9taXNlID0gZW51bWVyYXRvci5wcm9taXNlO1xuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgZW51bWVyYXRvci5fcmVtYWluaW5nLS07XG5cbiAgICAgICAgaWYgKHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bWVyYXRvci5fcmVzdWx0W2ldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGVudW1lcmF0b3IuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIGVudW1lcmF0b3IuX3Jlc3VsdCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24ocHJvbWlzZSwgaSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBlbnVtZXJhdG9yLl9zZXR0bGVkQXQobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVELCBpLCB2YWx1ZSk7XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVELCBpLCByZWFzb24pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGFsbChlbnRyaWVzKSB7XG4gICAgICByZXR1cm4gbmV3IGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRkZWZhdWx0KHRoaXMsIGVudHJpZXMpLnByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGFsbDtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRyYWNlKGVudHJpZXMpIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcblxuICAgICAgaWYgKCFsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgfVxuXG4gICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG5cbiAgICAgIGZ1bmN0aW9uIG9uRnVsZmlsbG1lbnQodmFsdWUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG9uUmVqZWN0aW9uKHJlYXNvbikge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HICYmIGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUoQ29uc3RydWN0b3IucmVzb2x2ZShlbnRyaWVzW2ldKSwgdW5kZWZpbmVkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJHJhY2U7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkcmVzb2x2ZShvYmplY3QpIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gICAgICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gQ29uc3RydWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgIH1cblxuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRyZXNvbHZlO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkcmVqZWN0KHJlYXNvbikge1xuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3RvcihsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRub29wKTtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJHJlamVjdDtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkY291bnRlciA9IDA7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNSZXNvbHZlcigpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlO1xuICAgIC8qKlxuICAgICAgUHJvbWlzZSBvYmplY3RzIHJlcHJlc2VudCB0aGUgZXZlbnR1YWwgcmVzdWx0IG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uIFRoZVxuICAgICAgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCwgd2hpY2hcbiAgICAgIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuICAgICAgd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgICAgIFRlcm1pbm9sb2d5XG4gICAgICAtLS0tLS0tLS0tLVxuXG4gICAgICAtIGBwcm9taXNlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gd2l0aCBhIGB0aGVuYCBtZXRob2Qgd2hvc2UgYmVoYXZpb3IgY29uZm9ybXMgdG8gdGhpcyBzcGVjaWZpY2F0aW9uLlxuICAgICAgLSBgdGhlbmFibGVgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB0aGF0IGRlZmluZXMgYSBgdGhlbmAgbWV0aG9kLlxuICAgICAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuICAgICAgLSBgZXhjZXB0aW9uYCBpcyBhIHZhbHVlIHRoYXQgaXMgdGhyb3duIHVzaW5nIHRoZSB0aHJvdyBzdGF0ZW1lbnQuXG4gICAgICAtIGByZWFzb25gIGlzIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2h5IGEgcHJvbWlzZSB3YXMgcmVqZWN0ZWQuXG4gICAgICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblxuICAgICAgQSBwcm9taXNlIGNhbiBiZSBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzOiBwZW5kaW5nLCBmdWxmaWxsZWQsIG9yIHJlamVjdGVkLlxuXG4gICAgICBQcm9taXNlcyB0aGF0IGFyZSBmdWxmaWxsZWQgaGF2ZSBhIGZ1bGZpbGxtZW50IHZhbHVlIGFuZCBhcmUgaW4gdGhlIGZ1bGZpbGxlZFxuICAgICAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuICAgICAgcmVqZWN0ZWQgc3RhdGUuICBBIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5ldmVyIGEgdGhlbmFibGUuXG5cbiAgICAgIFByb21pc2VzIGNhbiBhbHNvIGJlIHNhaWQgdG8gKnJlc29sdmUqIGEgdmFsdWUuICBJZiB0aGlzIHZhbHVlIGlzIGFsc28gYVxuICAgICAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuICAgICAgc2V0dGxlZCBzdGF0ZS4gIFNvIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aWxsXG4gICAgICBpdHNlbGYgcmVqZWN0LCBhbmQgYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aWxsXG4gICAgICBpdHNlbGYgZnVsZmlsbC5cblxuXG4gICAgICBCYXNpYyBVc2FnZTpcbiAgICAgIC0tLS0tLS0tLS0tLVxuXG4gICAgICBgYGBqc1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgLy8gb24gc3VjY2Vzc1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcblxuICAgICAgICAvLyBvbiBmYWlsdXJlXG4gICAgICAgIHJlamVjdChyZWFzb24pO1xuICAgICAgfSk7XG5cbiAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQWR2YW5jZWQgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS0tLS1cblxuICAgICAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuICAgICAgYFhNTEh0dHBSZXF1ZXN0YHMuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gaGFuZGxlcjtcbiAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgIHhoci5zZW5kKCk7XG5cbiAgICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdnZXRKU09OOiBgJyArIHVybCArICdgIGZhaWxlZCB3aXRoIHN0YXR1czogWycgKyB0aGlzLnN0YXR1cyArICddJykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGdldEpTT04oJy9wb3N0cy5qc29uJykudGhlbihmdW5jdGlvbihqc29uKSB7XG4gICAgICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgLy8gb24gcmVqZWN0aW9uXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBVbmxpa2UgY2FsbGJhY2tzLCBwcm9taXNlcyBhcmUgZ3JlYXQgY29tcG9zYWJsZSBwcmltaXRpdmVzLlxuXG4gICAgICBgYGBqc1xuICAgICAgUHJvbWlzZS5hbGwoW1xuICAgICAgICBnZXRKU09OKCcvcG9zdHMnKSxcbiAgICAgICAgZ2V0SlNPTignL2NvbW1lbnRzJylcbiAgICAgIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcbiAgICAgICAgdmFsdWVzWzBdIC8vID0+IHBvc3RzSlNPTlxuICAgICAgICB2YWx1ZXNbMV0gLy8gPT4gY29tbWVudHNKU09OXG5cbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBjbGFzcyBQcm9taXNlXG4gICAgICBAcGFyYW0ge2Z1bmN0aW9ufSByZXNvbHZlclxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQGNvbnN0cnVjdG9yXG4gICAgKi9cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZShyZXNvbHZlcikge1xuICAgICAgdGhpcy5faWQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkY291bnRlcisrO1xuICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCAhPT0gcmVzb2x2ZXIpIHtcbiAgICAgICAgaWYgKCFsaWIkZXM2JHByb21pc2UkdXRpbHMkJGlzRnVuY3Rpb24ocmVzb2x2ZXIpKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzUmVzb2x2ZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSkpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkbmVlZHNOZXcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5hbGwgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRhbGwkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmFjZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVzb2x2ZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJGRlZmF1bHQ7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UucmVqZWN0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRTY2hlZHVsZXIgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0U2NoZWR1bGVyO1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9zZXRBc2FwID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldEFzYXA7XG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuX2FzYXAgPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcDtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgICAgIGNvbnN0cnVjdG9yOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZSxcblxuICAgIC8qKlxuICAgICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gICAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICAgICAgcmVhc29uIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIENoYWluaW5nXG4gICAgICAtLS0tLS0tLVxuXG4gICAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICAgICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICAgICAgb3IgcmVqZWN0aW9uIGhhbmRsZXIsIG9yIHJlamVjdGVkIGlmIHRoZSBoYW5kbGVyIHRocm93cyBhbiBleGNlcHRpb24uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuICAgICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2BcbiAgICAgIH0pO1xuXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cbiAgICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gICAgICB9KTtcbiAgICAgIGBgYFxuICAgICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBlZGFnb2dpY2FsRXhjZXB0aW9uKCdVcHN0cmVhbSBlcnJvcicpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBUaGUgYFBlZGdhZ29jaWFsRXhjZXB0aW9uYCBpcyBwcm9wYWdhdGVkIGFsbCB0aGUgd2F5IGRvd24gdG8gaGVyZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQXNzaW1pbGF0aW9uXG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcbiAgICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG4gICAgICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIFNpbXBsZSBFeGFtcGxlXG4gICAgICAtLS0tLS0tLS0tLS0tLVxuXG4gICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIHZhciByZXN1bHQ7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIEV4YW1wbGVcbiAgICAgIC0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcblxuICAgICAgYGBgamF2YXNjcmlwdFxuICAgICAgdmFyIGF1dGhvciwgYm9va3M7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcbiAgICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfVxuICAgICAgYGBgXG5cbiAgICAgIEVycmJhY2sgRXhhbXBsZVxuXG4gICAgICBgYGBqc1xuXG4gICAgICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG5cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcblxuICAgICAgfVxuXG4gICAgICBmaW5kQXV0aG9yKGZ1bmN0aW9uKGF1dGhvciwgZXJyKXtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAvLyBmYWlsdXJlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZpbmRCb29va3NCeUF1dGhvcihhdXRob3IsIGZ1bmN0aW9uKGJvb2tzLCBlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBQcm9taXNlIEV4YW1wbGU7XG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIGZpbmRBdXRob3IoKS5cbiAgICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuICAgICAgICAgIC8vIGZvdW5kIGJvb2tzXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgQG1ldGhvZCB0aGVuXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZFxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgdGhlbjogZnVuY3Rpb24ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IHRoaXM7XG4gICAgICAgIHZhciBzdGF0ZSA9IHBhcmVudC5fc3RhdGU7XG5cbiAgICAgICAgaWYgKHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgJiYgIW9uRnVsZmlsbG1lbnQgfHwgc3RhdGUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEICYmICFvblJlamVjdGlvbikge1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICAgIHZhciByZXN1bHQgPSBwYXJlbnQuX3Jlc3VsdDtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbc3RhdGUgLSAxXTtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChmdW5jdGlvbigpe1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcmVzdWx0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoaWxkO1xuICAgICAgfSxcblxuICAgIC8qKlxuICAgICAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuICAgICAgYXMgdGhlIGNhdGNoIGJsb2NrIG9mIGEgdHJ5L2NhdGNoIHN0YXRlbWVudC5cblxuICAgICAgYGBganNcbiAgICAgIGZ1bmN0aW9uIGZpbmRBdXRob3IoKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIHN5bmNocm9ub3VzXG4gICAgICB0cnkge1xuICAgICAgICBmaW5kQXV0aG9yKCk7XG4gICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgICAgfVxuXG4gICAgICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG4gICAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBtZXRob2QgY2F0Y2hcbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0aW9uXG4gICAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAgICovXG4gICAgICAnY2F0Y2gnOiBmdW5jdGlvbihvblJlamVjdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkcG9seWZpbGwoKSB7XG4gICAgICB2YXIgbG9jYWw7XG5cbiAgICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsID0gZ2xvYmFsO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBsb2NhbCA9IHNlbGY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGxvY2FsID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cbiAgICAgIGlmIChQICYmIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSkgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbG9jYWwuUHJvbWlzZSA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRkZWZhdWx0O1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHBvbHlmaWxsJCRwb2x5ZmlsbDtcblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlID0ge1xuICAgICAgJ1Byb21pc2UnOiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdCxcbiAgICAgICdwb2x5ZmlsbCc6IGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdFxuICAgIH07XG5cbiAgICAvKiBnbG9iYWwgZGVmaW5lOnRydWUgbW9kdWxlOnRydWUgd2luZG93OiB0cnVlICovXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lWydhbWQnXSkge1xuICAgICAgZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTsgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGVbJ2V4cG9ydHMnXSkge1xuICAgICAgbW9kdWxlWydleHBvcnRzJ10gPSBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzWydFUzZQcm9taXNlJ10gPSBsaWIkZXM2JHByb21pc2UkdW1kJCRFUzZQcm9taXNlO1xuICAgIH1cblxuICAgIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdCgpO1xufSkuY2FsbCh0aGlzKTtcblxuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuXG4vKipcbiAqIENvcmUgZnVuY3Rpb25hbGl0eVxuICogQG1vZHVsZSBydGNcbiAqIEBtYWluIHJ0Y1xuICovXG5cblxuLyoqXG4gKiBTaWduYWxpbmcgYW5kIHNpZ25hbGluZyBjaGFubmVsc1xuICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gKiBAbWFpbiBydGMuc2lnbmFsaW5nXG4gKi9cblxuXG4vKipcbiAqIEludGVybmFsIGhlbHBlcnNcbiAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gKiBAbWFpbiBydGMuaW50ZXJuYWxcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBiaW5kSGVscGVyLCBjb21wYXQ7XG5cbiAgYmluZEhlbHBlciA9IGZ1bmN0aW9uKG9iaiwgZnVuKSB7XG4gICAgaWYgKGZ1biA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybiBmdW4uYmluZChvYmopO1xuICB9O1xuXG4gIGV4cG9ydHMuY29tcGF0ID0gY29tcGF0ID0ge1xuICAgIFBlZXJDb25uZWN0aW9uOiB3aW5kb3cuUGVlckNvbm5lY3Rpb24gfHwgd2luZG93LndlYmtpdFBlZXJDb25uZWN0aW9uMDAgfHwgd2luZG93LndlYmtpdFJUQ1BlZXJDb25uZWN0aW9uIHx8IHdpbmRvdy5tb3pSVENQZWVyQ29ubmVjdGlvbixcbiAgICBJY2VDYW5kaWRhdGU6IHdpbmRvdy5SVENJY2VDYW5kaWRhdGUgfHwgd2luZG93Lm1velJUQ0ljZUNhbmRpZGF0ZSxcbiAgICBTZXNzaW9uRGVzY3JpcHRpb246IHdpbmRvdy5tb3pSVENTZXNzaW9uRGVzY3JpcHRpb24gfHwgd2luZG93LlJUQ1Nlc3Npb25EZXNjcmlwdGlvbixcbiAgICBNZWRpYVN0cmVhbTogd2luZG93Lk1lZGlhU3RyZWFtIHx8IHdpbmRvdy5tb3pNZWRpYVN0cmVhbSB8fCB3aW5kb3cud2Via2l0TWVkaWFTdHJlYW0sXG4gICAgZ2V0VXNlck1lZGlhOiBiaW5kSGVscGVyKG5hdmlnYXRvciwgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhKSxcbiAgICBzdXBwb3J0ZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIChjb21wYXQuUGVlckNvbm5lY3Rpb24gIT0gbnVsbCkgJiYgKGNvbXBhdC5JY2VDYW5kaWRhdGUgIT0gbnVsbCkgJiYgKGNvbXBhdC5TZXNzaW9uRGVzY3JpcHRpb24gIT0gbnVsbCkgJiYgKGNvbXBhdC5nZXRVc2VyTWVkaWEgIT0gbnVsbCk7XG4gICAgfVxuICB9O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9wcm9taXNlJyksIERlZmVycmVkID0gcmVmLkRlZmVycmVkLCBQcm9taXNlID0gcmVmLlByb21pc2U7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBmb3IgUlRDRGF0YUNoYW5uZWwuIFVzZWQgdG8gdHJhbnNmZXIgY3VzdG9tIGRhdGEgYmV0d2VlbiBwZWVycy5cbiAgICogQGNsYXNzIHJ0Yy5EYXRhQ2hhbm5lbFxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JUQ0RhdGFDaGFubmVsfSBjaGFubmVsIFRoZSB3cmFwcGVkIG5hdGl2ZSBkYXRhIGNoYW5uZWxcbiAgICogQHBhcmFtIHtOdW1iZXJ9IFttYXhfYnVmZmVyXSBUaGUgc2l6ZSBvZiB0aGUgc2VuZCBidWZmZXIgYWZ0ZXIgd2hpY2ggd2Ugd2lsbCBkZWxheSBzZW5kaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuRGF0YUNoYW5uZWwgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChEYXRhQ2hhbm5lbCwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IG1lc3NhZ2VzIHdhcyByZWNlaXZlZC4gVHJpZ2dlcnMgb25seSBhZnRlciBgY29ubmVjdCgpYCB3YXMgY2FsbGVkXG4gICAgICogQGV2ZW50IG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSByZWNlaXZlZFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2hhbm5lbCB3YXMgY2xvc2VkXG4gICAgICogQGV2ZW50IGNsb3NlZFxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gRGF0YUNoYW5uZWwoY2hhbm5lbCwgbWF4X2J1ZmZlcikge1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMubWF4X2J1ZmZlciA9IG1heF9idWZmZXIgIT0gbnVsbCA/IG1heF9idWZmZXIgOiAxMDI0ICogMTA7XG4gICAgICB0aGlzLl9jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuX2Nvbm5lY3RfcXVldWUgPSBbXTtcbiAgICAgIHRoaXMuX3NlbmRfYnVmZmVyID0gW107XG4gICAgICB0aGlzLmNoYW5uZWwub25tZXNzYWdlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIGlmICghX3RoaXMuX2Nvbm5lY3RlZCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0X3F1ZXVlLnB1c2goZXZlbnQuZGF0YSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdtZXNzYWdlJywgZXZlbnQuZGF0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLmNoYW5uZWwub25jbG9zZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLmNoYW5uZWwub25lcnJvciA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdCB0byB0aGUgRGF0YUNoYW5uZWwuIFlvdSB3aWxsIHJlY2VpdmUgbWVzc2FnZXMgYW5kIHdpbGwgYmUgYWJsZSB0byBzZW5kIGFmdGVyIGNhbGxpbmcgdGhpcy5cbiAgICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHJlc29sdmVzIGFzIHNvb24gYXMgdGhlIERhdGFDaGFubmVsIGlzIG9wZW5cbiAgICAgKi9cblxuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGF0YSwgaSwgbGVuLCByZWYxO1xuICAgICAgdGhpcy5fY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgIHJlZjEgPSB0aGlzLl9jb25uZWN0X3F1ZXVlO1xuICAgICAgZm9yIChpID0gMCwgbGVuID0gcmVmMS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBkYXRhID0gcmVmMVtpXTtcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgZGF0YSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fY29ubmVjdF9xdWV1ZTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGFiZWwgb2YgdGhlIERhdGFDaGFubmVsIHVzZWQgdG8gZGlzdGluZ3Vpc2ggbXVsdGlwbGUgY2hhbm5lbHNcbiAgICAgKiBAbWV0aG9kIGxhYmVsXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBUaGUgbGFiZWxcbiAgICAgKi9cblxuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5sYWJlbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5sYWJlbDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGRhdGEgdG8gdGhlIHBlZXIgdGhyb3VnaCB0aGUgRGF0YUNoYW5uZWxcbiAgICAgKiBAbWV0aG9kIHNlbmRcbiAgICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBiZSB0cmFuc2ZlcnJlZFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCBiZSByZXNvbHZlZCB3aGVuIHRoZSBkYXRhIHdhcyBwYXNzZWQgdG8gdGhlIG5hdGl2ZSBkYXRhIGNoYW5uZWxcbiAgICAgKi9cblxuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdmFyIGRlZmVyO1xuICAgICAgaWYgKCF0aGlzLl9jb25uZWN0ZWQpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiU2VuZGluZyB3aXRob3V0IGJlaW5nIGNvbm5lY3RlZC4gUGxlYXNlIGNhbGwgY29ubmVjdCgpIG9uIHRoZSBkYXRhIGNoYW5uZWwgdG8gc3RhcnQgdXNpbmcgaXQuXCIpO1xuICAgICAgfVxuICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuX3NlbmRfYnVmZmVyLnB1c2goW2RhdGEsIGRlZmVyXSk7XG4gICAgICBpZiAodGhpcy5fc2VuZF9idWZmZXIubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHRoaXMuX2FjdHVhbFNlbmQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE1ldGhvZCB3aGljaCBhY3R1YWxseSBzZW5kcyB0aGUgZGF0YS4gSW1wbGVtZW50cyBidWZmZXJpbmdcbiAgICAgKiBAbWV0aG9kIF9hY3R1YWxTZW5kXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5fYWN0dWFsU2VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRhdGEsIGRlZmVyLCByZWYxLCByZWYyLCByZXN1bHRzO1xuICAgICAgaWYgKHRoaXMuY2hhbm5lbC5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAgICAgd2hpbGUgKHRoaXMuX3NlbmRfYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICAgIGlmICh0aGlzLmNoYW5uZWwuYnVmZmVyZWRBbW91bnQgPj0gdGhpcy5tYXhfYnVmZmVyKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KHRoaXMuX2FjdHVhbFNlbmQuYmluZCh0aGlzKSwgMSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlZjEgPSB0aGlzLl9zZW5kX2J1ZmZlclswXSwgZGF0YSA9IHJlZjFbMF0sIGRlZmVyID0gcmVmMVsxXTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jaGFubmVsLnNlbmQoZGF0YSk7XG4gICAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KHRoaXMuX2FjdHVhbFNlbmQuYmluZCh0aGlzKSwgMSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlZmVyLnJlc29sdmUoKTtcbiAgICAgICAgICB0aGlzLl9zZW5kX2J1ZmZlci5zaGlmdCgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRzID0gW107XG4gICAgICAgIHdoaWxlICh0aGlzLl9zZW5kX2J1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICByZWYyID0gdGhpcy5fc2VuZF9idWZmZXIuc2hpZnQoKSwgZGF0YSA9IHJlZjJbMF0sIGRlZmVyID0gcmVmMlsxXTtcbiAgICAgICAgICByZXN1bHRzLnB1c2goZGVmZXIucmVqZWN0KG5ldyBFcnJvcihcIkRhdGFDaGFubmVsIGNsb3NlZFwiKSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YUNoYW5uZWw7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsIFByb21pc2UsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vcHJvbWlzZScpLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZCwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBIZWxwZXIgd2hpY2ggaGFuZGxlcyBEYXRhQ2hhbm5lbCBuZWdvdGlhdGlvbiBmb3IgUmVtb3RlUGVlclxuICAgKiBAY2xhc3MgcnRjLmludGVybmFsLkNoYW5uZWxDb2xsZWN0aW9uXG4gICAqL1xuXG4gIGV4cG9ydHMuQ2hhbm5lbENvbGxlY3Rpb24gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChDaGFubmVsQ29sbGVjdGlvbiwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IGRhdGEgY2hhbm5lbCBpcyBhdmFpbGFibGVcbiAgICAgKiBAZXZlbnQgZGF0YV9jaGFubmVsX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBzdHJlYW0gUHJvbWlzZSBvZiB0aGUgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gQ2hhbm5lbENvbGxlY3Rpb24oKSB7XG4gICAgICB0aGlzLmNoYW5uZWxzID0ge307XG4gICAgICB0aGlzLmRlZmVycyA9IHt9O1xuICAgICAgdGhpcy5wZW5kaW5nID0ge307XG4gICAgICB0aGlzLndhaXRfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy53YWl0X3AgPSB0aGlzLndhaXRfZC5wcm9taXNlO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBsb2NhbCBjaGFubmVsIGRlc2NyaXB0aW9uLlxuICAgICAqIEBtZXRob2Qgc2V0TG9jYWxcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBPYmplY3QgZGVzY3JpYmluZyBlYWNoIG9mZmVyZWQgRGF0YUNoYW5uZWxcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5zZXRMb2NhbCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHRoaXMubG9jYWwgPSBkYXRhO1xuICAgICAgaWYgKHRoaXMucmVtb3RlICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VwZGF0ZSgpO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcmVtb3RlIGNoYW5uZWwgZGVzY3JpcHRpb24uXG4gICAgICogQG1ldGhvZCBzZXRSZW1vdGVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBPYmplY3QgZGVzY3JpYmluZyBlYWNoIG9mZmVyZWQgRGF0YUNoYW5uZWxcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5zZXRSZW1vdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB0aGlzLnJlbW90ZSA9IGRhdGE7XG4gICAgICBpZiAodGhpcy5sb2NhbCAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91cGRhdGUoKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBNYXRjaGVzIHJlbW90ZSBhbmQgbG9jYWwgZGVzY3JpcHRpb25zIGFuZCBjcmVhdGVzIHByb21pc2VzIGNvbW1vbiBEYXRhQ2hhbm5lbHNcbiAgICAgKiBAbWV0aG9kIF91cGRhdGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLl91cGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjaGFubmVsLCBjb25maWcsIGRlZmVyLCBuYW1lLCByZWYxO1xuICAgICAgcmVmMSA9IHRoaXMucmVtb3RlO1xuICAgICAgZm9yIChuYW1lIGluIHJlZjEpIHtcbiAgICAgICAgY29uZmlnID0gcmVmMVtuYW1lXTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgIGlmICh0aGlzLmNoYW5uZWxzW25hbWVdICE9IG51bGwpIHtcblxuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5wZW5kaW5nW25hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNoYW5uZWwgPSB0aGlzLnBlbmRpbmdbbmFtZV07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wZW5kaW5nW25hbWVdO1xuICAgICAgICAgICAgdGhpcy5jaGFubmVsc1tuYW1lXSA9IFByb21pc2UucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgdGhpcy5jaGFubmVsc1tuYW1lXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgICAgICB0aGlzLmNoYW5uZWxzW25hbWVdID0gZGVmZXIucHJvbWlzZTtcbiAgICAgICAgICAgIHRoaXMuZGVmZXJzW25hbWVdID0gZGVmZXI7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9hZGRlZCcsIG5hbWUsIHRoaXMuY2hhbm5lbHNbbmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkRhdGFDaGFubmVsIG9mZmVyZWQgYnkgcmVtb3RlIGJ1dCBub3QgYnkgbG9jYWxcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAobmFtZSBpbiB0aGlzLmxvY2FsKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbW90ZVtuYW1lXSA9PSBudWxsKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJEYXRhQ2hhbm5lbCBvZmZlcmVkIGJ5IGxvY2FsIGJ1dCBub3QgYnkgcmVtb3RlXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy53YWl0X2QucmVzb2x2ZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmVzIHByb21pc2VzIHdhaXRpbmcgZm9yIHRoZSBnaXZlbiBEYXRhQ2hhbm5lbFxuICAgICAqIEBtZXRob2QgcmVzb2x2ZVxuICAgICAqIEBwYXJhbSB7RGF0YUNoYW5uZWx9IGNoYW5uZWwgVGhlIG5ldyBjaGFubmVsXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKGNoYW5uZWwpIHtcbiAgICAgIHZhciBsYWJlbDtcbiAgICAgIGxhYmVsID0gY2hhbm5lbC5sYWJlbCgpO1xuICAgICAgaWYgKHRoaXMuZGVmZXJzW2xhYmVsXSAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGVmZXJzW2xhYmVsXS5yZXNvbHZlKGNoYW5uZWwpO1xuICAgICAgICByZXR1cm4gZGVsZXRlIHRoaXMuZGVmZXJzW2xhYmVsXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBlbmRpbmdbbGFiZWxdID0gY2hhbm5lbDtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBwcm9taXNlIHRvIGEgRGF0YUNoYW5uZWwuIFdpbGwgcmVzb2x2ZSBpZiBEYXRhQ2hhbm5lbCB3YXMgb2ZmZXJlZCBhbmQgZ2V0cyBpbml0aWF0ZWQuIE1pZ2h0IHJlamVjdCBhZnRlciByZW1vdGUgYW5kIGxvY2FsIGRlc2NyaXB0aW9uIGFyZSBwcm9jZXNzZWQuXG4gICAgICogQG1ldGhvZCBnZXRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbGFiZWwgb2YgdGhlIGNoYW5uZWwgdG8gZ2V0XG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBEYXRhQ2hhbm5lbH0gUHJvbWlzZSBmb3IgdGhlIERhdGFDaGFubmVsXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMud2FpdF9wLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoX3RoaXMuY2hhbm5lbHNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWxzW25hbWVdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEYXRhQ2hhbm5lbCBub3QgbmVnb3RpYXRlZFwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBDaGFubmVsQ29sbGVjdGlvbjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuXG4vKipcbiAqIEBtb2R1bGUgcnRjLmludGVybmFsXG4gKi9cblxuXG4vKipcbiAqIEFsaWFzIGZvciBuYXRpdmUgcHJvbWlzZXMgb3IgYSBwb2x5ZmlsbCBpZiBub3Qgc3VwcG9ydGVkXG4gKiBAY2xhc3MgcnRjLmludGVybmFsLlByb21pc2VcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIGV4cG9ydHMuUHJvbWlzZSA9IGdsb2JhbC5Qcm9taXNlIHx8IHJlcXVpcmUoJ2VzNi1wcm9taXNlJykuUHJvbWlzZTtcblxuXG4gIC8qKlxuICAgKiBIZWxwZXIgdG8gaW1wbGVtZW50IGRlZmVycmVkIGV4ZWN1dGlvbiB3aXRoIHByb21pc2VzXG4gICAqIEBjbGFzcyBydGMuaW50ZXJuYWwuRGVmZXJyZWRcbiAgICovXG5cblxuICAvKipcbiAgICogUmVzb2x2ZXMgdGhlIHByb21pc2VcbiAgICogQG1ldGhvZCByZXNvbHZlXG4gICAqIEBwYXJhbSBbZGF0YV0gVGhlIHBheWxvYWQgdG8gd2hpY2ggdGhlIHByb21pc2Ugd2lsbCByZXNvbHZlXG4gICNcbiAgICogQGV4YW1wbGVcbiAgICogICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpXG4gICAqICAgICBkZWZlci5yZXNvbHZlKDQyKTtcbiAgICogICAgIGRlZmVyLnByb21pc2UudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICogICAgICAgY29uc29sZS5sb2cocmVzKTsgICAvLyA0MlxuICAgKiAgICAgfVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZWplY3QgdGhlIHByb21pc2VcbiAgICogQG1ldGhvZCByZWplY3RcbiAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIHBheWxvYWQgdG8gd2hpY2ggdGhlIHByb21pc2Ugd2lsbCByZXNvbHZlXG4gICNcbiAgICogQGV4YW1wbGVcbiAgICogICAgIHZhciBkZWZlciA9IG5ldyBEZWZlcnJlZCgpXG4gICAqICAgICBkZWZlci5yZWplY3QobmV3IEVycm9yKFwiUmVqZWN0IGJlY2F1c2Ugd2UgY2FuIVwiKSk7XG4gICAqICAgICBkZWZlci5wcm9taXNlLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgKiAgICAgICAvLyB3b250IGhhcHBlblxuICAgKiAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAqICAgICAgIC8vIHdpbGwgaGFwcGVuXG4gICAqICAgICB9XG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFRoZSBwcm9taXNlIHdoaWNoIHdpbGwgZ2V0IHJlc29sdmVkIG9yIHJlamVjdGVkIGJ5IHRoaXMgZGVmZXJyZWRcbiAgICogQHByb3BlcnR5IHtQcm9taXNlfSBwcm9taXNlXG4gICAqL1xuXG4gIGV4cG9ydHMuRGVmZXJyZWQgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gRGVmZXJyZWQoKSB7XG4gICAgICB0aGlzLnByb21pc2UgPSBuZXcgZXhwb3J0cy5Qcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgX3RoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnJlamVjdCA9IHJlamVjdDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gRGVmZXJyZWQ7XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4vcHJvbWlzZScpLkRlZmVycmVkO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBIZWxwZXIgaGFuZGxpbmcgdGhlIG1hcHBpbmcgb2Ygc3RyZWFtcyBmb3IgUmVtb3RlUGVlclxuICAgKiBAY2xhc3MgcnRjLmludGVybmFsLlN0cmVhbUNvbGxlY3Rpb25cbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG5cbiAgZXhwb3J0cy5TdHJlYW1Db2xsZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoU3RyZWFtQ29sbGVjdGlvbiwgc3VwZXJDbGFzcyk7XG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IHN0cmVhbSB3YXMgYWRkZWQgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgKiBAZXZlbnQgc3RlYW1fYWRkZWRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgdXNlciBkZWZpbmVkIG5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBzdHJlYW0gUHJvbWlzZSB0byB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBTdHJlYW1Db2xsZWN0aW9uKCkge1xuXG4gICAgICAvKipcbiAgICAgICAqIENvbnRhaW5zIHRoZSBwcm9taXNlcyB3aGljaCB3aWxsIHJlc29sdmUgdG8gdGhlIHN0cmVhbXNcbiAgICAgICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBzdHJlYW1zXG4gICAgICAgKi9cbiAgICAgIHRoaXMuc3RyZWFtcyA9IHt9O1xuICAgICAgdGhpcy5fZGVmZXJzID0ge307XG4gICAgICB0aGlzLl93YWl0aW5nID0ge307XG4gICAgICB0aGlzLl9wZW5kaW5nID0ge307XG4gICAgICB0aGlzLndhaXRfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy53YWl0X3AgPSB0aGlzLndhaXRfZC5wcm9taXNlO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogU2V0IHN0cmVhbSBkZXNjcmlwdGlvbiBhbmQgZ2VuZXJhdGUgcHJvbWlzZXNcbiAgICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgICAqIEBwYXJhbSBkYXRhIHtPYmplY3R9IEFuIG9iamVjdCBtYXBwaW5nIHRoZSBzdHJlYW0gaWRzIHRvIHN0cmVhbSBuYW1lc1xuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdmFyIGRlZmVyLCBpLCBpZCwgbGVuLCBtZW1iZXJzLCBuYW1lLCByZWYsIHN0cmVhbSwgc3RyZWFtX3A7XG4gICAgICBtZW1iZXJzID0gW107XG4gICAgICB0aGlzLl93YWl0aW5nID0ge307XG4gICAgICByZWYgPSB0aGlzLnN0cmVhbXM7XG4gICAgICBmb3IgKHN0cmVhbV9wID0gaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IHN0cmVhbV9wID0gKytpKSB7XG4gICAgICAgIG5hbWUgPSByZWZbc3RyZWFtX3BdO1xuICAgICAgICBpZiAoZGF0YVtuYW1lXSA9PSBudWxsKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICAgICAgICB0aGlzLmVtaXQoJ3N0cmVhbV9yZW1vdmVkJywgbmFtZSk7XG4gICAgICAgICAgaWYgKHN0cmVhbV9wLmlzRnVsbGZpbGxlZCgpKSB7XG4gICAgICAgICAgICBzdHJlYW1fcC50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgICAgICByZXR1cm4gc3RyZWFtLmNsb3NlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0cmVhbV9wLmlzUGVuZGluZygpKSB7XG4gICAgICAgICAgICBzdHJlYW1fcC5yZWplY3QobmV3IEVycm9yKFwiU3RyZWFtIHJlbW92ZWQgYmVmb3JlIGJlaW5nIGVzdGFibGlzaGVkXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAobmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlkID0gZGF0YVtuYW1lXTtcbiAgICAgICAgaWYgKHRoaXMuc3RyZWFtc1tuYW1lXSA9PSBudWxsKSB7XG4gICAgICAgICAgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgICAgICB0aGlzLnN0cmVhbXNbbmFtZV0gPSBkZWZlci5wcm9taXNlO1xuICAgICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXSA9IGRlZmVyO1xuICAgICAgICAgIHRoaXMuZW1pdCgnc3RyZWFtX2FkZGVkJywgbmFtZSwgZGVmZXIucHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2RlZmVyc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX3BlbmRpbmdbaWRdICE9IG51bGwpIHtcbiAgICAgICAgICAgIHN0cmVhbSA9IHRoaXMuX3BlbmRpbmdbaWRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3BlbmRpbmdbaWRdO1xuICAgICAgICAgICAgdGhpcy5fZGVmZXJzW25hbWVdLnJlc29sdmUoc3RyZWFtKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9kZWZlcnNbbmFtZV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3dhaXRpbmdbaWRdID0gbmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLndhaXRfZC5yZXNvbHZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIHN0cmVhbSB0byB0aGUgY29sbGVjdGlvbiBhbmQgcmVzb2x2ZSBwcm9taXNlcyB3YWl0aW5nIGZvciBpdFxuICAgICAqIEBtZXRob2QgcmVzb2x2ZVxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtXG4gICAgICovXG5cbiAgICBTdHJlYW1Db2xsZWN0aW9uLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICB2YXIgaWQsIG5hbWU7XG4gICAgICBpZCA9IHN0cmVhbS5pZCgpO1xuICAgICAgaWYgKHRoaXMuX3dhaXRpbmdbaWRdICE9IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuX3dhaXRpbmdbaWRdO1xuICAgICAgICBkZWxldGUgdGhpcy5fd2FpdGluZ1tpZF07XG4gICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXS5yZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgIHJldHVybiBkZWxldGUgdGhpcy5fZGVmZXJzW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BlbmRpbmdbaWRdID0gc3RyZWFtO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldHMgYSBwcm9taXNlIGZvciBhIHN0cmVhbSB3aXRoIHRoZSBnaXZlbiBuYW1lLiBNaWdodCBiZSByZWplY3RlZCBhZnRlciBgdXBkYXRlKClgXG4gICAgI1xuICAgICAqIEBtZXRob2QgZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBUaGUgcHJvbWlzZSBmb3IgdGhlIGBydGMuU3RyZWFtYFxuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMud2FpdF9wLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoX3RoaXMuc3RyZWFtc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtc1tuYW1lXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU3RyZWFtIG5vdCBvZmZlcmVkXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFN0cmVhbUNvbGxlY3Rpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIGV4cG9ydHMsIGV4dGVuZDtcblxuICBleHRlbmQgPSBmdW5jdGlvbihyb290LCBvYmopIHtcbiAgICB2YXIga2V5LCB2YWx1ZTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgIHZhbHVlID0gb2JqW2tleV07XG4gICAgICByb290W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGV4cG9ydHM7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0ge1xuICAgIGludGVybmFsOiB7fSxcbiAgICBzaWduYWxpbmc6IHt9XG4gIH07XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9yZW1vdGVfcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9sb2NhbF9wZWVyJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3BlZXJfY29ubmVjdGlvbicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9zdHJlYW0nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vY29tcGF0JykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3Jvb20nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vdmlkZW9fZWxlbWVudCcpKTtcblxuICBleHRlbmQoZXhwb3J0cy5pbnRlcm5hbCwgcmVxdWlyZSgnLi9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbicpKTtcblxuICBleHRlbmQoZXhwb3J0cy5pbnRlcm5hbCwgcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL3dlYl9zb2NrZXRfY2hhbm5lbCcpKTtcblxuICBleHRlbmQoZXhwb3J0cy5zaWduYWxpbmcsIHJlcXVpcmUoJy4vc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcnKSk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBQZWVyLCBTdHJlYW0sXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBQZWVyID0gcmVxdWlyZSgnLi9wZWVyJykuUGVlcjtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBsb2NhbCB1c2VyIG9mIHRoZSByb29tXG4gICAqIEBjbGFzcyBydGMuTG9jYWxQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIGV4cG9ydHMuTG9jYWxQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTG9jYWxQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIExvY2FsUGVlcigpIHtcblxuICAgICAgLyoqXG4gICAgICAgKiBDb250YWlucyBwcm9taXNlcyBvZiB0aGUgbG9jYWwgc3RyZWFtcyBvZmZlcmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgICAqIEBwcm9wZXJ0eSBzdHJlYW1zXG4gICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAqL1xuICAgICAgdGhpcy5zdHJlYW1zID0ge307XG5cbiAgICAgIC8qKlxuICAgICAgICogQ29udGFpbnMgYWxsIERhdGFDaGFubmVsIGNvbmZpZ3VyYXRpb25zIG5lZ290aWF0ZWQgd2l0aCBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICAgKiBAcHJvcGVydHkgY2hhbm5lbHNcbiAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICovXG4gICAgICB0aGlzLmNoYW5uZWxzID0ge307XG4gICAgICB0aGlzLl9zdGF0dXMgPSB7fTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBhbiBpdGVtIG9mIHRoZSBzdGF0dXMgdHJhbnNmZXJyZWQgdG8gYWxsIHJlbW90ZSBwZWVyc1xuICAgICAqIEBtZXRob2Qgc3RhdHVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSB2YWx1ZS4gV2lsbCByZXR1cm5cbiAgICAgKiBAcmV0dXJuIFRoZSB2YWx1ZSBhc3NvY2lhdGVkIHdpdGggdGhlIGtleVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgYW4gaXRlbSBvZiB0aGUgc3RhdHVzIHRyYW5zZmVycmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUuIFdpbGwgcmV0dXJuXG4gICAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBzdG9yZVxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9zdGF0dXNba2V5XSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgdGhpcy5fc3RhdHVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0dXNba2V5XTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgZGF0YSBjaGFubmVsIHdoaWNoIHdpbGwgYmUgbmVnb3RpYXRlZCB3aXRoIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIGFkZERhdGFDaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdkYXRhJ10gTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtkZXNjXSBPcHRpb25zIHBhc3NlZCB0byBgUlRDRGF0YUNoYW5uZWwuY3JlYXRlRGF0YUNoYW5uZWwoKWBcbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuYWRkRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihuYW1lLCBkZXNjKSB7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2MgPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX0NIQU5ORUw7XG4gICAgICB9XG4gICAgICBpZiAoZGVzYyA9PSBudWxsKSB7XG4gICAgICAgIGRlc2MgPSB7XG4gICAgICAgICAgb3JkZXJlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5jaGFubmVsc1tuYW1lXSA9IGRlc2M7XG4gICAgICB0aGlzLmVtaXQoJ2NvbmZpZ3VyYXRpb25fY2hhbmdlZCcpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW0gdG8gYmUgc2VudCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBhZGRTdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7UHJvbWlzZSAtPiBydGMuU3RyZWFtIHwgcnRjLlN0cmVhbSB8IE9iamVjdH0gc3RyZWFtIFRoZSBzdHJlYW0sIGEgcHJvbWlzZSB0byB0aGUgc3RyZWFtIG9yIHRoZSBjb25maWd1cmF0aW9uIHRvIGNyZWF0ZSBhIHN0cmVhbSB3aXRoIGBydGMuU3RyZWFtLmNyZWF0ZVN0cmVhbSgpYFxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihuYW1lLCBvYmopIHtcbiAgICAgIHZhciBzYXZlU3RyZWFtLCBzdHJlYW1fcDtcbiAgICAgIHNhdmVTdHJlYW0gPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbV9wKSB7XG4gICAgICAgICAgX3RoaXMuc3RyZWFtc1tuYW1lXSA9IHN0cmVhbV9wO1xuICAgICAgICAgIF90aGlzLmVtaXQoJ2NvbmZpZ3VyYXRpb25fY2hhbmdlZCcpO1xuICAgICAgICAgIHJldHVybiBzdHJlYW1fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIGlmICgob2JqICE9IG51bGwgPyBvYmoudGhlbiA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShvYmopO1xuICAgICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oUHJvbWlzZS5yZXNvbHZlKG9iaikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyZWFtX3AgPSBTdHJlYW0uY3JlYXRlU3RyZWFtKG9iaik7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKHN0cmVhbV9wKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgbG9jYWwgc3RyZWFtXG4gICAgICogQG1ldGhvZCBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gUHJvbWlzZSBvZiB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBMb2NhbFBlZXIucHJvdG90eXBlLnN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9TVFJFQU07XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zdHJlYW1zW25hbWVdO1xuICAgIH07XG5cbiAgICByZXR1cm4gTG9jYWxQZWVyO1xuXG4gIH0pKFBlZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRXZlbnRFbWl0dGVyLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgdXNlciBpbiB0aGUgcm9vbVxuICAgKiBAY2xhc3MgcnRjLlBlZXJcbiAgICovXG5cbiAgZXhwb3J0cy5QZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGVlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBQZWVyKCkge1xuICAgICAgcmV0dXJuIFBlZXIuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9mIHRoZSBwZWVyIGhhcyBjaGFuZ2VkXG4gICAgICogQGV2ZW50IHN0YXR1c19jaGFuZ2VkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgb2YgdGhlIGNoYW5nZWQgc3RhdHNcbiAgICAgKiBAcGFyYW0gdmFsdWUgVmFsdWUgb2YgdGhlIGNoYW5nZWQgc3RhdHVzXG4gICAgICovXG5cbiAgICBQZWVyLnByb3RvdHlwZS5ERUZBVUxUX0NIQU5ORUwgPSAnZGF0YSc7XG5cbiAgICBQZWVyLnByb3RvdHlwZS5ERUZBVUxUX1NUUkVBTSA9ICdzdHJlYW0nO1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSB2YWx1ZSBvZiB0aGUgc3RhdHVzIG9iamVjdFxuICAgICAqIEBtZXRob2Qgc3RhdHVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IFxuICAgICAqIEByZXR1cm4gVGhlIHZhbHVlXG4gICAgICovXG5cbiAgICBQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERhdGFDaGFubmVsLCBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLCBQcm9taXNlLCBTdHJlYW0sIGNvbXBhdCwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9wcm9taXNlJyksIERlZmVycmVkID0gcmVmLkRlZmVycmVkLCBQcm9taXNlID0gcmVmLlByb21pc2U7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG4gIFN0cmVhbSA9IHJlcXVpcmUoJy4vc3RyZWFtJykuU3RyZWFtO1xuXG4gIERhdGFDaGFubmVsID0gcmVxdWlyZSgnLi9kYXRhX2NoYW5uZWwnKS5EYXRhQ2hhbm5lbDtcblxuICBjb21wYXQgPSByZXF1aXJlKCcuL2NvbXBhdCcpLmNvbXBhdDtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBAY2xhc3MgcnRjLlBlZXJDb25uZWN0aW9uXG4gICAqL1xuXG4gIGV4cG9ydHMuUGVlckNvbm5lY3Rpb24gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQZWVyQ29ubmVjdGlvbiwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBQZWVyQ29ubmVjdGlvbihvZmZlcmluZywgb3B0aW9uczEpIHtcbiAgICAgIHRoaXMub2ZmZXJpbmcgPSBvZmZlcmluZztcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMxO1xuICAgICAgdGhpcy5wYyA9IG5ldyBjb21wYXQuUGVlckNvbm5lY3Rpb24odGhpcy5faWNlT3B0aW9ucygpKTtcbiAgICAgIHRoaXMuY29ubmVjdF9kID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5zaWduYWxpbmdfcGVuZGluZyA9IFtdO1xuICAgICAgdGhpcy5wYy5vbmljZWNhbmRpZGF0ZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnaWNlX2NhbmRpZGF0ZScsIGV2ZW50LmNhbmRpZGF0ZSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25hZGRzdHJlYW0gPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0cmVhbV9hZGRlZCcsIG5ldyBTdHJlYW0oZXZlbnQuc3RyZWFtKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25kYXRhY2hhbm5lbCA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZGF0YV9jaGFubmVsX3JlYWR5JywgbmV3IERhdGFDaGFubmVsKGV2ZW50LmNoYW5uZWwpKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5wYy5vbnJlbW92ZXN0cmVhbSA9IGZ1bmN0aW9uKGV2ZW50KSB7fTtcbiAgICAgIHRoaXMucGMub25uZWdvdGlhdGlvbm5lZWRlZCA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coJ29ubmVnb3RpYXRpb25uZWVkZWQgY2FsbGVkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciByZWYxO1xuICAgICAgICAgIGlmIChfdGhpcy5wYy5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdmYWlsZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuX2Nvbm5lY3RFcnJvcihuZXcgRXJyb3IoXCJVbmFibGUgdG8gZXN0YWJsaXNoIElDRSBjb25uZWN0aW9uXCIpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKF90aGlzLnBjLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Nsb3NlZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jb25uZWN0X2QucmVqZWN0KG5ldyBFcnJvcignQ29ubmVjdGlvbiB3YXMgY2xvc2VkJykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoKHJlZjEgPSBfdGhpcy5wYy5pY2VDb25uZWN0aW9uU3RhdGUpID09PSAnY29ubmVjdGVkJyB8fCByZWYxID09PSAnY29tcGxldGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNvbm5lY3RfZC5yZXNvbHZlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uc2lnbmFsaW5nc3RhdGVjaGFuZ2UgPSBmdW5jdGlvbihldmVudCkge307XG4gICAgfVxuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLnNpZ25hbGluZyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBzZHA7XG4gICAgICBzZHAgPSBuZXcgY29tcGF0LlNlc3Npb25EZXNjcmlwdGlvbihkYXRhKTtcbiAgICAgIHJldHVybiB0aGlzLl9zZXRSZW1vdGVEZXNjcmlwdGlvbihzZHApLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnb2ZmZXInICYmIF90aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9hbnN3ZXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRJY2VDYW5kaWRhdGUgPSBmdW5jdGlvbihkZXNjKSB7XG4gICAgICB2YXIgY2FuZGlkYXRlO1xuICAgICAgaWYgKGRlc2MuY2FuZGlkYXRlICE9IG51bGwpIHtcbiAgICAgICAgY2FuZGlkYXRlID0gbmV3IGNvbXBhdC5JY2VDYW5kaWRhdGUoZGVzYyk7XG4gICAgICAgIHJldHVybiB0aGlzLnBjLmFkZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKFwiSUNFIHRyaWNrbGluZyBzdG9wcGVkXCIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX2ljZU9wdGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZXJ2ZXJzO1xuICAgICAgc2VydmVycyA9IFtdO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdHVuICE9IG51bGwpIHtcbiAgICAgICAgc2VydmVycy5wdXNoKHtcbiAgICAgICAgICB1cmw6IHRoaXMub3B0aW9ucy5zdHVuXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWNlU2VydmVyczogc2VydmVyc1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9vYU9wdGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wdGlvbmFsOiBbXSxcbiAgICAgICAgbWFuZGF0b3J5OiB7XG4gICAgICAgICAgT2ZmZXJUb1JlY2VpdmVBdWRpbzogdHJ1ZSxcbiAgICAgICAgICBPZmZlclRvUmVjZWl2ZVZpZGVvOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fc2V0UmVtb3RlRGVzY3JpcHRpb24gPSBmdW5jdGlvbihzZHApIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHZhciBkZXNjcmlwdGlvbjtcbiAgICAgICAgICBkZXNjcmlwdGlvbiA9IG5ldyBydGMuY29tcGF0LlNlc3Npb25EZXNjcmlwdGlvbihzZHApO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5zZXRSZW1vdGVEZXNjcmlwdGlvbihzZHAsIHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fb2ZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5jcmVhdGVPZmZlcihyZXNvbHZlLCByZWplY3QsIF90aGlzLl9vYU9wdGlvbnMoKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNkcCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fcHJvY2Vzc0xvY2FsU2RwKHNkcCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fYW5zd2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGMuY3JlYXRlQW5zd2VyKHJlc29sdmUsIHJlamVjdCwgX3RoaXMuX29hT3B0aW9ucygpKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc2RwKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLl9wcm9jZXNzTG9jYWxTZHAoc2RwKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKVtcImNhdGNoXCJdKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0RXJyb3IoZXJyKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9wcm9jZXNzTG9jYWxTZHAgPSBmdW5jdGlvbihzZHApIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIHZhciBzdWNjZXNzO1xuICAgICAgICAgIHN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBkYXRhO1xuICAgICAgICAgICAgZGF0YSA9IHtcbiAgICAgICAgICAgICAgc2RwOiBzZHAuc2RwLFxuICAgICAgICAgICAgICB0eXBlOiBzZHAudHlwZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIF90aGlzLmVtaXQoJ3NpZ25hbGluZycsIGRhdGEpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoc2RwKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wYy5zZXRMb2NhbERlc2NyaXB0aW9uKHNkcCwgc3VjY2VzcywgcmVqZWN0KTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9jb25uZWN0RXJyb3IgPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgIHRoaXMuY29ubmVjdF9kLnJlamVjdChlcnIpO1xuICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgcmV0dXJuIHRoaXMucGMuYWRkU3RyZWFtKHN0cmVhbS5zdHJlYW0pO1xuICAgIH07XG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUucmVtb3ZlU3JlYW0gPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgIHJldHVybiB0aGlzLnBjLnJlbW92ZVN0cmVhbShzdHJlYW0uc3RyZWFtKTtcbiAgICB9O1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmFkZERhdGFDaGFubmVsID0gZnVuY3Rpb24obmFtZSwgb3B0aW9ucykge1xuICAgICAgdmFyIGNoYW5uZWw7XG4gICAgICBpZiAodGhpcy5vZmZlcmluZykge1xuICAgICAgICBjaGFubmVsID0gdGhpcy5wYy5jcmVhdGVEYXRhQ2hhbm5lbChuYW1lLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIGNoYW5uZWwub25vcGVuID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChjaGFubmVsKSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMuY29ubmVjdGVkKSB7XG4gICAgICAgIGlmICh0aGlzLm9mZmVyaW5nKSB7XG4gICAgICAgICAgdGhpcy5fb2ZmZXIoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBjLnNpZ25hbGluZ1N0YXRlID09PSAnaGF2ZS1yZW1vdGUtb2ZmZXInKSB7XG4gICAgICAgICAgdGhpcy5fYW5zd2VyKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9kLnByb21pc2U7XG4gICAgfTtcblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wYy5jbG9zZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyQ29ubmVjdGlvbjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQ2hhbm5lbENvbGxlY3Rpb24sIFBlZXIsIFByb21pc2UsIFN0cmVhbUNvbGxlY3Rpb24sXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBQcm9taXNlID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9wcm9taXNlJykuUHJvbWlzZTtcblxuICBQZWVyID0gcmVxdWlyZSgnLi9wZWVyJykuUGVlcjtcblxuICBTdHJlYW1Db2xsZWN0aW9uID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbicpLlN0cmVhbUNvbGxlY3Rpb247XG5cbiAgQ2hhbm5lbENvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2ludGVybmFsL2NoYW5uZWxfY29sbGVjdGlvbicpLkNoYW5uZWxDb2xsZWN0aW9uO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSByZW1vdGUgdXNlciBvZiB0aGUgcm9vbVxuICAgKiBAY2xhc3MgcnRjLlJlbW90ZVBlZXJcbiAgICogQGV4dGVuZHMgcnRjLlBlZXJcbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtydGMuUGVlckNvbm5lY3Rpb259IHBlZXJfY29ubmVjdGlvbiBUaGUgdW5kZXJseWluZyBwZWVyIGNvbm5lY3Rpb25cbiAgICogQHBhcmFtIHtydGMuU2lnbmFsaW5nUGVlcn0gc2lnbmFsaW5nIFRoZSBzaWduYWxpbmcgY29ubmVjdGlvbiB0byB0aGUgcGVlclxuICAgKiBAcGFyYW0ge3J0Yy5Mb2NhbFBlZXJ9IGxvY2FsIFRoZSBsb2NhbCBwZWVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFRoZSBvcHRpb25zIG9iamVjdCBhcyBwYXNzZWQgdG8gYFJvb21gXG4gICAqL1xuXG4gIGV4cG9ydHMuUmVtb3RlUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFJlbW90ZVBlZXIsIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBNZXNzYWdlIHJlY2VpdmVkIGZyb20gcGVlciB0aHJvdWdoIHNpZ25hbGluZ1xuICAgICAqIEBldmVudCBtZXNzYWdlXG4gICAgICogQHBhcmFtIGRhdGEgVGhlIHBheWxvYWQgb2YgdGhlIG1lc3NhZ2VcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbW90ZSBwZWVyIGxlZnQgb3Igc2lnbmFsaW5nIGNsb3NlZFxuICAgICAqIEBldmVudCBsZWZ0XG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIEEgbmV3IHN0cmVhbSBpcyBhdmFpbGFibGUgZnJvbSB0aGUgcGVlclxuICAgICAqIEBldmVudCBzdHJlYW1fYWRkZWRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gc3RyZWFtIFByb21pc2Ugb2YgdGhlIHN0cmVhbVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBkYXRhIGNoYW5uZWwgaXMgYXZhaWxhYmxlIGZyb20gdGhlIHBlZXJcbiAgICAgKiBAZXZlbnQgZGF0YV9jaGFubmVsX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBzdHJlYW0gUHJvbWlzZSBvZiB0aGUgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gUmVtb3RlUGVlcihwZWVyX2Nvbm5lY3Rpb24sIHNpZ25hbGluZywgbG9jYWwsIG9wdGlvbnMxKSB7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbiA9IHBlZXJfY29ubmVjdGlvbjtcbiAgICAgIHRoaXMuc2lnbmFsaW5nID0gc2lnbmFsaW5nO1xuICAgICAgdGhpcy5sb2NhbCA9IGxvY2FsO1xuICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9uczE7XG4gICAgICB0aGlzLnN0cmVhbV9jb2xsZWN0aW9uID0gbmV3IFN0cmVhbUNvbGxlY3Rpb24oKTtcbiAgICAgIHRoaXMuc3RyZWFtcyA9IHRoaXMuc3RyZWFtX2NvbGxlY3Rpb24uc3RyZWFtcztcbiAgICAgIHRoaXMuc3RyZWFtc19kZXNjID0ge307XG4gICAgICB0aGlzLnN0cmVhbV9jb2xsZWN0aW9uLm9uKCdzdHJlYW1fYWRkZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUsIHN0cmVhbSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdHJlYW1fYWRkZWQnLCBuYW1lLCBzdHJlYW0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24gPSBuZXcgQ2hhbm5lbENvbGxlY3Rpb24oKTtcbiAgICAgIHRoaXMuY2hhbm5lbHMgPSB0aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5jaGFubmVscztcbiAgICAgIHRoaXMuY2hhbm5lbHNfZGVzYyA9IHt9O1xuICAgICAgdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24ub24oJ2RhdGFfY2hhbm5lbF9hZGRlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obmFtZSwgY2hhbm5lbCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdkYXRhX2NoYW5uZWxfYWRkZWQnLCBuYW1lLCBjaGFubmVsKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdzdHJlYW1fYWRkZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zdHJlYW1fY29sbGVjdGlvbi5yZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignZGF0YV9jaGFubmVsX3JlYWR5JywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihjaGFubmVsKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5yZXNvbHZlKGNoYW5uZWwpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ3NpZ25hbGluZycsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIGRhdGEuc3RyZWFtcyA9IF90aGlzLnN0cmVhbXNfZGVzYztcbiAgICAgICAgICBkYXRhLmNoYW5uZWxzID0gX3RoaXMuY2hhbm5lbHNfZGVzYztcbiAgICAgICAgICByZXR1cm4gX3RoaXMuc2lnbmFsaW5nLnNlbmQoJ3NpZ25hbGluZycsIGRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ3NpZ25hbGluZycsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIF90aGlzLnN0cmVhbV9jb2xsZWN0aW9uLnVwZGF0ZShkYXRhLnN0cmVhbXMpO1xuICAgICAgICAgIF90aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5zZXRSZW1vdGUoZGF0YS5jaGFubmVscyk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBlZXJfY29ubmVjdGlvbi5zaWduYWxpbmcoZGF0YSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignaWNlX2NhbmRpZGF0ZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnNpZ25hbGluZy5zZW5kKCdpY2VfY2FuZGlkYXRlJywgY2FuZGlkYXRlKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdpY2VfY2FuZGlkYXRlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihjYW5kaWRhdGUpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5zaWduYWxpbmcub24oJ3N0YXR1c19jaGFuZ2VkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywga2V5LCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbignbWVzc2FnZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdtZXNzYWdlJywgZGF0YSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbignbGVmdCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2xlZnQnKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdjb25uZWN0ZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge307XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignY2xvc2VkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHt9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgaWYgKCh0aGlzLm9wdGlvbnMuYXV0b19jb25uZWN0ID09IG51bGwpIHx8ICF0aGlzLm9wdGlvbnMuYXV0b19jb25uZWN0KSB7XG4gICAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLnN0YXR1cyA9IGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLnN0YXR1c1trZXldO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoZSBwZWVyIHRocm91Z2ggc2lnbmFsaW5nXG4gICAgICogQG1ldGhvZCBtZXNzYWdlXG4gICAgICogQHBhcmFtIGRhdGEgVGhlIHBheWxvYWRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gdGhlIGRhdGEgd2FzIHNlbnRcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLm1lc3NhZ2UgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcuc2VuZCgnbWVzc2FnZScsIGRhdGEpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3QgdG8gdGhlIHJlbW90ZSBwZWVyIHRvIGV4Y2hhbmdlIHN0cmVhbXMgYW5kIGNyZWF0ZSBkYXRhIGNoYW5uZWxzXG4gICAgICogQG1ldGhvZCBjb25uZWN0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCB3aWxsIHJlc29sdmVkIHdoZW4gdGhlIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWRcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBuYW1lLCBwcm9taXNlLCByZWYsIHN0cmVhbSwgc3RyZWFtX3Byb21pc2VzO1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgc3RyZWFtX3Byb21pc2VzID0gW107XG4gICAgICAgIHJlZiA9IHRoaXMubG9jYWwuc3RyZWFtcztcbiAgICAgICAgZm9yIChuYW1lIGluIHJlZikge1xuICAgICAgICAgIHN0cmVhbSA9IHJlZltuYW1lXTtcbiAgICAgICAgICBwcm9taXNlID0gc3RyZWFtLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgICByZXR1cm4gW25hbWUsIHN0cmVhbV07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc3RyZWFtX3Byb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBQcm9taXNlLmFsbChzdHJlYW1fcHJvbWlzZXMpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbXMpIHtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIG9wdGlvbnMsIHJlZjEsIHJlZjI7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBzdHJlYW1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgIHJlZjEgPSBzdHJlYW1zW2ldLCBuYW1lID0gcmVmMVswXSwgc3RyZWFtID0gcmVmMVsxXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZFN0cmVhbShzdHJlYW0pO1xuICAgICAgICAgICAgICBfdGhpcy5zdHJlYW1zX2Rlc2NbbmFtZV0gPSBzdHJlYW0uaWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlZjIgPSBfdGhpcy5sb2NhbC5jaGFubmVscztcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiByZWYyKSB7XG4gICAgICAgICAgICAgIG9wdGlvbnMgPSByZWYyW25hbWVdO1xuICAgICAgICAgICAgICBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uYWRkRGF0YUNoYW5uZWwobmFtZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgIF90aGlzLmNoYW5uZWxzX2Rlc2NbbmFtZV0gPSBvcHRpb25zO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLnNldExvY2FsKF90aGlzLmNoYW5uZWxzX2Rlc2MpO1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLnBlZXJfY29ubmVjdGlvbi5jb25uZWN0KCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiB0byB0aGUgcGVlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBhIHN0cmVhbSBmcm9tIHRoZSBwZWVyLiBIYXMgdG8gYmUgc2VudCBieSB0aGUgcmVtb3RlIHBlZXIgdG8gc3VjY2VlZC5cbiAgICAgKiBAbWV0aG9kIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nc3RyZWFtJ10gTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLnN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9TVFJFQU07XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zdHJlYW1fY29sbGVjdGlvbi5nZXQobmFtZSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgZGF0YSBjaGFubmVsIHRvIHRoZSByZW1vdGUgcGVlci4gSGFzIHRvIGJlIGFkZGVkIGJ5IGxvY2FsIGFuZCByZW1vdGUgc2lkZSB0byBzdWNjZWVkLlxuICAgICAqIEBtZXRob2QgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nZGF0YSddIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gcnRjLkRhdGFDaGFubmVsfSBQcm9taXNlIG9mIHRoZSBkYXRhIGNoYW5uZWxcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLmNoYW5uZWwgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfQ0hBTk5FTDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5nZXQobmFtZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBSZW1vdGVQZWVyO1xuXG4gIH0pKFBlZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRXZlbnRFbWl0dGVyLCBMb2NhbFBlZXIsIE11Y1NpZ25hbGluZywgUGVlckNvbm5lY3Rpb24sIFJlbW90ZVBlZXIsIFdlYlNvY2tldENoYW5uZWwsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cbiAgV2ViU29ja2V0Q2hhbm5lbCA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nL3dlYl9zb2NrZXRfY2hhbm5lbC5jb2ZmZWUnKS5XZWJTb2NrZXRDaGFubmVsO1xuXG4gIE11Y1NpZ25hbGluZyA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nL211Y19zaWduYWxpbmcuY29mZmVlJykuTXVjU2lnbmFsaW5nO1xuXG4gIFJlbW90ZVBlZXIgPSByZXF1aXJlKCcuL3JlbW90ZV9wZWVyLmNvZmZlZScpLlJlbW90ZVBlZXI7XG5cbiAgTG9jYWxQZWVyID0gcmVxdWlyZSgnLi9sb2NhbF9wZWVyLmNvZmZlZScpLkxvY2FsUGVlcjtcblxuICBQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vcGVlcl9jb25uZWN0aW9uLmNvZmZlZScpLlBlZXJDb25uZWN0aW9uO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgdmlydHVhbCByb29tIHdoaWNoIGNvbm5lY3RzIG11bHRpcGxlIFBlZXJzXG4gICAqIEBjbGFzcyBydGMuUm9vbVxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgcm9vbS4gV2lsbCBiZSBwYXNzZWQgb24gdG8gc2lnbmFsaW5nXG4gICAqIEBwYXJhbSB7cnRjLlNpZ25hbGluZyB8IFN0cmluZ30gc2lnbmFsaW5nIFRoZSBzaWduYWxpbmcgdG8gYmUgdXNlZC4gSWYgeW91IHBhc3MgYSBzdHJpbmcgaXQgd2lsbCBiZSBpbnRlcnByZXRlZCBhcyBhIHdlYnNvY2tldCBhZGRyZXNzIGFuZCBhIHBhbGF2YSBzaWduYWxpbmcgY29ubmVjdGlvbiB3aWxsIGJlIGVzdGFibGlzaGVkIHdpdGggaXQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gVmFyaW91cyBvcHRpb25zIHRvIGJlIHVzZWQgaW4gY29ubmVjdGlvbnMgY3JlYXRlZCBieSB0aGlzIHJvb21cbiAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5hdXRvX2Nvbm5lY3Q9dHJ1ZV0gV2hldGhlciByZW1vdGUgcGVlcnMgYXJlIGNvbm5lY3RlZCBhdXRvbWF0aWNhbGx5IG9yIGFuIGV4cGxpY2l0IGBSZW1vdGVQZWVyLmNvbm5lY3QoKWAgY2FsbCBpcyBuZWVkZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLnN0dW5dIFRoZSBVUkkgb2YgdGhlIFNUVU4gc2VydmVyIHRvIHVzZVxuICAgKiBAcGFyYW0ge3J0Yy5Mb2NhbFBlZXJ9IFtvcHRpb25zLmxvY2FsXSBUaGUgbG9jYWwgdXNlclxuICAgKi9cblxuICBleHBvcnRzLlJvb20gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChSb29tLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgcGVlciBpcyBlbmNvdW50ZXJlZCBpbiB0aGUgcm9vbS4gRmlyZXMgb24gbmV3IHJlbW90ZSBwZWVycyBhZnRlciBqb2luaW5nIGFuZCBmb3IgYWxsIHBlZXJzIGluIHRoZSByb29tIHdoZW4gam9pbmluZy5cbiAgICAgKiBAZXZlbnQgcGVlcl9qb3BpbmVkXG4gICAgICogQHBhcmFtIHtydGMuUmVtb3RlUGVlcn0gcGVlciBUaGUgbmV3IHBlZXJcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHJvb20gd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFJvb20oc2lnbmFsaW5nLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY2hhbm5lbDtcbiAgICAgIHRoaXMuc2lnbmFsaW5nID0gc2lnbmFsaW5nO1xuICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyAhPSBudWxsID8gb3B0aW9ucyA6IHt9O1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLnNpZ25hbGluZyA9PT0gJ3N0cmluZycgfHwgdGhpcy5zaWduYWxpbmcgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgY2hhbm5lbCA9IG5ldyBXZWJTb2NrZXRDaGFubmVsKHRoaXMuc2lnbmFsaW5nKTtcbiAgICAgICAgdGhpcy5zaWduYWxpbmcgPSBuZXcgTXVjU2lnbmFsaW5nKGNoYW5uZWwpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbCA9IHRoaXMub3B0aW9ucy5sb2NhbCB8fCBuZXcgTG9jYWxQZWVyKCk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbigncGVlcl9qb2luZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNpZ25hbGluZ19wZWVyKSB7XG4gICAgICAgICAgdmFyIHBjLCBwZWVyO1xuICAgICAgICAgIHBjID0gbmV3IFBlZXJDb25uZWN0aW9uKHNpZ25hbGluZ19wZWVyLmZpcnN0LCBfdGhpcy5vcHRpb25zKTtcbiAgICAgICAgICBwZWVyID0gbmV3IFJlbW90ZVBlZXIocGMsIHNpZ25hbGluZ19wZWVyLCBfdGhpcy5sb2NhbCwgX3RoaXMub3B0aW9ucyk7XG4gICAgICAgICAgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdID0gcGVlcjtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgIHJldHVybiBwZWVyLm9uKCdjbG9zZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWxldGUgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogSm9pbnMgdGhlIHJvb20uIEluaXRpYXRlcyBjb25uZWN0aW9uIHRvIHNpZ25hbGluZyBzZXJ2ZXIgaWYgbm90IGRvbmUgYmVmb3JlLlxuICAgICAqIEBtZXRob2Qgam9pblxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIHJvb20gd2FzIGpvaW5lZFxuICAgICAqL1xuXG4gICAgUm9vbS5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuam9pbl9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5qb2luX3AgPSB0aGlzLnNpZ25hbGluZy5jb25uZWN0KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5qb2luX3A7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTGVhdmVzIHRoZSByb29tIGFuZCBjbG9zZXMgYWxsIGVzdGFibGlzaGVkIHBlZXIgY29ubmVjdGlvbnNcbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLmxlYXZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xlYW5zIHVwIGFsbCByZXNvdXJjZXMgdXNlZCBieSB0aGUgcm9vbS5cbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcubGVhdmUoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFJvb207XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsIFNpZ25hbGluZywgU2lnbmFsaW5nUGVlciwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9wcm9taXNlJykuRGVmZXJyZWQ7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9zaWduYWxpbmcnKSwgU2lnbmFsaW5nID0gcmVmLlNpZ25hbGluZywgU2lnbmFsaW5nUGVlciA9IHJlZi5TaWduYWxpbmdQZWVyO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICovXG5cblxuICAvKipcbiAgICogU2lnbmFsaW5nIHBlZXIgZm9yIG11bHRpIHVzZXIgY2hhdHMuXG4gICNcbiAgICogRm9yIGEgZGV0YWlsZWQgZGVzY3JpcHRpb24gb2YgdGhlIHNpZ25hbGluZyBwcm90b2NvbCBzZWUgYHJ0Yy5zaWduYWxpbmcuTXVjU2lnbmFsaW5nYFxuICAjXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nUGVlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5NdWNTaWduYWxpbmdQZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLnNpZ25hbGluZy5DaGFubmVsfSBjaGFubmVsIFRoZSBjaGFubmVsIHRvIHRoZSBzaWdhbmxpbmcgc2VydmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwZWVyX2lkIFRoZSBpZCBvZiB0aGUgcmVtb3RlIHBlZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0YXR1cyBUaGUgc3RhdHVzIG9mIHRoZSByZW1vdGUgcGVlclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGZpcnN0IFdoZXRoZXIgdGhlIGxvY2FsIHBlZXIgd2FzIGluIHRoZSByb29tIGJlZm9yZSB0aGUgcmVtb3RlIHBlZXJcbiAgICovXG5cbiAgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTXVjU2lnbmFsaW5nUGVlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBNdWNTaWduYWxpbmdQZWVyKGNoYW5uZWwsIHBlZXJfaWQxLCBzdGF0dXMxLCBmaXJzdCkge1xuICAgICAgdmFyIHJlY3ZfbXNnO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMucGVlcl9pZCA9IHBlZXJfaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5maXJzdCA9IGZpcnN0O1xuICAgICAgcmVjdl9tc2cgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBpZiAoZGF0YS5wZWVyICE9PSBfdGhpcy5wZWVyX2lkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhLnR5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZnJvbSc6XG4gICAgICAgICAgICAgIGlmICgoZGF0YS5ldmVudCA9PSBudWxsKSB8fCAoZGF0YS5kYXRhID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX2xlZnQnOlxuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdsZWZ0Jyk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgICAgICAgY2FzZSAncGVlcl9zdGF0dXMnOlxuICAgICAgICAgICAgICBfdGhpcy5zdGF0dXMgPSBkYXRhLnN0YXR1cztcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ25ld19zdGF0dXMnLCBfdGhpcy5zdGF0dXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgIH1cblxuICAgIE11Y1NpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkYXRhID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICB0eXBlOiAndG8nLFxuICAgICAgICBwZWVyOiB0aGlzLnBlZXJfaWQsXG4gICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgZGF0YTogZGF0YVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBNdWNTaWduYWxpbmdQZWVyO1xuXG4gIH0pKFNpZ25hbGluZ1BlZXIpO1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBmb3IgbXVsdGkgdXNlciBjaGF0c1xuICAjXG4gICAqIFRoZSBmb2xsb3dpbmcgbWVzc2FnZXMgYXJlIHNlbnQgdG8gdGhlIHNlcnZlcjpcbiAgI1xuICAgKiAgICAgLy8gam9pbiB0aGUgcm9vbS4gaGFzIHRvIGJlIHNlbnQgYmVmb3JlIGFueSBvdGhlciBtZXNzYWdlLlxuICAgKiAgICAgLy8gcmVzcG9uc2Ugd2lsbCBiZSAnam9pbmVkJyBvbiBzdWNjZXNzXG4gICAqICAgICAvLyBvdGhlciBwZWVycyBpbiB0aGUgcm9vbSB3aWxsIGdldCAncGVlcl9qb2luZWQnXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcImpvaW5cIixcbiAgICogICAgICAgXCJzdGF0dXNcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBsZWF2ZSB0aGUgcm9vbS4gc2VydmVyIHdpbGwgY2xvc2UgdGhlIGNvbm5lY3Rpbm8uXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcImxlYXZlXCJcbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gdXBkYXRlIHN0YXR1cyBvYmplY3RcbiAgICogICAgIC8vIG90aGVyIHBlZXJzIHdpbGwgZ2V0ICdwZWVyX3N0YXR1cydcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwic3RhdHVzXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gc2VuZCBtZXNzYWdlIHRvIGEgcGVlci4gd2lsbCBiZSByZWNlaXZlZCBhcyAndG8nXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInRvXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJldmVudFwiOiBcImV2ZW50X2lkXCIsXG4gICAqICAgICAgIFwiZGF0YVwiOiB7IC4uIGN1c3RvbSBkYXRhIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiBUaGUgZm9sbG93aW5nIG1lc3NhZ2VzIGFyZSByZWNlaXZlZCBmb3JtIHRoZSBzZXJ2ZXI6XG4gICNcbiAgICogICAgIC8vIGpvaW5lZCB0aGUgcm9vbS4gaXMgdGhlIHJlc3BvbnNlIHRvICdqb2luJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJqb2luZWRcIixcbiAgICogICAgICAgXCJwZWVyc1wiOiB7XG4gICAqICAgICAgICAgXCJwZWVyX2lkXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgICAgfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBhbm90aGVyIHBlZXIgam9pbmVkIHRoZSByb29tLlxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJwZWVyX2pvaW5lZFwiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gYW5vc3RoZXIgcGVlciB1cGRhdGVkIGl0cyBzdGF0dXMgb2JqZWN0IHVzaW5nICdzdGF0dXMnXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInBlZXJfc3RhdHVzXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJzdGF0dXNcIjogeyAuLiBzdGF0dXMgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBhbm90aGVyIHBlZXIgbGVmdCB0aGUgcm9vbVxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJwZWVyX2xlZnRcIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiXG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIG1lc3NhZ2UgZnJvbSBhbm90aGVyIHBlZXIgc2VudCBieSAndG8nXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcImZyb21cIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiLFxuICAgKiAgICAgICBcImV2ZW50XCI6IFwiZXZlbnRfaWRcIixcbiAgICogICAgICAgXCJkYXRhXCI6IHsgLi4gY3VzdG9tIGRhdGEgLi4gfVxuICAgKiAgICAgfVxuICAjXG4gICAqIFRoZSBtZXNzYWdlcyB0cmFuc21pdHRlZCBpbiB0aGUgYHRvYC9gZnJvbWAgbWVzc2FnZXMgYXJlIGVtaXR0ZWQgYXMgZXZlbnRzIGluIGBNdWNTaWduYWxpbmdQZWVyYFxuICAjXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLk11Y1NpZ25hbGluZ1xuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge3J0Yy5zaWduYWxpbmcuQ2hhbm5lbH0gY2hhbm5lbCBUaGUgY2hhbm5lbCB0byB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIFRoZSBzdGF0dXMgb2YgdGhlIGxvY2FsIHBlZXJcbiAgICovXG5cbiAgZXhwb3J0cy5NdWNTaWduYWxpbmcgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChNdWNTaWduYWxpbmcsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gTXVjU2lnbmFsaW5nKGNoYW5uZWwsIHN0YXR1czEpIHtcbiAgICAgIHZhciBqb2luX2Q7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgam9pbl9kID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLmpvaW5fcCA9IGpvaW5fZC5wcm9taXNlO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdjbG9zZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIHZhciBwZWVyLCBwZWVyX2lkLCByZWYxLCBzdGF0dXM7XG4gICAgICAgICAgaWYgKGRhdGEudHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAoZGF0YS50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdqb2luZWQnOlxuICAgICAgICAgICAgICBpZiAoZGF0YS5wZWVycyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlZjEgPSBkYXRhLnBlZXJzO1xuICAgICAgICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcmVmMSkge1xuICAgICAgICAgICAgICAgIHN0YXR1cyA9IHJlZjFbcGVlcl9pZF07XG4gICAgICAgICAgICAgICAgcGVlciA9IG5ldyBleHBvcnRzLk11Y1NpZ25hbGluZ1BlZXIoX3RoaXMuY2hhbm5lbCwgcGVlcl9pZCwgc3RhdHVzLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gam9pbl9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGNhc2UgJ3BlZXJfam9pbmVkJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIGRhdGEucGVlciwgZGF0YS5zdGF0dXMsIHRydWUpO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgTXVjU2lnbmFsaW5nLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbm5lY3RfcCA9IHRoaXMuY2hhbm5lbC5jb25uZWN0KCkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2pvaW4nLFxuICAgICAgICAgICAgICBzdGF0dXM6IF90aGlzLnN0YXR1c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmpvaW5fZDtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3A7XG4gICAgfTtcblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUuc2V0U3RhdHVzID0gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3AudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICAgICAgdHlwZTogJ3N0YXR1cycsXG4gICAgICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTXVjU2lnbmFsaW5nLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgdHlwZTogJ2xlYXZlJ1xuICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBNdWNTaWduYWxpbmc7XG5cbiAgfSkoU2lnbmFsaW5nKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBwZWVyIGNvbXBhdGlibGUgd2l0aCB0aGUgZnJhbWluZyBvZiBwYWxhdmEgc2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLlBhbGF2YVNpZ25hbGluZ1BlZXJcbiAgICovXG5cbiAgZXhwb3J0cy5QYWxhdmFTaWduYWxpbmdQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGFsYXZhU2lnbmFsaW5nUGVlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBQYWxhdmFTaWduYWxpbmdQZWVyKGNoYW5uZWwsIGlkLCBzdGF0dXMxLCBmaXJzdCkge1xuICAgICAgdmFyIHJlY3ZfbXNnO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMuaWQgPSBpZDtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMuZmlyc3QgPSBmaXJzdDtcbiAgICAgIHJlY3ZfbXNnID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgaWYgKGRhdGEuc2VuZGVyX2lkICE9PSBfdGhpcy5pZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGF0YS5ldmVudCA9PSBudWxsKSB7XG4gICAgICAgICAgICBfdGhpcy5zZW5kKCdlcnJvcicsIFwiSW52YWxpZCBtZXNzYWdlXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdChkYXRhLmV2ZW50LCBkYXRhLmRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgICB0aGlzLm9uKCdwZWVyX3VwZGF0ZWRfc3RhdHVzJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdGF0dXMpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbmV3X3N0YXR1cycsIHN0YXR1cyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLm9uKCdwZWVyX2xlZnQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIFBhbGF2YVNpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkYXRhID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICBldmVudDogJ3NlbmRfdG9fcGVlcicsXG4gICAgICAgIHBlZXJfaWQ6IHRoaXMuaWQsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBhbGF2YVNpZ25hbGluZ1BlZXI7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgaW1wbGVtZW50YXRpb24gY29tcGF0aWJsZSB3aXRoIHRoZSBmcmFtaW5nIG9mIHBhbGF2YSBzaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuUGFsYXZhU2lnbmFsaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGFsYXZhU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBhbGF2YVNpZ25hbGluZyhjaGFubmVsLCByb29tMSwgc3RhdHVzMSkge1xuICAgICAgdmFyIGpvaW5fZDtcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLnJvb20gPSByb29tMTtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMucGVlcnMgPSB7fTtcbiAgICAgIHRoaXMuam9pbmVkID0gZmFsc2U7XG4gICAgICBqb2luX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuam9pbl9wID0gam9pbl9kLnByb21pc2U7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgdmFyIGksIHBlZXIsIHJlZjtcbiAgICAgICAgICBpZiAoZGF0YS5ldmVudCA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN3aXRjaCAoZGF0YS5ldmVudCkge1xuICAgICAgICAgICAgY2FzZSAnam9pbmVkX3Jvb20nOlxuICAgICAgICAgICAgICBpZiAoKGRhdGEucGVlcnMgPT0gbnVsbCkgfHwgKGRhdGEub3duX2lkID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlZiA9IGRhdGEucGVlcnM7XG4gICAgICAgICAgICAgIGZvciAoaSBpbiByZWYpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gcmVmW2ldO1xuICAgICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5QYWxhdmFTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIGRhdGEucGVlcl9pZCwgZGF0YS5zdGF0dXMsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5wZWVyc1tkYXRhLnBlZXJfaWRdID0gcGVlcjtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBqb2luX2QucmVzb2x2ZSgpO1xuICAgICAgICAgICAgY2FzZSAnbmV3X3BlZXInOlxuICAgICAgICAgICAgICBpZiAoZGF0YS5wZWVyX2lkID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGVlciA9IG5ldyBleHBvcnRzLlBhbGF2YVNpZ25hbGluZ1BlZXIoX3RoaXMuY2hhbm5lbCwgZGF0YS5wZWVyX2lkLCBkYXRhLnN0YXR1cywgdHJ1ZSk7XG4gICAgICAgICAgICAgIF90aGlzLnBlZXJzW2RhdGEucGVlcl0gPSBwZWVyO1xuICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgUGFsYXZhU2lnbmFsaW5nLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbm5lY3RfcCA9IHRoaXMuY2hhbm5lbC5jb25uZWN0KCkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgICAgICAgZXZlbnQ6ICdqb2luX3Jvb20nLFxuICAgICAgICAgICAgICByb29tX2lkOiByb29tLFxuICAgICAgICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBQYWxhdmFTaWduYWxpbmcucHJvdG90eXBlLnNldF9zdGF0dXMgPSBmdW5jdGlvbihzdGF0dXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIGV2ZW50OiAndXBkYXRlX3N0YXR1cycsXG4gICAgICAgIHN0YXR1czogc3RhdHVzXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgUGFsYXZhU2lnbmFsaW5nLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5jbG9zZSgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gUGFsYXZhU2lnbmFsaW5nO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIENvbmNlcHQgb2YgYSBjbGFzcyBpbXBsZW1lbnRpbmcgc2lnbmFsaW5nLiBNaWdodCB1c2UgYSBgcnRjLnNpZ25hbGluZy5DaGFubmVsYCB0byBhYnN0cmFjdCB0aGUgY29ubmVjdGlvbiB0byB0aGUgc2VydmVyLlxuICAjXG4gICAqIFlvdSBkbyBub3QgaGF2ZSB0byBleHRlbmQgdGhpcyBjbGFhc3MsIGp1c3QgaW1wbGVtZW50IHRoZSBmdW5jdGlvbmFsaXR5LlxuICAjXG4gICAqIEBleHRlbmRzIGV2ZW50cy5FdmVudEVtaXR0ZXJcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuU2lnbmFsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFNpZ25hbGluZygpIHtcbiAgICAgIHJldHVybiBTaWduYWxpbmcuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBwZWVyIGpvaW5lZCB0aGUgcm9vbVxuICAgICAqIEBldmVudCBwZWVyX2pvaW5lZFxuICAgICAqIEBwYXJhbSB7cnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyfSBwZWVyIFRoZSBuZXcgcGVlclxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29ubmVjdGlvbiB0byB0aGUgc2lnbmFsaW5nIHNlcnZlciB3YXMgY2xvc2VkXG4gICAgICogQGV2ZW50IGNsb3NlZFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBFc3RhYmxpc2hlcyB0aGUgY29ubmVjdGlvbiB3aXRoIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQG1ldGhvZCBjb25uZWN0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBTaWduYWxpbmcucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIGNsb3NlXG4gICAgICovXG5cbiAgICBTaWduYWxpbmcucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBTaWduYWxpbmc7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuXG4gIC8qKlxuICAgKiBDb25jZXB0IG9mIGEgY2xhc3MgaW1wbGVtZW50aW5nIGEgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gYSBwZWVyLlxuICAjXG4gICAqIFlvdSBkbyBub3QgaGF2ZSB0byBleHRlbmQgdGhpcyBjbGFzcywganVzdCBpbXBsZW1lbnQgdGhlIGZ1bmN0aW9uYWxpdHkuXG4gICNcbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuU2lnbmFsaW5nUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFNpZ25hbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gU2lnbmFsaW5nUGVlcigpIHtcbiAgICAgIHJldHVybiBTaWduYWxpbmdQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbW90ZSBwZWVyIGxlZnQgdGhlIHJvb21cbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBSZWNlaXZlZCBhIG1lc3NhZ2UgZnJvbSB0aGUgcmVtb3RlIHBlZXJcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBJRCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcGFyYW0ge09iZWpjdH0gZGF0YSBQYXlsb2FkIG9mIHRoZSBldmVudFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9iamVjdCBvZiB0aGUgcmVtb3RlIHBlZXIgd2FzIHVwZGF0ZWRcbiAgICAgKiBAZXZlbnQgbmV3X3N0YXR1c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0dXMgVGhlIG5ldyBzdGF0dXNcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXR1cyBvYmplY3Qgb2YgdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQHByb3BlcnR5IHN0YXR1c1xuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBsb2NhbCB1c2VyIHdhcyBpbiB0aGUgcm9vbSBiZWZvcmUgdGhlIHJlbW90ZSB1c2VyICh1c2VkIHRvIGRldGVybWluZSB3aGljaCBwZWVyIHdpbGwgaW5pdGlhdGUgdGhlIGNvbm5lY3Rpb24pXG4gICAgICogQHByb3BlcnR5IGZpcnN0XG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kcyB0aGUgZXZlbnQgd2l0aCB0aGUgZ2l2ZW4gcGF5bG9hZCB0byB0aGUgcmVtb3RlIHBlZXJcbiAgICAgKiBAbWV0aG9kIHNlbmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgVGhlIGlkIG9mIHRoZSBldmVudFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIFRoZSBwYXlsb2FkIG9mIHRoZSBldmVudFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCBiZSByZXNvbHZlZCBvbmNlIHRoZSBtZXNzYWdlIGlzIHNlbnRcbiAgICAgKi9cblxuICAgIFNpZ25hbGluZ1BlZXIucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkYXRhID0ge307XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBTaWduYWxpbmdQZWVyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cblxuICAvKipcbiAgICogQ29uY2VwdCBvZiBhIGNsYXNzIGltcGxlbWVudGluZyBhIHNpZ25hbGluZyBjaGFubmVsLiBNaWdodCBiZSB1c2VkIGJ5IHNpZ25hbGluZyBpbXBsZW1lbnRhdGlvbnMgdG8gY29ubmVjdCB0byBhIHNpZ25hbGluZyBzZXJ2ZXIuXG4gICNcbiAgICogWW91IGRvIG5vdCBoYXZlIHRvIGV4dGVuZCB0aGlzIGNsYXNzLCBqdXN0IGltcGxlbWVudCB0aGUgZnVuY3Rpb25hbGl0eS5cbiAgI1xuICAgKiBAZXh0ZW5kcyBldmVudHMuRXZlbnRFbWl0dGVyXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLkNoYW5uZWxcbiAgICovXG5cbiAgZXhwb3J0cy5DaGFubmVsID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoQ2hhbm5lbCwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBDaGFubmVsKCkge1xuICAgICAgcmV0dXJuIENoYW5uZWwuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBBIG1lc3NhZ2Ugd2FzIHJlY2VpdmVkIGZyb20gdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIHJlY2VpdmVkIG1lc3NhZ2VcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXIgd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogRXN0YWJsaXNoZXMgdGhlIGNvbm5lY3Rpb24gd2l0aCB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiB0aGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNlbmRzIGEgbWVzc2FnZSB0byB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2Qgc2VuZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIG1lc3NhZ2UgdG8gc2VuZFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiB0aGUgbWVzc2FnZSBpcyBzZW50XG4gICAgICovXG5cbiAgICBDaGFubmVsLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIHRoZSBjb25uZWN0aW9uIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQG1ldGhvZCBjbG9zZVxuICAgICAqL1xuXG4gICAgQ2hhbm5lbC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENoYW5uZWw7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlciwgUHJvbWlzZSxcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIFByb21pc2UgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9wcm9taXNlJykuUHJvbWlzZTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5XZWJTb2NrZXRDaGFubmVsXG4gICAqL1xuXG4gIGV4cG9ydHMuV2ViU29ja2V0Q2hhbm5lbCA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFdlYlNvY2tldENoYW5uZWwsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gV2ViU29ja2V0Q2hhbm5lbChhZGRyZXNzKSB7XG4gICAgICB0aGlzLmFkZHJlc3MgPSBhZGRyZXNzO1xuICAgIH1cblxuICAgIFdlYlNvY2tldENoYW5uZWwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdF9wID0gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgdmFyIHNvY2tldDtcbiAgICAgICAgICAgIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoX3RoaXMuYWRkcmVzcyk7XG4gICAgICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIF90aGlzLnNvY2tldCA9IHNvY2tldDtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzb2NrZXQub25lcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICBkZWxldGUgX3RoaXMuc29ja2V0O1xuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICAgIHJldHVybiByZWplY3QobmV3IEVycm9yKFwiVW5hYmxlIHRvIGNvbm5lY3QgdG8gc29ja2V0XCIpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgICAgdmFyIGRhdGE7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgICAgICAgICAgIF90aGlzLmVtaXQoJ2Vycm9yJywgXCJVbmFibGUgdG8gcGFyc2UgaW5jb21pbmcgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0X3A7XG4gICAgfTtcblxuICAgIFdlYlNvY2tldENoYW5uZWwucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICBpZiAodGhpcy5zb2NrZXQgIT0gbnVsbCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkobXNnKSk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICBlcnIgPSBfZXJyb3I7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJUcnlpbmcgdG8gc2VuZCBvbiBXZWJTb2NrZXQgd2l0aG91dCBiZWluZyBjb25uZWN0ZWRcIikpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBXZWJTb2NrZXRDaGFubmVsLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGVycjtcbiAgICAgIGlmICh0aGlzLnNvY2tldCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgICAgIGVyciA9IF9lcnJvcjtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIlRyeWluZyB0byBjbG9zZSBXZWJTb2NrZXQgd2l0aG91dCBiZWluZyBjb25uZWN0ZWRcIikpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gV2ViU29ja2V0Q2hhbm5lbDtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgY29tcGF0O1xuXG4gIGNvbXBhdCA9IHJlcXVpcmUoJy4vY29tcGF0JykuY29tcGF0O1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBhcm91bmQgYW4gSFRNTDUgTWVkaWFTdHJlYW1cbiAgICogQGNsYXNzIHJ0Yy5TdHJlYW1cbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtSVENEYXRhU3RyZWFtfSBzdHJlYW0gVGhlIG5hdGl2ZSBzdHJlYW1cbiAgICovXG5cbiAgZXhwb3J0cy5TdHJlYW0gPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gU3RyZWFtKHN0cmVhbTEpIHtcbiAgICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtMTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgaWQgb2YgdGhlIHN0cmVhbS4gVGhpcyBpcyBuZWl0aGVyIHVzZXIgZGVmaW5lZCBub3IgaHVtYW4gcmVhZGFibGUuXG4gICAgICogQG1ldGhvZCBpZFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gVGhlIGlkIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbVxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5pZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtLmlkO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIHRoZSBzdHJlYW0gaGFzIGFueSB0cmFja3Mgb2YgdGhlIGdpdmVuIHR5cGVcbiAgICAgKiBAbWV0aG9kIGhhc1RyYWNrc1xuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdib3RoJ10gVGhlIHR5cGUgb2YgdHJhY2sgdG8gY2hlY2sgZm9yXG4gICAgICogQHJldHVybiB7TnVtYmVyfSBUaGUgYW1vdW50IG9mIHRyYWNrcyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5oYXNUcmFja3MgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRUcmFja3ModHlwZSkubGVuZ3RoO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHRyYWNrcyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICAgICAqIEBtZXRob2QgZ2V0VHJhY2tzXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2JvdGgnXSBUaGUgdHlwZSBvZiB0cmFja3MgdG8gZ2V0XG4gICAgICogQHJldHVybiB7QXJyYXl9IEFuIEFycmF5IG9mIHRoZSB0cmFja3NcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUuZ2V0VHJhY2tzID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmVhbS5nZXRBdWRpb1RyYWNrcygpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3ZpZGVvJykge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJlYW1fcC50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgIHJldHVybiBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdib3RoJykge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJlYW1fcC50aGVuKGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgICAgIHZhciB2YXVkaW8sIHZpZGVvO1xuICAgICAgICAgIHZpZGVvID0gc3RyZWFtLmdldFZpZGVvVHJhY2tzKCk7XG4gICAgICAgICAgdmF1ZGlvID0gc3RyZWFtLmdldEF1ZGlvVHJhY2tzKCk7XG4gICAgICAgICAgcmV0dXJuIHZpZGVvLmNvbmNhdChhdWRpbyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzdHJlYW0gcGFydCAnXCIgKyB0eXBlICsgXCInXCIpO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIE11dGVzIG9yIHVubXV0ZXMgdHJhY2tzIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIG11dGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFttdXRlZD10cnVlXSBNdXRlIG9uIGB0cnVlYCBhbmQgdW5tdXRlIG9uIGBmYWxzZWBcbiAgICAgKiBAcGFyYW0geydhdWRpbycgfCAndmlkZW8nIHwgJ2JvdGgnfSBbdHlwZT0nYXVkaW8nXSBUaGUgdHlwZSBvZiB0cmFja3MgdG8gbXV0ZSBvciB1bm11dGVcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBXaGV0aGVyIHRoZSB0cmFja3Mgd2VyZSBtdXRlZCBvciB1bm11dGVkXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLm11dGUgPSBmdW5jdGlvbihtdXRlZCwgdHlwZSkge1xuICAgICAgdmFyIGksIGxlbiwgcmVmLCB0cmFjaztcbiAgICAgIGlmIChtdXRlZCA9PSBudWxsKSB7XG4gICAgICAgIG11dGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgICAgdHlwZSA9ICdhdWRpbyc7XG4gICAgICB9XG4gICAgICByZWYgPSBnZXRUcmFja3ModHlwZSk7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByZWYubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdHJhY2sgPSByZWZbaV07XG4gICAgICAgIHRyYWNrLmVuYWJsZWQgPSAhbXV0ZWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gbXV0ZWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyB0aGUgbXV0ZSBzdGF0ZSBvZiB0cmFja3Mgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2QgdG9nZ2xlTXV0ZVxuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdhdWRpbyddIFRoZSB0eXBlIG9mIHRyYWNrcyB0byBtdXRlIG9yIHVubXV0ZVxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHRyYWNrcyB3ZXJlIG11dGVkIG9yIHVubXV0ZWRcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUudG9nZ2xlTXV0ZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgIHZhciBpLCBsZW4sIG11dGVkLCByZWYsIHRyYWNrLCB0cmFja3M7XG4gICAgICBpZiAodHlwZSA9PSBudWxsKSB7XG4gICAgICAgIHR5cGUgPSAnYXVkaW8nO1xuICAgICAgfVxuICAgICAgdHJhY2tzID0gZ2V0VHJhY2tzKHR5cGUpO1xuICAgICAgbXV0ZWQgPSAhKChyZWYgPSB0cmFja3NbMF0pICE9IG51bGwgPyByZWYuZW5hYmxlZCA6IHZvaWQgMCk7XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSB0cmFja3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdHJhY2sgPSB0cmFja3NbaV07XG4gICAgICAgIHRyYWNrLmVuYWJsZWQgPSAhbXV0ZWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gbXV0ZWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2Qgc3RvcFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gc3RyZWFtLnN0b3AoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc3RyZWFtIHVzaW5nIGBnZXRVc2VyTWVkaWEoKWBcbiAgICAgKiBAbWV0aG9kIGNyZWF0ZVN0cmVhbVxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbmZpZz17YXVkaW86IHRydWUsIHZpZGVvOiB0cnVlfV0gVGhlIGNvbmZpZ3VyYXRpb24gdG8gcGFzcyB0byBgZ2V0VXNlck1lZGlhKClgXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIHRvIHRoZSBzdHJlYW1cbiAgICAjXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAgICAgdmFyIHN0cmVhbSA9IHJ0Yy5TdHJlYW0uY3JlYXRlU3RyZWFtKHthdWRpbzogdHJ1ZSwgdmlkZW86IGZhbHNlfSk7XG4gICAgICogICAgIHJ0Yy5NZWRpYURvbUVsZW1lbnQoJCgndmlkZW8nKSwgc3RyZWFtKTtcbiAgICAgKi9cblxuICAgIFN0cmVhbS5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgIGlmIChjb25maWcgPT0gbnVsbCkge1xuICAgICAgICBjb25maWcgPSB7XG4gICAgICAgICAgYXVkaW86IHRydWUsXG4gICAgICAgICAgdmlkZW86IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHN1Y2Nlc3M7XG4gICAgICAgIHN1Y2Nlc3MgPSBmdW5jdGlvbihuYXRpdmVfc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUobmV3IFN0cmVhbShuYXRpdmVfc3RyZWFtKSk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBjb21wYXQuZ2V0VXNlck1lZGlhKGNvbmZpZywgc3VjY2VzcywgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gU3RyZWFtO1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBQZWVyLCBTdHJlYW07XG5cbiAgU3RyZWFtID0gcmVxdWlyZSgnLi9zdHJlYW0nKS5TdHJlYW07XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQGNsYXNzIHJ0Yy5NZWRpYURvbUVsZW1lbnRcbiAgICovXG5cbiAgZXhwb3J0cy5NZWRpYURvbUVsZW1lbnQgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gTWVkaWFEb21FbGVtZW50KGRvbSwgZGF0YSkge1xuICAgICAgdGhpcy5kb20gPSBkb207XG4gICAgICBpZiAodGhpcy5kb20uanF1ZXJ5ICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5kb20gPSB0aGlzLmRvbVswXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYXR0YWNoKGRhdGEpO1xuICAgIH1cblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbCkge1xuICAgICAgICBkZWxldGUgdGhpcy5zdHJlYW07XG4gICAgICAgIHRoaXMuZG9tLnBhdXNlKCk7XG4gICAgICAgIHJldHVybiB0aGlzLmRvbS5zcmMgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgU3RyZWFtKSB7XG4gICAgICAgIHRoaXMuc3RyZWFtID0gZGF0YTtcbiAgICAgICAgaWYgKHR5cGVvZiBtb3pHZXRVc2VyTWVkaWEgIT09IFwidW5kZWZpbmVkXCIgJiYgbW96R2V0VXNlck1lZGlhICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5kb20ubW96U3JjT2JqZWN0ID0gZGF0YS5zdHJlYW07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kb20uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChkYXRhLnN0cmVhbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZG9tLnBsYXkoKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YSBpbnN0YW5jZW9mIFBlZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoKGRhdGEuc3RyZWFtKCkpO1xuICAgICAgfSBlbHNlIGlmICgoZGF0YSAhPSBudWxsID8gZGF0YS50aGVuIDogdm9pZCAwKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkYXRhLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmF0dGFjaChyZXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKVtcImNhdGNoXCJdKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5lcnJvcihlcnIpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yKFwiVHJpZWQgdG8gYXR0YWNoIGludmFsaWQgZGF0YVwiKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5lcnJvciA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGVycik7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmF0dGFjaCgpO1xuICAgIH07XG5cbiAgICBNZWRpYURvbUVsZW1lbnQucHJvdG90eXBlLm11dGUgPSBmdW5jdGlvbihtdXRlZCkge1xuICAgICAgaWYgKG11dGVkID09IG51bGwpIHtcbiAgICAgICAgbXV0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuZG9tLm11dGVkID0gbXV0ZWQ7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUudG9nZ2xlTXV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZG9tLm11dGVkID0gIXRoaXMuZG9tLm11dGVkO1xuICAgIH07XG5cbiAgICByZXR1cm4gTWVkaWFEb21FbGVtZW50O1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iXX0=
