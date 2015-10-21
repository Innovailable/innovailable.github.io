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
      if (desc.candidate != null) {
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
          description = new rtc.compat.SessionDescription(sdp);
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
      return this.connect_d.promise;
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

},{"./compat":4,"./data_channel":5,"./internal/promise":7,"./stream":19,"events":1}],13:[function(require,module,exports){
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
   */

  exports.MucSignaling = (function(superClass) {
    extend(MucSignaling, superClass);

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

},{"../internal/promise":7,"./signaling":17}],17:[function(require,module,exports){
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

},{"events":1}],18:[function(require,module,exports){
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

},{"../internal/promise":7,"./signaling":17}],19:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsInNyYy9jb21wYXQuY29mZmVlIiwic3JjL2RhdGFfY2hhbm5lbC5jb2ZmZWUiLCJzcmMvaW50ZXJuYWwvY2hhbm5lbF9jb2xsZWN0aW9uLmNvZmZlZSIsInNyYy9pbnRlcm5hbC9wcm9taXNlLmNvZmZlZSIsInNyYy9pbnRlcm5hbC9zdHJlYW1fY29sbGVjdGlvbi5jb2ZmZWUiLCJzcmMvbGliLmNvZmZlZSIsInNyYy9sb2NhbF9wZWVyLmNvZmZlZSIsInNyYy9wZWVyLmNvZmZlZSIsInNyYy9wZWVyX2Nvbm5lY3Rpb24uY29mZmVlIiwic3JjL3JlbW90ZV9wZWVyLmNvZmZlZSIsInNyYy9yb29tLmNvZmZlZSIsInNyYy9zaWduYWxpbmcvbXVjX3NpZ25hbGluZy5jb2ZmZWUiLCJzcmMvc2lnbmFsaW5nL3BhbGF2YV9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy9zaWduYWxpbmcuY29mZmVlIiwic3JjL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwuY29mZmVlIiwic3JjL3N0cmVhbS5jb2ZmZWUiLCJzcmMvdmlkZW9fZWxlbWVudC5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3Y4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9XQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDektBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyohXG4gKiBAb3ZlcnZpZXcgZXM2LXByb21pc2UgLSBhIHRpbnkgaW1wbGVtZW50YXRpb24gb2YgUHJvbWlzZXMvQSsuXG4gKiBAY29weXJpZ2h0IENvcHlyaWdodCAoYykgMjAxNCBZZWh1ZGEgS2F0eiwgVG9tIERhbGUsIFN0ZWZhbiBQZW5uZXIgYW5kIGNvbnRyaWJ1dG9ycyAoQ29udmVyc2lvbiB0byBFUzYgQVBJIGJ5IEpha2UgQXJjaGliYWxkKVxuICogQGxpY2Vuc2UgICBMaWNlbnNlZCB1bmRlciBNSVQgbGljZW5zZVxuICogICAgICAgICAgICBTZWUgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2pha2VhcmNoaWJhbGQvZXM2LXByb21pc2UvbWFzdGVyL0xJQ0VOU0VcbiAqIEB2ZXJzaW9uICAgMy4wLjJcbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJyB8fCAodHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGwpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbic7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc01heWJlVGhlbmFibGUoeCkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5O1xuICAgIGlmICghQXJyYXkuaXNBcnJheSkge1xuICAgICAgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheSA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkdXRpbHMkJF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5ID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRfaXNBcnJheTtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGxlbiA9IDA7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0O1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkY3VzdG9tU2NoZWR1bGVyRm47XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuXSA9IGNhbGxiYWNrO1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2xpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gKyAxXSA9IGFyZztcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW4gKz0gMjtcbiAgICAgIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID09PSAyKSB7XG4gICAgICAgIC8vIElmIGxlbiBpcyAyLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAgICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAgICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgICAgICBpZiAobGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2goKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2V0QXNhcChhc2FwRm4pIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRhc2FwID0gYXNhcEZuO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkYnJvd3NlcldpbmRvdyA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJXaW5kb3cgfHwge307XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgbGliJGVzNiRwcm9taXNlJGFzYXAkJGJyb3dzZXJHbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGFzYXAkJGlzTm9kZSA9IHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7XG5cbiAgICAvLyB0ZXN0IGZvciB3ZWIgd29ya2VyIGJ1dCBub3QgaW4gSUUxMFxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkYXNhcCQkaXNXb3JrZXIgPSB0eXBlb2YgVWludDhDbGFtcGVkQXJyYXkgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICB0eXBlb2YgaW1wb3J0U2NyaXB0cyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7XG5cbiAgICAvLyBub2RlXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU5leHRUaWNrKCkge1xuICAgICAgLy8gbm9kZSB2ZXJzaW9uIDAuMTAueCBkaXNwbGF5cyBhIGRlcHJlY2F0aW9uIHdhcm5pbmcgd2hlbiBuZXh0VGljayBpcyB1c2VkIHJlY3Vyc2l2ZWx5XG4gICAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2N1am9qcy93aGVuL2lzc3Vlcy80MTAgZm9yIGRldGFpbHNcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyB2ZXJ0eFxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VWZXJ0eFRpbWVyKCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0KGxpYiRlczYkcHJvbWlzZSRhc2FwJCRmbHVzaCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuICAgICAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICAgICAgdmFyIG9ic2VydmVyID0gbmV3IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRCcm93c2VyTXV0YXRpb25PYnNlcnZlcihsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2gpO1xuICAgICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gICAgICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBub2RlLmRhdGEgPSAoaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDIpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyB3ZWIgd29ya2VyXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU1lc3NhZ2VDaGFubmVsKCkge1xuICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICAgIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZVNldFRpbWVvdXQoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHNldFRpbWVvdXQobGliJGVzNiRwcm9taXNlJGFzYXAkJGZsdXNoLCAxKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZSA9IG5ldyBBcnJheSgxMDAwKTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkZmx1c2goKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRsZW47IGkrPTIpIHtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2ldO1xuICAgICAgICB2YXIgYXJnID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHF1ZXVlW2krMV07XG5cbiAgICAgICAgY2FsbGJhY2soYXJnKTtcblxuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkcXVldWVbaV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRxdWV1ZVtpKzFdID0gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkbGVuID0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXR0ZW1wdFZlcnR4KCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIHIgPSByZXF1aXJlO1xuICAgICAgICB2YXIgdmVydHggPSByKCd2ZXJ0eCcpO1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkdmVydHhOZXh0ID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VWZXJ0eFRpbWVyKCk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoO1xuICAgIC8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG4gICAgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc05vZGUpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU5leHRUaWNrKCk7XG4gICAgfSBlbHNlIGlmIChsaWIkZXM2JHByb21pc2UkYXNhcCQkQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHVzZU11dGF0aW9uT2JzZXJ2ZXIoKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRpc1dvcmtlcikge1xuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJHNjaGVkdWxlRmx1c2ggPSBsaWIkZXM2JHByb21pc2UkYXNhcCQkdXNlTWVzc2FnZUNoYW5uZWwoKTtcbiAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSRhc2FwJCRicm93c2VyV2luZG93ID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzY2hlZHVsZUZsdXNoID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGF0dGVtcHRWZXJ0eCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkc2NoZWR1bGVGbHVzaCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCR1c2VTZXRUaW1lb3V0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCgpIHt9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAgID0gdm9pZCAwO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQgPSAxO1xuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCAgPSAyO1xuXG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SID0gbmV3IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEVycm9yT2JqZWN0KCk7XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkY2Fubm90UmV0dXJuT3duKCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRnZXRUaGVuKHByb21pc2UpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW47XG4gICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yID0gZXJyb3I7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRHRVRfVEhFTl9FUlJPUjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlUaGVuKHRoZW4sIHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICByZXR1cm4gZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUsIHRoZW4pIHtcbiAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChmdW5jdGlvbihwcm9taXNlKSB7XG4gICAgICAgIHZhciBzZWFsZWQgPSBmYWxzZTtcbiAgICAgICAgdmFyIGVycm9yID0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkdHJ5VGhlbih0aGVuLCB0aGVuYWJsZSwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2VhbGVkKSB7IHJldHVybjsgfVxuICAgICAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgaWYgKHNlYWxlZCkgeyByZXR1cm47IH1cbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0sICdTZXR0bGU6ICcgKyAocHJvbWlzZS5fbGFiZWwgfHwgJyB1bmtub3duIHByb21pc2UnKSk7XG5cbiAgICAgICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0sIHByb21pc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gICAgICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSkge1xuICAgICAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgdGhlbiA9IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGdldFRoZW4obWF5YmVUaGVuYWJsZSk7XG5cbiAgICAgICAgaWYgKHRoZW4gPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEdFVF9USEVOX0VSUk9SLmVycm9yKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICAgICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRzZWxmRnVsZmlsbG1lbnQoKSk7XG4gICAgICB9IGVsc2UgaWYgKGxpYiRlczYkcHJvbWlzZSR1dGlscyQkb2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgICAgIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaChwcm9taXNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHsgcmV0dXJuOyB9XG5cbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHZhbHVlO1xuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQ7XG5cbiAgICAgIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaCwgcHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICAgICAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7IHJldHVybjsgfVxuICAgICAgcHJvbWlzZS5fc3RhdGUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRDtcbiAgICAgIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgICB2YXIgc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICAgICAgdmFyIGxlbmd0aCA9IHN1YnNjcmliZXJzLmxlbmd0aDtcblxuICAgICAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICAgICAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gICAgICBzdWJzY3JpYmVyc1tsZW5ndGggKyBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRF0gID0gb25SZWplY3Rpb247XG5cbiAgICAgIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkYXNhcCQkYXNhcChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRwdWJsaXNoLCBwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHB1Ymxpc2gocHJvbWlzZSkge1xuICAgICAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG4gICAgICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gICAgICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgICB2YXIgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICAgICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRFcnJvck9iamVjdCgpIHtcbiAgICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1IgPSBuZXcgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRXJyb3JPYmplY3QoKTtcblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGU7XG4gICAgICAgIHJldHVybiBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRUUllfQ0FUQ0hfRVJST1I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICAgICAgdmFyIGhhc0NhbGxiYWNrID0gbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gICAgICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICAgICAgdmFsdWUgPSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCR0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKTtcblxuICAgICAgICBpZiAodmFsdWUgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgZXJyb3IgPSB2YWx1ZS5lcnJvcjtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRjYW5ub3RSZXR1cm5Pd24oKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gZGV0YWlsO1xuICAgICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgLy8gbm9vcFxuICAgICAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRGVUxGSUxMRUQpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFJFSkVDVEVEKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkaW5pdGlhbGl6ZVByb21pc2UocHJvbWlzZSwgcmVzb2x2ZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKXtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgICBlbnVtZXJhdG9yLl9pbnN0YW5jZUNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG4gICAgICBlbnVtZXJhdG9yLnByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG5cbiAgICAgIGlmIChlbnVtZXJhdG9yLl92YWxpZGF0ZUlucHV0KGlucHV0KSkge1xuICAgICAgICBlbnVtZXJhdG9yLl9pbnB1dCAgICAgPSBpbnB1dDtcbiAgICAgICAgZW51bWVyYXRvci5sZW5ndGggICAgID0gaW5wdXQubGVuZ3RoO1xuICAgICAgICBlbnVtZXJhdG9yLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cbiAgICAgICAgZW51bWVyYXRvci5faW5pdCgpO1xuXG4gICAgICAgIGlmIChlbnVtZXJhdG9yLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGZ1bGZpbGwoZW51bWVyYXRvci5wcm9taXNlLCBlbnVtZXJhdG9yLl9yZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVudW1lcmF0b3IubGVuZ3RoID0gZW51bWVyYXRvci5sZW5ndGggfHwgMDtcbiAgICAgICAgICBlbnVtZXJhdG9yLl9lbnVtZXJhdGUoKTtcbiAgICAgICAgICBpZiAoZW51bWVyYXRvci5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRmdWxmaWxsKGVudW1lcmF0b3IucHJvbWlzZSwgZW51bWVyYXRvci5fcmVzdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChlbnVtZXJhdG9yLnByb21pc2UsIGVudW1lcmF0b3IuX3ZhbGlkYXRpb25FcnJvcigpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3ZhbGlkYXRlSW5wdXQgPSBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSR1dGlscyQkaXNBcnJheShpbnB1dCk7XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fdmFsaWRhdGlvbkVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuICAgIH07XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvcjtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICAgIHZhciBsZW5ndGggID0gZW51bWVyYXRvci5sZW5ndGg7XG4gICAgICB2YXIgcHJvbWlzZSA9IGVudW1lcmF0b3IucHJvbWlzZTtcbiAgICAgIHZhciBpbnB1dCAgID0gZW51bWVyYXRvci5faW5wdXQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAmJiBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZW51bWVyYXRvci5fZWFjaEVudHJ5KGlucHV0W2ldLCBpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGliJGVzNiRwcm9taXNlJGVudW1lcmF0b3IkJEVudW1lcmF0b3IucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbihlbnRyeSwgaSkge1xuICAgICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuICAgICAgdmFyIGMgPSBlbnVtZXJhdG9yLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuXG4gICAgICBpZiAobGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc01heWJlVGhlbmFibGUoZW50cnkpKSB7XG4gICAgICAgIGlmIChlbnRyeS5jb25zdHJ1Y3RvciA9PT0gYyAmJiBlbnRyeS5fc3RhdGUgIT09IGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJFBFTkRJTkcpIHtcbiAgICAgICAgICBlbnRyeS5fb25lcnJvciA9IG51bGw7XG4gICAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGVudHJ5Ll9zdGF0ZSwgaSwgZW50cnkuX3Jlc3VsdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW51bWVyYXRvci5fd2lsbFNldHRsZUF0KGMucmVzb2x2ZShlbnRyeSksIGkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnVtZXJhdG9yLl9yZW1haW5pbmctLTtcbiAgICAgICAgZW51bWVyYXRvci5fcmVzdWx0W2ldID0gZW50cnk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxpYiRlczYkcHJvbWlzZSRlbnVtZXJhdG9yJCRFbnVtZXJhdG9yLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24oc3RhdGUsIGksIHZhbHVlKSB7XG4gICAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG4gICAgICB2YXIgcHJvbWlzZSA9IGVudW1lcmF0b3IucHJvbWlzZTtcblxuICAgICAgaWYgKHByb21pc2UuX3N0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRQRU5ESU5HKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3JlbWFpbmluZy0tO1xuXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUkVKRUNURUQpIHtcbiAgICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVudW1lcmF0b3IuX3Jlc3VsdFtpXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChlbnVtZXJhdG9yLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkZnVsZmlsbChwcm9taXNlLCBlbnVtZXJhdG9yLl9yZXN1bHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkRW51bWVyYXRvci5wcm90b3R5cGUuX3dpbGxTZXR0bGVBdCA9IGZ1bmN0aW9uKHByb21pc2UsIGkpIHtcbiAgICAgIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHByb21pc2UsIHVuZGVmaW5lZCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgZW51bWVyYXRvci5fc2V0dGxlZEF0KGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIGVudW1lcmF0b3IuX3NldHRsZWRBdChsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCwgaSwgcmVhc29uKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRhbGwoZW50cmllcykge1xuICAgICAgcmV0dXJuIG5ldyBsaWIkZXM2JHByb21pc2UkZW51bWVyYXRvciQkZGVmYXVsdCh0aGlzLCBlbnRyaWVzKS5wcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRhbGw7XG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmFjZSQkcmFjZShlbnRyaWVzKSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG5cbiAgICAgIGlmICghbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlamVjdChwcm9taXNlLCBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJykpO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGxlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuXG4gICAgICBmdW5jdGlvbiBvbkZ1bGZpbGxtZW50KHZhbHVlKSB7XG4gICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBvblJlamVjdGlvbihyZWFzb24pIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBwcm9taXNlLl9zdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkUEVORElORyAmJiBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKENvbnN0cnVjdG9yLnJlc29sdmUoZW50cmllc1tpXSksIHVuZGVmaW5lZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJhY2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRyYWNlO1xuICAgIGZ1bmN0aW9uIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlc29sdmUkJHJlc29sdmUob2JqZWN0KSB7XG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICAgICAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IENvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICB9XG5cbiAgICAgIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkcmVzb2x2ZShwcm9taXNlLCBvYmplY3QpO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuICAgIHZhciBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVzb2x2ZSQkcmVzb2x2ZTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZWplY3QkJHJlamVjdChyZWFzb24pIHtcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3IobGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkbm9vcCk7XG4gICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRyZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRkZWZhdWx0ID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkcmVqZWN0JCRyZWplY3Q7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGNvdW50ZXIgPSAwO1xuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzUmVzb2x2ZXIoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzTmV3KCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZTtcbiAgICAvKipcbiAgICAgIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcbiAgICAgIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gICAgICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cbiAgICAgIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gICAgICBUZXJtaW5vbG9neVxuICAgICAgLS0tLS0tLS0tLS1cblxuICAgICAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cbiAgICAgIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgICAgIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cbiAgICAgIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuICAgICAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAgICAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cbiAgICAgIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblxuICAgICAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgICAgIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcbiAgICAgIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXG4gICAgICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgICAgIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3NcbiAgICAgIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuICAgICAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICAgICAgaXRzZWxmIGZ1bGZpbGwuXG5cblxuICAgICAgQmFzaWMgVXNhZ2U6XG4gICAgICAtLS0tLS0tLS0tLS1cblxuICAgICAgYGBganNcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAgICAgLy8gb24gZmFpbHVyZVxuICAgICAgICByZWplY3QocmVhc29uKTtcbiAgICAgIH0pO1xuXG4gICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgICAgICAvLyBvbiByZWplY3Rpb25cbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFkdmFuY2VkIFVzYWdlOlxuICAgICAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcbiAgICAgIGBYTUxIdHRwUmVxdWVzdGBzLlxuXG4gICAgICBgYGBqc1xuICAgICAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG4gICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICB4aHIuc2VuZCgpO1xuXG4gICAgICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuICAgICAgICAvLyBvbiBmdWxmaWxsbWVudFxuICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgICAgIC8vIG9uIHJlamVjdGlvblxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblxuICAgICAgYGBganNcbiAgICAgIFByb21pc2UuYWxsKFtcbiAgICAgICAgZ2V0SlNPTignL3Bvc3RzJyksXG4gICAgICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gICAgICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG4gICAgICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cbiAgICAgICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgICAgIHJldHVybiB2YWx1ZXM7XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAY2xhc3MgUHJvbWlzZVxuICAgICAgQHBhcmFtIHtmdW5jdGlvbn0gcmVzb2x2ZXJcbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEBjb25zdHJ1Y3RvclxuICAgICovXG4gICAgZnVuY3Rpb24gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UocmVzb2x2ZXIpIHtcbiAgICAgIHRoaXMuX2lkID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGNvdW50ZXIrKztcbiAgICAgIHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fcmVzdWx0ID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICAgICAgaWYgKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3AgIT09IHJlc29sdmVyKSB7XG4gICAgICAgIGlmICghbGliJGVzNiRwcm9taXNlJHV0aWxzJCRpc0Z1bmN0aW9uKHJlc29sdmVyKSkge1xuICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRuZWVkc1Jlc29sdmVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UpKSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJG5lZWRzTmV3KCk7XG4gICAgICAgIH1cblxuICAgICAgICBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRpbml0aWFsaXplUHJvbWlzZSh0aGlzLCByZXNvbHZlcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UuYWxsID0gbGliJGVzNiRwcm9taXNlJHByb21pc2UkYWxsJCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnJhY2UgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyYWNlJCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnJlc29sdmUgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSRyZXNvbHZlJCRkZWZhdWx0O1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLnJlamVjdCA9IGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJHJlamVjdCQkZGVmYXVsdDtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fc2V0U2NoZWR1bGVyID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJHNldFNjaGVkdWxlcjtcbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5fc2V0QXNhcCA9IGxpYiRlczYkcHJvbWlzZSRhc2FwJCRzZXRBc2FwO1xuICAgIGxpYiRlczYkcHJvbWlzZSRwcm9taXNlJCRQcm9taXNlLl9hc2FwID0gbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXA7XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkUHJvbWlzZS5wcm90b3R5cGUgPSB7XG4gICAgICBjb25zdHJ1Y3RvcjogbGliJGVzNiRwcm9taXNlJHByb21pc2UkJFByb21pc2UsXG5cbiAgICAvKipcbiAgICAgIFRoZSBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLFxuICAgICAgd2hpY2ggcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGVcbiAgICAgIHJlYXNvbiB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICAgICAgYGBganNcbiAgICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgLy8gdXNlciBpcyBhdmFpbGFibGVcbiAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHVzZXIgaXMgdW5hdmFpbGFibGUsIGFuZCB5b3UgYXJlIGdpdmVuIHRoZSByZWFzb24gd2h5XG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBDaGFpbmluZ1xuICAgICAgLS0tLS0tLS1cblxuICAgICAgVGhlIHJldHVybiB2YWx1ZSBvZiBgdGhlbmAgaXMgaXRzZWxmIGEgcHJvbWlzZS4gIFRoaXMgc2Vjb25kLCAnZG93bnN0cmVhbSdcbiAgICAgIHByb21pc2UgaXMgcmVzb2x2ZWQgd2l0aCB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmaXJzdCBwcm9taXNlJ3MgZnVsZmlsbG1lbnRcbiAgICAgIG9yIHJlamVjdGlvbiBoYW5kbGVyLCBvciByZWplY3RlZCBpZiB0aGUgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHJldHVybiB1c2VyLm5hbWU7XG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHJldHVybiAnZGVmYXVsdCBuYW1lJztcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHVzZXJOYW1lKSB7XG4gICAgICAgIC8vIElmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgdXNlck5hbWVgIHdpbGwgYmUgdGhlIHVzZXIncyBuYW1lLCBvdGhlcndpc2UgaXRcbiAgICAgICAgLy8gd2lsbCBiZSBgJ2RlZmF1bHQgbmFtZSdgXG4gICAgICB9KTtcblxuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknKTtcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jyk7XG4gICAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIGlmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgcmVhc29uYCB3aWxsIGJlICdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScuXG4gICAgICAgIC8vIElmIGBmaW5kVXNlcmAgcmVqZWN0ZWQsIGByZWFzb25gIHdpbGwgYmUgJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknLlxuICAgICAgfSk7XG4gICAgICBgYGBcbiAgICAgIElmIHRoZSBkb3duc3RyZWFtIHByb21pc2UgZG9lcyBub3Qgc3BlY2lmeSBhIHJlamVjdGlvbiBoYW5kbGVyLCByZWplY3Rpb24gcmVhc29ucyB3aWxsIGJlIHByb3BhZ2F0ZWQgZnVydGhlciBkb3duc3RyZWFtLlxuXG4gICAgICBgYGBqc1xuICAgICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBQZWRhZ29naWNhbEV4Y2VwdGlvbignVXBzdHJlYW0gZXJyb3InKTtcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gVGhlIGBQZWRnYWdvY2lhbEV4Y2VwdGlvbmAgaXMgcHJvcGFnYXRlZCBhbGwgdGhlIHdheSBkb3duIHRvIGhlcmVcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEFzc2ltaWxhdGlvblxuICAgICAgLS0tLS0tLS0tLS0tXG5cbiAgICAgIFNvbWV0aW1lcyB0aGUgdmFsdWUgeW91IHdhbnQgdG8gcHJvcGFnYXRlIHRvIGEgZG93bnN0cmVhbSBwcm9taXNlIGNhbiBvbmx5IGJlXG4gICAgICByZXRyaWV2ZWQgYXN5bmNocm9ub3VzbHkuIFRoaXMgY2FuIGJlIGFjaGlldmVkIGJ5IHJldHVybmluZyBhIHByb21pc2UgaW4gdGhlXG4gICAgICBmdWxmaWxsbWVudCBvciByZWplY3Rpb24gaGFuZGxlci4gVGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIHRoZW4gYmUgcGVuZGluZ1xuICAgICAgdW50aWwgdGhlIHJldHVybmVkIHByb21pc2UgaXMgc2V0dGxlZC4gVGhpcyBpcyBjYWxsZWQgKmFzc2ltaWxhdGlvbiouXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgICAgLy8gVGhlIHVzZXIncyBjb21tZW50cyBhcmUgbm93IGF2YWlsYWJsZVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgSWYgdGhlIGFzc2ltbGlhdGVkIHByb21pc2UgcmVqZWN0cywgdGhlbiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgYWxzbyByZWplY3QuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCBmdWxmaWxscywgd2UnbGwgaGF2ZSB0aGUgdmFsdWUgaGVyZVxuICAgICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIHJlamVjdHMsIHdlJ2xsIGhhdmUgdGhlIHJlYXNvbiBoZXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBTaW1wbGUgRXhhbXBsZVxuICAgICAgLS0tLS0tLS0tLS0tLS1cblxuICAgICAgU3luY2hyb25vdXMgRXhhbXBsZVxuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICB2YXIgcmVzdWx0O1xuXG4gICAgICB0cnkge1xuICAgICAgICByZXN1bHQgPSBmaW5kUmVzdWx0KCk7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH1cbiAgICAgIGBgYFxuXG4gICAgICBFcnJiYWNrIEV4YW1wbGVcblxuICAgICAgYGBganNcbiAgICAgIGZpbmRSZXN1bHQoZnVuY3Rpb24ocmVzdWx0LCBlcnIpe1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgUHJvbWlzZSBFeGFtcGxlO1xuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICBmaW5kUmVzdWx0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBBZHZhbmNlZCBFeGFtcGxlXG4gICAgICAtLS0tLS0tLS0tLS0tLVxuXG4gICAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG5cbiAgICAgIGBgYGphdmFzY3JpcHRcbiAgICAgIHZhciBhdXRob3IsIGJvb2tzO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhdXRob3IgPSBmaW5kQXV0aG9yKCk7XG4gICAgICAgIGJvb2tzICA9IGZpbmRCb29rc0J5QXV0aG9yKGF1dGhvcik7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH1cbiAgICAgIGBgYFxuXG4gICAgICBFcnJiYWNrIEV4YW1wbGVcblxuICAgICAgYGBganNcblxuICAgICAgZnVuY3Rpb24gZm91bmRCb29rcyhib29rcykge1xuXG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGZhaWx1cmUocmVhc29uKSB7XG5cbiAgICAgIH1cblxuICAgICAgZmluZEF1dGhvcihmdW5jdGlvbihhdXRob3IsIGVycil7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmaW5kQm9vb2tzQnlBdXRob3IoYXV0aG9yLCBmdW5jdGlvbihib29rcywgZXJyKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGZvdW5kQm9va3MoYm9va3MpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgICBmYWlsdXJlKHJlYXNvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBgYGBcblxuICAgICAgUHJvbWlzZSBFeGFtcGxlO1xuXG4gICAgICBgYGBqYXZhc2NyaXB0XG4gICAgICBmaW5kQXV0aG9yKCkuXG4gICAgICAgIHRoZW4oZmluZEJvb2tzQnlBdXRob3IpLlxuICAgICAgICB0aGVuKGZ1bmN0aW9uKGJvb2tzKXtcbiAgICAgICAgICAvLyBmb3VuZCBib29rc1xuICAgICAgfSkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH0pO1xuICAgICAgYGBgXG5cbiAgICAgIEBtZXRob2QgdGhlblxuICAgICAgQHBhcmFtIHtGdW5jdGlvbn0gb25GdWxmaWxsZWRcbiAgICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWRcbiAgICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICAgKi9cbiAgICAgIHRoZW46IGZ1bmN0aW9uKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzO1xuICAgICAgICB2YXIgc3RhdGUgPSBwYXJlbnQuX3N0YXRlO1xuXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkRlVMRklMTEVEICYmICFvbkZ1bGZpbGxtZW50IHx8IHN0YXRlID09PSBsaWIkZXM2JHByb21pc2UkJGludGVybmFsJCRSRUpFQ1RFRCAmJiAhb25SZWplY3Rpb24pIHtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGlsZCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJG5vb3ApO1xuICAgICAgICB2YXIgcmVzdWx0ID0gcGFyZW50Ll9yZXN1bHQ7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgdmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW3N0YXRlIC0gMV07XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJGFzYXAkJGFzYXAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGxpYiRlczYkcHJvbWlzZSQkaW50ZXJuYWwkJGludm9rZUNhbGxiYWNrKHN0YXRlLCBjaGlsZCwgY2FsbGJhY2ssIHJlc3VsdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGliJGVzNiRwcm9taXNlJCRpbnRlcm5hbCQkc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGlsZDtcbiAgICAgIH0sXG5cbiAgICAvKipcbiAgICAgIGBjYXRjaGAgaXMgc2ltcGx5IHN1Z2FyIGZvciBgdGhlbih1bmRlZmluZWQsIG9uUmVqZWN0aW9uKWAgd2hpY2ggbWFrZXMgaXQgdGhlIHNhbWVcbiAgICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG5cbiAgICAgIGBgYGpzXG4gICAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuICAgICAgfVxuXG4gICAgICAvLyBzeW5jaHJvbm91c1xuICAgICAgdHJ5IHtcbiAgICAgICAgZmluZEF1dGhvcigpO1xuICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICAgIH1cblxuICAgICAgLy8gYXN5bmMgd2l0aCBwcm9taXNlc1xuICAgICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgICB9KTtcbiAgICAgIGBgYFxuXG4gICAgICBAbWV0aG9kIGNhdGNoXG4gICAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICAgICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgICAgQHJldHVybiB7UHJvbWlzZX1cbiAgICAqL1xuICAgICAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gICAgICB9XG4gICAgfTtcbiAgICBmdW5jdGlvbiBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJHBvbHlmaWxsKCkge1xuICAgICAgdmFyIGxvY2FsO1xuXG4gICAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBsb2NhbCA9IGdsb2JhbDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgbG9jYWwgPSBzZWxmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHlmaWxsIGZhaWxlZCBiZWNhdXNlIGdsb2JhbCBvYmplY3QgaXMgdW5hdmFpbGFibGUgaW4gdGhpcyBlbnZpcm9ubWVudCcpO1xuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIFAgPSBsb2NhbC5Qcm9taXNlO1xuXG4gICAgICBpZiAoUCAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoUC5yZXNvbHZlKCkpID09PSAnW29iamVjdCBQcm9taXNlXScgJiYgIVAuY2FzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxvY2FsLlByb21pc2UgPSBsaWIkZXM2JHByb21pc2UkcHJvbWlzZSQkZGVmYXVsdDtcbiAgICB9XG4gICAgdmFyIGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkZGVmYXVsdCA9IGxpYiRlczYkcHJvbWlzZSRwb2x5ZmlsbCQkcG9seWZpbGw7XG5cbiAgICB2YXIgbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZSA9IHtcbiAgICAgICdQcm9taXNlJzogbGliJGVzNiRwcm9taXNlJHByb21pc2UkJGRlZmF1bHQsXG4gICAgICAncG9seWZpbGwnOiBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHRcbiAgICB9O1xuXG4gICAgLyogZ2xvYmFsIGRlZmluZTp0cnVlIG1vZHVsZTp0cnVlIHdpbmRvdzogdHJ1ZSAqL1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZVsnYW1kJ10pIHtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIGxpYiRlczYkcHJvbWlzZSR1bWQkJEVTNlByb21pc2U7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlWydleHBvcnRzJ10pIHtcbiAgICAgIG1vZHVsZVsnZXhwb3J0cyddID0gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpc1snRVM2UHJvbWlzZSddID0gbGliJGVzNiRwcm9taXNlJHVtZCQkRVM2UHJvbWlzZTtcbiAgICB9XG5cbiAgICBsaWIkZXM2JHByb21pc2UkcG9seWZpbGwkJGRlZmF1bHQoKTtcbn0pLmNhbGwodGhpcyk7XG5cbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcblxuLyoqXG4gKiBDb3JlIGZ1bmN0aW9uYWxpdHlcbiAqIEBtb2R1bGUgcnRjXG4gKiBAbWFpbiBydGNcbiAqL1xuXG5cbi8qKlxuICogU2lnbmFsaW5nIGFuZCBzaWduYWxpbmcgY2hhbm5lbHNcbiAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICogQG1haW4gcnRjLnNpZ25hbGluZ1xuICovXG5cblxuLyoqXG4gKiBJbnRlcm5hbCBoZWxwZXJzXG4gKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICogQG1haW4gcnRjLmludGVybmFsXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgYmluZEhlbHBlciwgY29tcGF0O1xuXG4gIGJpbmRIZWxwZXIgPSBmdW5jdGlvbihvYmosIGZ1bikge1xuICAgIGlmIChmdW4gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXR1cm4gZnVuLmJpbmQob2JqKTtcbiAgfTtcblxuICBleHBvcnRzLmNvbXBhdCA9IGNvbXBhdCA9IHtcbiAgICBQZWVyQ29ubmVjdGlvbjogd2luZG93LlBlZXJDb25uZWN0aW9uIHx8IHdpbmRvdy53ZWJraXRQZWVyQ29ubmVjdGlvbjAwIHx8IHdpbmRvdy53ZWJraXRSVENQZWVyQ29ubmVjdGlvbiB8fCB3aW5kb3cubW96UlRDUGVlckNvbm5lY3Rpb24sXG4gICAgSWNlQ2FuZGlkYXRlOiB3aW5kb3cuUlRDSWNlQ2FuZGlkYXRlIHx8IHdpbmRvdy5tb3pSVENJY2VDYW5kaWRhdGUsXG4gICAgU2Vzc2lvbkRlc2NyaXB0aW9uOiB3aW5kb3cubW96UlRDU2Vzc2lvbkRlc2NyaXB0aW9uIHx8IHdpbmRvdy5SVENTZXNzaW9uRGVzY3JpcHRpb24sXG4gICAgTWVkaWFTdHJlYW06IHdpbmRvdy5NZWRpYVN0cmVhbSB8fCB3aW5kb3cubW96TWVkaWFTdHJlYW0gfHwgd2luZG93LndlYmtpdE1lZGlhU3RyZWFtLFxuICAgIGdldFVzZXJNZWRpYTogYmluZEhlbHBlcihuYXZpZ2F0b3IsIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tc0dldFVzZXJNZWRpYSksXG4gICAgc3VwcG9ydGVkOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAoY29tcGF0LlBlZXJDb25uZWN0aW9uICE9IG51bGwpICYmIChjb21wYXQuSWNlQ2FuZGlkYXRlICE9IG51bGwpICYmIChjb21wYXQuU2Vzc2lvbkRlc2NyaXB0aW9uICE9IG51bGwpICYmIChjb21wYXQuZ2V0VXNlck1lZGlhICE9IG51bGwpO1xuICAgIH1cbiAgfTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsIFByb21pc2UsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZCwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBBIHdyYXBwZXIgZm9yIFJUQ0RhdGFDaGFubmVsLiBVc2VkIHRvIHRyYW5zZmVyIGN1c3RvbSBkYXRhIGJldHdlZW4gcGVlcnMuXG4gICAqIEBjbGFzcyBydGMuRGF0YUNoYW5uZWxcbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtSVENEYXRhQ2hhbm5lbH0gY2hhbm5lbCBUaGUgd3JhcHBlZCBuYXRpdmUgZGF0YSBjaGFubmVsXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbWF4X2J1ZmZlcl0gVGhlIHNpemUgb2YgdGhlIHNlbmQgYnVmZmVyIGFmdGVyIHdoaWNoIHdlIHdpbGwgZGVsYXkgc2VuZGluZ1xuICAgKi9cblxuICBleHBvcnRzLkRhdGFDaGFubmVsID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoRGF0YUNoYW5uZWwsIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBtZXNzYWdlcyB3YXMgcmVjZWl2ZWQuIFRyaWdnZXJzIG9ubHkgYWZ0ZXIgYGNvbm5lY3QoKWAgd2FzIGNhbGxlZFxuICAgICAqIEBldmVudCBtZXNzYWdlXG4gICAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgcmVjZWl2ZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNoYW5uZWwgd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIERhdGFDaGFubmVsKGNoYW5uZWwsIG1heF9idWZmZXIpIHtcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLm1heF9idWZmZXIgPSBtYXhfYnVmZmVyICE9IG51bGwgPyBtYXhfYnVmZmVyIDogMTAyNCAqIDEwO1xuICAgICAgdGhpcy5fY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICB0aGlzLl9jb25uZWN0X3F1ZXVlID0gW107XG4gICAgICB0aGlzLl9zZW5kX2J1ZmZlciA9IFtdO1xuICAgICAgdGhpcy5jaGFubmVsLm9ubWVzc2FnZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICBpZiAoIV90aGlzLl9jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdF9xdWV1ZS5wdXNoKGV2ZW50LmRhdGEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbWVzc2FnZScsIGV2ZW50LmRhdGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uZXJyb3IgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3QgdG8gdGhlIERhdGFDaGFubmVsLiBZb3Ugd2lsbCByZWNlaXZlIG1lc3NhZ2VzIGFuZCB3aWxsIGJlIGFibGUgdG8gc2VuZCBhZnRlciBjYWxsaW5nIHRoaXMuXG4gICAgICogQG1ldGhvZCBjb25uZWN0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCByZXNvbHZlcyBhcyBzb29uIGFzIHRoZSBEYXRhQ2hhbm5lbCBpcyBvcGVuXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRhdGEsIGksIGxlbiwgcmVmMTtcbiAgICAgIHRoaXMuX2Nvbm5lY3RlZCA9IHRydWU7XG4gICAgICByZWYxID0gdGhpcy5fY29ubmVjdF9xdWV1ZTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJlZjEubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGF0YSA9IHJlZjFbaV07XG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2Nvbm5lY3RfcXVldWU7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogVGhlIGxhYmVsIG9mIHRoZSBEYXRhQ2hhbm5lbCB1c2VkIHRvIGRpc3Rpbmd1aXNoIG11bHRpcGxlIGNoYW5uZWxzXG4gICAgICogQG1ldGhvZCBsYWJlbFxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gVGhlIGxhYmVsXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUubGFiZWwgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwubGFiZWw7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2VuZCBkYXRhIHRvIHRoZSBwZWVyIHRocm91Z2ggdGhlIERhdGFDaGFubmVsXG4gICAgICogQG1ldGhvZCBzZW5kXG4gICAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gYmUgdHJhbnNmZXJyZWRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgd2hlbiB0aGUgZGF0YSB3YXMgcGFzc2VkIHRvIHRoZSBuYXRpdmUgZGF0YSBjaGFubmVsXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBkZWZlcjtcbiAgICAgIGlmICghdGhpcy5fY29ubmVjdGVkKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNlbmRpbmcgd2l0aG91dCBiZWluZyBjb25uZWN0ZWQuIFBsZWFzZSBjYWxsIGNvbm5lY3QoKSBvbiB0aGUgZGF0YSBjaGFubmVsIHRvIHN0YXJ0IHVzaW5nIGl0LlwiKTtcbiAgICAgIH1cbiAgICAgIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICB0aGlzLl9zZW5kX2J1ZmZlci5wdXNoKFtkYXRhLCBkZWZlcl0pO1xuICAgICAgaWYgKHRoaXMuX3NlbmRfYnVmZmVyLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICB0aGlzLl9hY3R1YWxTZW5kKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBNZXRob2Qgd2hpY2ggYWN0dWFsbHkgc2VuZHMgdGhlIGRhdGEuIEltcGxlbWVudHMgYnVmZmVyaW5nXG4gICAgICogQG1ldGhvZCBfYWN0dWFsU2VuZFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG5cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuX2FjdHVhbFNlbmQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkYXRhLCBkZWZlciwgcmVmMSwgcmVmMiwgcmVzdWx0cztcbiAgICAgIGlmICh0aGlzLmNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLl9zZW5kX2J1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICBpZiAodGhpcy5jaGFubmVsLmJ1ZmZlcmVkQW1vdW50ID49IHRoaXMubWF4X2J1ZmZlcikge1xuICAgICAgICAgICAgc2V0VGltZW91dCh0aGlzLl9hY3R1YWxTZW5kLmJpbmQodGhpcyksIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWYxID0gdGhpcy5fc2VuZF9idWZmZXJbMF0sIGRhdGEgPSByZWYxWzBdLCBkZWZlciA9IHJlZjFbMV07XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbC5zZW5kKGRhdGEpO1xuICAgICAgICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgICAgICAgc2V0VGltZW91dCh0aGlzLl9hY3R1YWxTZW5kLmJpbmQodGhpcyksIDEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWZlci5yZXNvbHZlKCk7XG4gICAgICAgICAgdGhpcy5fc2VuZF9idWZmZXIuc2hpZnQoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0cyA9IFtdO1xuICAgICAgICB3aGlsZSAodGhpcy5fc2VuZF9idWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgcmVmMiA9IHRoaXMuX3NlbmRfYnVmZmVyLnNoaWZ0KCksIGRhdGEgPSByZWYyWzBdLCBkZWZlciA9IHJlZjJbMV07XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKGRlZmVyLnJlamVjdChuZXcgRXJyb3IoXCJEYXRhQ2hhbm5lbCBjbG9zZWRcIikpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFDaGFubmVsO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLCBQcm9taXNlLCByZWYsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICByZWYgPSByZXF1aXJlKCcuL3Byb21pc2UnKSwgRGVmZXJyZWQgPSByZWYuRGVmZXJyZWQsIFByb21pc2UgPSByZWYuUHJvbWlzZTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuaW50ZXJuYWxcbiAgICovXG5cblxuICAvKipcbiAgICogSGVscGVyIHdoaWNoIGhhbmRsZXMgRGF0YUNoYW5uZWwgbmVnb3RpYXRpb24gZm9yIFJlbW90ZVBlZXJcbiAgICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5DaGFubmVsQ29sbGVjdGlvblxuICAgKi9cblxuICBleHBvcnRzLkNoYW5uZWxDb2xsZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoQ2hhbm5lbENvbGxlY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBkYXRhIGNoYW5uZWwgaXMgYXZhaWxhYmxlXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gc3RyZWFtIFByb21pc2Ugb2YgdGhlIGNoYW5uZWxcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIENoYW5uZWxDb2xsZWN0aW9uKCkge1xuICAgICAgdGhpcy5jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5kZWZlcnMgPSB7fTtcbiAgICAgIHRoaXMucGVuZGluZyA9IHt9O1xuICAgICAgdGhpcy53YWl0X2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMud2FpdF9wID0gdGhpcy53YWl0X2QucHJvbWlzZTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgbG9jYWwgY2hhbm5lbCBkZXNjcmlwdGlvbi5cbiAgICAgKiBAbWV0aG9kIHNldExvY2FsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgT2JqZWN0IGRlc2NyaWJpbmcgZWFjaCBvZmZlcmVkIERhdGFDaGFubmVsXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuc2V0TG9jYWwgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB0aGlzLmxvY2FsID0gZGF0YTtcbiAgICAgIGlmICh0aGlzLnJlbW90ZSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91cGRhdGUoKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJlbW90ZSBjaGFubmVsIGRlc2NyaXB0aW9uLlxuICAgICAqIEBtZXRob2Qgc2V0UmVtb3RlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgT2JqZWN0IGRlc2NyaWJpbmcgZWFjaCBvZmZlcmVkIERhdGFDaGFubmVsXG4gICAgICovXG5cbiAgICBDaGFubmVsQ29sbGVjdGlvbi5wcm90b3R5cGUuc2V0UmVtb3RlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdGhpcy5yZW1vdGUgPSBkYXRhO1xuICAgICAgaWYgKHRoaXMubG9jYWwgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCk7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTWF0Y2hlcyByZW1vdGUgYW5kIGxvY2FsIGRlc2NyaXB0aW9ucyBhbmQgY3JlYXRlcyBwcm9taXNlcyBjb21tb24gRGF0YUNoYW5uZWxzXG4gICAgICogQG1ldGhvZCBfdXBkYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIENoYW5uZWxDb2xsZWN0aW9uLnByb3RvdHlwZS5fdXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2hhbm5lbCwgY29uZmlnLCBkZWZlciwgbmFtZSwgcmVmMTtcbiAgICAgIHJlZjEgPSB0aGlzLnJlbW90ZTtcbiAgICAgIGZvciAobmFtZSBpbiByZWYxKSB7XG4gICAgICAgIGNvbmZpZyA9IHJlZjFbbmFtZV07XG4gICAgICAgIGlmICh0aGlzLmxvY2FsW25hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAodGhpcy5jaGFubmVsc1tuYW1lXSAhPSBudWxsKSB7XG5cbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGVuZGluZ1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjaGFubmVsID0gdGhpcy5wZW5kaW5nW25hbWVdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucGVuZGluZ1tuYW1lXTtcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbbmFtZV0gPSBQcm9taXNlLnJlc29sdmUoY2hhbm5lbCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9hZGRlZCcsIG5hbWUsIHRoaXMuY2hhbm5lbHNbbmFtZV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWZlciA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgICAgICAgdGhpcy5jaGFubmVsc1tuYW1lXSA9IGRlZmVyLnByb21pc2U7XG4gICAgICAgICAgICB0aGlzLmRlZmVyc1tuYW1lXSA9IGRlZmVyO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdkYXRhX2NoYW5uZWxfYWRkZWQnLCBuYW1lLCB0aGlzLmNoYW5uZWxzW25hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJEYXRhQ2hhbm5lbCBvZmZlcmVkIGJ5IHJlbW90ZSBidXQgbm90IGJ5IGxvY2FsXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKG5hbWUgaW4gdGhpcy5sb2NhbCkge1xuICAgICAgICBpZiAodGhpcy5yZW1vdGVbbmFtZV0gPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiRGF0YUNoYW5uZWwgb2ZmZXJlZCBieSBsb2NhbCBidXQgbm90IGJ5IHJlbW90ZVwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMud2FpdF9kLnJlc29sdmUoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyBwcm9taXNlcyB3YWl0aW5nIGZvciB0aGUgZ2l2ZW4gRGF0YUNoYW5uZWxcbiAgICAgKiBAbWV0aG9kIHJlc29sdmVcbiAgICAgKiBAcGFyYW0ge0RhdGFDaGFubmVsfSBjaGFubmVsIFRoZSBuZXcgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihjaGFubmVsKSB7XG4gICAgICB2YXIgbGFiZWw7XG4gICAgICBsYWJlbCA9IGNoYW5uZWwubGFiZWwoKTtcbiAgICAgIGlmICh0aGlzLmRlZmVyc1tsYWJlbF0gIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlZmVyc1tsYWJlbF0ucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgcmV0dXJuIGRlbGV0ZSB0aGlzLmRlZmVyc1tsYWJlbF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5wZW5kaW5nW2xhYmVsXSA9IGNoYW5uZWw7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgcHJvbWlzZSB0byBhIERhdGFDaGFubmVsLiBXaWxsIHJlc29sdmUgaWYgRGF0YUNoYW5uZWwgd2FzIG9mZmVyZWQgYW5kIGdldHMgaW5pdGlhdGVkLiBNaWdodCByZWplY3QgYWZ0ZXIgcmVtb3RlIGFuZCBsb2NhbCBkZXNjcmlwdGlvbiBhcmUgcHJvY2Vzc2VkLlxuICAgICAqIEBtZXRob2QgZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIGxhYmVsIG9mIHRoZSBjaGFubmVsIHRvIGdldFxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gRGF0YUNoYW5uZWx9IFByb21pc2UgZm9yIHRoZSBEYXRhQ2hhbm5lbFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbENvbGxlY3Rpb24ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiB0aGlzLndhaXRfcC50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKF90aGlzLmNoYW5uZWxzW25hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsc1tuYW1lXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGF0YUNoYW5uZWwgbm90IG5lZ290aWF0ZWRcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2hhbm5lbENvbGxlY3Rpb247XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcblxuLyoqXG4gKiBAbW9kdWxlIHJ0Yy5pbnRlcm5hbFxuICovXG5cblxuLyoqXG4gKiBBbGlhcyBmb3IgbmF0aXZlIHByb21pc2VzIG9yIGEgcG9seWZpbGwgaWYgbm90IHN1cHBvcnRlZFxuICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5Qcm9taXNlXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICBleHBvcnRzLlByb21pc2UgPSBnbG9iYWwuUHJvbWlzZSB8fCByZXF1aXJlKCdlczYtcHJvbWlzZScpLlByb21pc2U7XG5cblxuICAvKipcbiAgICogSGVscGVyIHRvIGltcGxlbWVudCBkZWZlcnJlZCBleGVjdXRpb24gd2l0aCBwcm9taXNlc1xuICAgKiBAY2xhc3MgcnRjLmludGVybmFsLkRlZmVycmVkXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJlc29sdmVzIHRoZSBwcm9taXNlXG4gICAqIEBtZXRob2QgcmVzb2x2ZVxuICAgKiBAcGFyYW0gW2RhdGFdIFRoZSBwYXlsb2FkIHRvIHdoaWNoIHRoZSBwcm9taXNlIHdpbGwgcmVzb2x2ZVxuICAjXG4gICAqIEBleGFtcGxlXG4gICAqICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKVxuICAgKiAgICAgZGVmZXIucmVzb2x2ZSg0Mik7XG4gICAqICAgICBkZWZlci5wcm9taXNlLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAqICAgICAgIGNvbnNvbGUubG9nKHJlcyk7ICAgLy8gNDJcbiAgICogICAgIH1cbiAgICovXG5cblxuICAvKipcbiAgICogUmVqZWN0IHRoZSBwcm9taXNlXG4gICAqIEBtZXRob2QgcmVqZWN0XG4gICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIFRoZSBwYXlsb2FkIHRvIHdoaWNoIHRoZSBwcm9taXNlIHdpbGwgcmVzb2x2ZVxuICAjXG4gICAqIEBleGFtcGxlXG4gICAqICAgICB2YXIgZGVmZXIgPSBuZXcgRGVmZXJyZWQoKVxuICAgKiAgICAgZGVmZXIucmVqZWN0KG5ldyBFcnJvcihcIlJlamVjdCBiZWNhdXNlIHdlIGNhbiFcIikpO1xuICAgKiAgICAgZGVmZXIucHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICogICAgICAgLy8gd29udCBoYXBwZW5cbiAgICogICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgKiAgICAgICAvLyB3aWxsIGhhcHBlblxuICAgKiAgICAgfVxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBUaGUgcHJvbWlzZSB3aGljaCB3aWxsIGdldCByZXNvbHZlZCBvciByZWplY3RlZCBieSB0aGlzIGRlZmVycmVkXG4gICAqIEBwcm9wZXJ0eSB7UHJvbWlzZX0gcHJvbWlzZVxuICAgKi9cblxuICBleHBvcnRzLkRlZmVycmVkID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIERlZmVycmVkKCkge1xuICAgICAgdGhpcy5wcm9taXNlID0gbmV3IGV4cG9ydHMuUHJvbWlzZSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgIF90aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5yZWplY3QgPSByZWplY3Q7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIERlZmVycmVkO1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgRXZlbnRFbWl0dGVyLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRGVmZXJyZWQgPSByZXF1aXJlKCcuL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuaW50ZXJuYWxcbiAgICovXG5cblxuICAvKipcbiAgICogSGVscGVyIGhhbmRsaW5nIHRoZSBtYXBwaW5nIG9mIHN0cmVhbXMgZm9yIFJlbW90ZVBlZXJcbiAgICogQGNsYXNzIHJ0Yy5pbnRlcm5hbC5TdHJlYW1Db2xsZWN0aW9uXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIGV4cG9ydHMuU3RyZWFtQ29sbGVjdGlvbiA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFN0cmVhbUNvbGxlY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBzdHJlYW0gd2FzIGFkZGVkIHRvIHRoZSBjb2xsZWN0aW9uXG4gICAgICogQGV2ZW50IHN0ZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIHVzZXIgZGVmaW5lZCBuYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gc3RyZWFtIFByb21pc2UgdG8gdGhlIHN0cmVhbVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gU3RyZWFtQ29sbGVjdGlvbigpIHtcblxuICAgICAgLyoqXG4gICAgICAgKiBDb250YWlucyB0aGUgcHJvbWlzZXMgd2hpY2ggd2lsbCByZXNvbHZlIHRvIHRoZSBzdHJlYW1zXG4gICAgICAgKiBAcHJvcGVydHkge09iamVjdH0gc3RyZWFtc1xuICAgICAgICovXG4gICAgICB0aGlzLnN0cmVhbXMgPSB7fTtcbiAgICAgIHRoaXMuX2RlZmVycyA9IHt9O1xuICAgICAgdGhpcy5fd2FpdGluZyA9IHt9O1xuICAgICAgdGhpcy5fcGVuZGluZyA9IHt9O1xuICAgICAgdGhpcy53YWl0X2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMud2FpdF9wID0gdGhpcy53YWl0X2QucHJvbWlzZTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFNldCBzdHJlYW0gZGVzY3JpcHRpb24gYW5kIGdlbmVyYXRlIHByb21pc2VzXG4gICAgICogQG1ldGhvZCB1cGRhdGVcbiAgICAgKiBAcGFyYW0gZGF0YSB7T2JqZWN0fSBBbiBvYmplY3QgbWFwcGluZyB0aGUgc3RyZWFtIGlkcyB0byBzdHJlYW0gbmFtZXNcbiAgICAgKi9cblxuICAgIFN0cmVhbUNvbGxlY3Rpb24ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBkZWZlciwgaSwgaWQsIGxlbiwgbWVtYmVycywgbmFtZSwgcmVmLCBzdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgbWVtYmVycyA9IFtdO1xuICAgICAgdGhpcy5fd2FpdGluZyA9IHt9O1xuICAgICAgcmVmID0gdGhpcy5zdHJlYW1zO1xuICAgICAgZm9yIChzdHJlYW1fcCA9IGkgPSAwLCBsZW4gPSByZWYubGVuZ3RoOyBpIDwgbGVuOyBzdHJlYW1fcCA9ICsraSkge1xuICAgICAgICBuYW1lID0gcmVmW3N0cmVhbV9wXTtcbiAgICAgICAgaWYgKGRhdGFbbmFtZV0gPT0gbnVsbCkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLnN0cmVhbXNbbmFtZV07XG4gICAgICAgICAgdGhpcy5lbWl0KCdzdHJlYW1fcmVtb3ZlZCcsIG5hbWUpO1xuICAgICAgICAgIGlmIChzdHJlYW1fcC5pc0Z1bGxmaWxsZWQoKSkge1xuICAgICAgICAgICAgc3RyZWFtX3AudGhlbihmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN0cmVhbS5jbG9zZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChzdHJlYW1fcC5pc1BlbmRpbmcoKSkge1xuICAgICAgICAgICAgc3RyZWFtX3AucmVqZWN0KG5ldyBFcnJvcihcIlN0cmVhbSByZW1vdmVkIGJlZm9yZSBiZWluZyBlc3RhYmxpc2hlZFwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKG5hbWUgaW4gZGF0YSkge1xuICAgICAgICBpZCA9IGRhdGFbbmFtZV07XG4gICAgICAgIGlmICh0aGlzLnN0cmVhbXNbbmFtZV0gPT0gbnVsbCkge1xuICAgICAgICAgIGRlZmVyID0gbmV3IERlZmVycmVkKCk7XG4gICAgICAgICAgdGhpcy5zdHJlYW1zW25hbWVdID0gZGVmZXIucHJvbWlzZTtcbiAgICAgICAgICB0aGlzLl9kZWZlcnNbbmFtZV0gPSBkZWZlcjtcbiAgICAgICAgICB0aGlzLmVtaXQoJ3N0cmVhbV9hZGRlZCcsIG5hbWUsIGRlZmVyLnByb21pc2UpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9kZWZlcnNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgIGlmICh0aGlzLl9wZW5kaW5nW2lkXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBzdHJlYW0gPSB0aGlzLl9wZW5kaW5nW2lkXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9wZW5kaW5nW2lkXTtcbiAgICAgICAgICAgIHRoaXMuX2RlZmVyc1tuYW1lXS5yZXNvbHZlKHN0cmVhbSk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZGVmZXJzW25hbWVdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nW2lkXSA9IG5hbWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy53YWl0X2QucmVzb2x2ZSgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBzdHJlYW0gdG8gdGhlIGNvbGxlY3Rpb24gYW5kIHJlc29sdmUgcHJvbWlzZXMgd2FpdGluZyBmb3IgaXRcbiAgICAgKiBAbWV0aG9kIHJlc29sdmVcbiAgICAgKiBAcGFyYW0ge3J0Yy5TdHJlYW19IHN0cmVhbVxuICAgICAqL1xuXG4gICAgU3RyZWFtQ29sbGVjdGlvbi5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgdmFyIGlkLCBuYW1lO1xuICAgICAgaWQgPSBzdHJlYW0uaWQoKTtcbiAgICAgIGlmICh0aGlzLl93YWl0aW5nW2lkXSAhPSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLl93YWl0aW5nW2lkXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3dhaXRpbmdbaWRdO1xuICAgICAgICB0aGlzLl9kZWZlcnNbbmFtZV0ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICByZXR1cm4gZGVsZXRlIHRoaXMuX2RlZmVyc1tuYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wZW5kaW5nW2lkXSA9IHN0cmVhbTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGEgcHJvbWlzZSBmb3IgYSBzdHJlYW0gd2l0aCB0aGUgZ2l2ZW4gbmFtZS4gTWlnaHQgYmUgcmVqZWN0ZWQgYWZ0ZXIgYHVwZGF0ZSgpYFxuICAgICNcbiAgICAgKiBAbWV0aG9kIGdldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gVGhlIHByb21pc2UgZm9yIHRoZSBgcnRjLlN0cmVhbWBcbiAgICAgKi9cblxuICAgIFN0cmVhbUNvbGxlY3Rpb24ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiB0aGlzLndhaXRfcC50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKF90aGlzLnN0cmVhbXNbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLnN0cmVhbXNbbmFtZV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlN0cmVhbSBub3Qgb2ZmZXJlZFwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBTdHJlYW1Db2xsZWN0aW9uO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBleHBvcnRzLCBleHRlbmQ7XG5cbiAgZXh0ZW5kID0gZnVuY3Rpb24ocm9vdCwgb2JqKSB7XG4gICAgdmFyIGtleSwgdmFsdWU7XG4gICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgcm9vdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBleHBvcnRzO1xuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IHtcbiAgICBpbnRlcm5hbDoge30sXG4gICAgc2lnbmFsaW5nOiB7fVxuICB9O1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3BlZXInKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vcmVtb3RlX3BlZXInKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vbG9jYWxfcGVlcicpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9wZWVyX2Nvbm5lY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vc3RyZWFtJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL2NvbXBhdCcpKTtcblxuICBleHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9yb29tJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL3ZpZGVvX2VsZW1lbnQnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24nKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuaW50ZXJuYWwsIHJlcXVpcmUoJy4vaW50ZXJuYWwvY2hhbm5lbF9jb2xsZWN0aW9uJykpO1xuXG4gIGV4dGVuZChleHBvcnRzLmludGVybmFsLCByZXF1aXJlKCcuL2ludGVybmFsL3Byb21pc2UnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuc2lnbmFsaW5nLCByZXF1aXJlKCcuL3NpZ25hbGluZy93ZWJfc29ja2V0X2NoYW5uZWwnKSk7XG5cbiAgZXh0ZW5kKGV4cG9ydHMuc2lnbmFsaW5nLCByZXF1aXJlKCcuL3NpZ25hbGluZy9wYWxhdmFfc2lnbmFsaW5nJykpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgUGVlciwgU3RyZWFtLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cbiAgU3RyZWFtID0gcmVxdWlyZSgnLi9zdHJlYW0nKS5TdHJlYW07XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgbG9jYWwgdXNlciBvZiB0aGUgcm9vbVxuICAgKiBAY2xhc3MgcnRjLkxvY2FsUGVlclxuICAgKiBAZXh0ZW5kcyBydGMuUGVlclxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cblxuICBleHBvcnRzLkxvY2FsUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKExvY2FsUGVlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBMb2NhbFBlZXIoKSB7XG5cbiAgICAgIC8qKlxuICAgICAgICogQ29udGFpbnMgcHJvbWlzZXMgb2YgdGhlIGxvY2FsIHN0cmVhbXMgb2ZmZXJlZCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICAgKiBAcHJvcGVydHkgc3RyZWFtc1xuICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgKi9cbiAgICAgIHRoaXMuc3RyZWFtcyA9IHt9O1xuXG4gICAgICAvKipcbiAgICAgICAqIENvbnRhaW5zIGFsbCBEYXRhQ2hhbm5lbCBjb25maWd1cmF0aW9ucyBuZWdvdGlhdGVkIHdpdGggYWxsIHJlbW90ZSBwZWVyc1xuICAgICAgICogQHByb3BlcnR5IGNoYW5uZWxzXG4gICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAqL1xuICAgICAgdGhpcy5jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5fc3RhdHVzID0ge307XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYW4gaXRlbSBvZiB0aGUgc3RhdHVzIHRyYW5zZmVycmVkIHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUuIFdpbGwgcmV0dXJuXG4gICAgICogQHJldHVybiBUaGUgdmFsdWUgYXNzb2NpYXRlZCB3aXRoIHRoZSBrZXlcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogU2V0IGFuIGl0ZW0gb2YgdGhlIHN0YXR1cyB0cmFuc2ZlcnJlZCB0byBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBzdGF0dXNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHZhbHVlLiBXaWxsIHJldHVyblxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gc3RvcmVcbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuc3RhdHVzID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5fc3RhdHVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5lbWl0KCdzdGF0dXNfY2hhbmdlZCcsIHRoaXMuX3N0YXR1cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdHVzW2tleV07XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGRhdGEgY2hhbm5lbCB3aGljaCB3aWxsIGJlIG5lZ290aWF0ZWQgd2l0aCBhbGwgcmVtb3RlIHBlZXJzXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nZGF0YSddIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGVzYz17b3JkZXJlZDogdHJ1ZX1dIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENEYXRhQ2hhbm5lbC5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgTG9jYWxQZWVyLnByb3RvdHlwZS5hZGREYXRhQ2hhbm5lbCA9IGZ1bmN0aW9uKG5hbWUsIGRlc2MpIHtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGVzYyA9IG5hbWU7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfQ0hBTk5FTDtcbiAgICAgIH1cbiAgICAgIGlmIChkZXNjID09IG51bGwpIHtcbiAgICAgICAgZGVzYyA9IHtcbiAgICAgICAgICBvcmRlcmVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLmNoYW5uZWxzW25hbWVdID0gZGVzYztcbiAgICAgIHRoaXMuZW1pdCgnY29uZmlndXJhdGlvbl9jaGFuZ2VkJyk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGxvY2FsIHN0cmVhbSB0byBiZSBzZW50IHRvIGFsbCByZW1vdGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIGFkZFN0cmVhbVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nc3RyZWFtJ10gTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW0gfCBydGMuU3RyZWFtIHwgT2JqZWN0fSBzdHJlYW0gVGhlIHN0cmVhbSwgYSBwcm9taXNlIHRvIHRoZSBzdHJlYW0gb3IgdGhlIGNvbmZpZ3VyYXRpb24gdG8gY3JlYXRlIGEgc3RyZWFtIHdpdGggYHJ0Yy5TdHJlYW0uY3JlYXRlU3RyZWFtKClgXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIG9mIHRoZSBzdHJlYW0gd2hpY2ggd2FzIGFkZGVkXG4gICAgICovXG5cbiAgICBMb2NhbFBlZXIucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUsIG9iaikge1xuICAgICAgdmFyIHNhdmVTdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgc2F2ZVN0cmVhbSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RyZWFtX3ApIHtcbiAgICAgICAgICBfdGhpcy5zdHJlYW1zW25hbWVdID0gc3RyZWFtX3A7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY29uZmlndXJhdGlvbl9jaGFuZ2VkJyk7XG4gICAgICAgICAgcmV0dXJuIHN0cmVhbV9wO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIG9iaiA9IG5hbWU7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgaWYgKChvYmogIT0gbnVsbCA/IG9iai50aGVuIDogdm9pZCAwKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKG9iaik7XG4gICAgICB9IGVsc2UgaWYgKG9iaiBpbnN0YW5jZW9mIFN0cmVhbSkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShQcm9taXNlLnJlc29sdmUob2JqKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHJlYW1fcCA9IFN0cmVhbS5jcmVhdGVTdHJlYW0ob2JqKTtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oc3RyZWFtX3ApO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCBsb2NhbCBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIHN0cmVhbVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nc3RyZWFtJ10gTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuU3RyZWFtfSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuICAgIExvY2FsUGVlci5wcm90b3R5cGUuc3RyZWFtID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0cmVhbXNbbmFtZV07XG4gICAgfTtcblxuICAgIHJldHVybiBMb2NhbFBlZXI7XG5cbiAgfSkoUGVlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBFdmVudEVtaXR0ZXIsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQSB1c2VyIGluIHRoZSByb29tXG4gICAqIEBjbGFzcyBydGMuUGVlclxuICAgKi9cblxuICBleHBvcnRzLlBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChQZWVyLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBlZXIoKSB7XG4gICAgICByZXR1cm4gUGVlci5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGF0dXMgb2YgdGhlIHBlZXIgaGFzIGNoYW5nZWRcbiAgICAgKiBAZXZlbnQgc3RhdHVzX2NoYW5nZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIFRoZSBuZXcgc3RhdHVzIG9iamVjdFxuICAgICAqL1xuXG4gICAgUGVlci5wcm90b3R5cGUuREVGQVVMVF9DSEFOTkVMID0gJ2RhdGEnO1xuXG4gICAgUGVlci5wcm90b3R5cGUuREVGQVVMVF9TVFJFQU0gPSAnc3RyZWFtJztcblxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgdmFsdWUgb2YgdGhlIHN0YXR1cyBvYmplY3RcbiAgICAgKiBAbWV0aG9kIHN0YXR1c1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSBcbiAgICAgKiBAcmV0dXJuIFRoZSB2YWx1ZVxuICAgICAqL1xuXG4gICAgUGVlci5wcm90b3R5cGUuc3RhdHVzID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEYXRhQ2hhbm5lbCwgRGVmZXJyZWQsIEV2ZW50RW1pdHRlciwgUHJvbWlzZSwgU3RyZWFtLCBjb21wYXQsIHJlZixcbiAgICBleHRlbmQgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKGhhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH0sXG4gICAgaGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIHJlZiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLCBEZWZlcnJlZCA9IHJlZi5EZWZlcnJlZCwgUHJvbWlzZSA9IHJlZi5Qcm9taXNlO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuICBEYXRhQ2hhbm5lbCA9IHJlcXVpcmUoJy4vZGF0YV9jaGFubmVsJykuRGF0YUNoYW5uZWw7XG5cbiAgY29tcGF0ID0gcmVxdWlyZSgnLi9jb21wYXQnKS5jb21wYXQ7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgbmF0aXZlIFJUQ1BlZXJDb25uZWN0aW9uXG4gICNcbiAgICogUHJvdmlkZXMgZXZlbnRzIGZvciBuZXcgc3RyZWFtcyBhbmQgZGF0YSBjaGFubmVscy4gU2lnbmFsaW5nIGluZm9ybWF0aW9uIGhhc1xuICAgKiB0byBiZSBmb3J3YXJkZWQgZnJvbSBldmVudHMgZW1pdHRlZCBieSB0aGlzIG9iamVjdCB0byB0aGUgcmVtb3RlXG4gICAqIFBlZXJDb25uZWN0aW9uLlxuICAjXG4gICAqIEBjbGFzcyBydGMuUGVlckNvbm5lY3Rpb25cbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9mZmVyaW5nIFRydWUgaWYgdGhlIGxvY2FsIHBlZXIgc2hvdWxkIGluaXRpYXRlIHRoZSBjb25uZWN0aW9uXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIE9wdGlvbnMgb2JqZWN0IHBhc3NlZCBvbiBmcm9tIGBSb29tYFxuICAgKi9cblxuICBleHBvcnRzLlBlZXJDb25uZWN0aW9uID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGVlckNvbm5lY3Rpb24sIHN1cGVyQ2xhc3MpO1xuXG5cbiAgICAvKipcbiAgICAgKiBOZXcgbG9jYWwgSUNFIGNhbmRpZGF0ZSB3aGljaCBzaG91bGQgYmUgc2lnbmFsZWQgdG8gcmVtb3RlIHBlZXJcbiAgICAgKiBAZXZlbnQgaWNlX2NhbmRpYXRlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNhbmRpZGF0ZSBUaGUgaWNlIGNhbmRpZGF0ZVxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBOZXcgcmVtb3RlIHN0cmVhbSB3YXMgYWRkZWQgdG8gdGhlIFBlZXJDb25uZWN0aW9uXG4gICAgICogQGV2ZW50IHN0cmVhbV9hZGRlZFxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtIFRoZSBzdHJlYW1cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogTmV3IERhdGFDaGFubmVsIHRvIHRoZSByZW1vdGUgcGVlciBpcyByZWFkeSB0byBiZSB1c2VkXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9yZWFkeVxuICAgICAqIEBwYXJhbSB7cnRjLkRhdGFDaGFubmVsfSBjaGFubmVsIFRoZSBkYXRhIGNoYW5uZWxcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogTmV3IG9mZmVyIG9yIGFuc3dlciB3aGljaCBzaG91bGQgYmUgc2lnbmFsZWQgdG8gdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQGV2ZW50IHNpZ25hbGluZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIHNpZ25hbGluZyBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBQZWVyQ29ubmVjdGlvbiB3YXMgY2xvc2VkXG4gICAgICogQGV2ZW50IGNsb3NlZFxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gUGVlckNvbm5lY3Rpb24ob2ZmZXJpbmcsIG9wdGlvbnMxKSB7XG4gICAgICB2YXIgaWNlX3NlcnZlcnM7XG4gICAgICB0aGlzLm9mZmVyaW5nID0gb2ZmZXJpbmc7XG4gICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zMTtcbiAgICAgIGljZV9zZXJ2ZXJzID0gW107XG4gICAgICBpZiAodGhpcy5vcHRpb25zLnN0dW4gIT0gbnVsbCkge1xuICAgICAgICBpY2Vfc2VydmVycy5wdXNoKHtcbiAgICAgICAgICB1cmw6IHRoaXMub3B0aW9ucy5zdHVuXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdGhpcy5wYyA9IG5ldyBjb21wYXQuUGVlckNvbm5lY3Rpb24oe1xuICAgICAgICBpY2VTZXJ2ZXJzOiBpY2Vfc2VydmVyc1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RfZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nX3BlbmRpbmcgPSBbXTtcbiAgICAgIHRoaXMucGMub25pY2VjYW5kaWRhdGUgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2ljZV9jYW5kaWRhdGUnLCBldmVudC5jYW5kaWRhdGUpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uYWRkc3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdzdHJlYW1fYWRkZWQnLCBuZXcgU3RyZWFtKGV2ZW50LnN0cmVhbSkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uZGF0YWNoYW5uZWwgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2RhdGFfY2hhbm5lbF9yZWFkeScsIG5ldyBEYXRhQ2hhbm5lbChldmVudC5jaGFubmVsKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMucGMub25yZW1vdmVzdHJlYW0gPSBmdW5jdGlvbihldmVudCkge307XG4gICAgICB0aGlzLnBjLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKCdvbm5lZ290aWF0aW9ubmVlZGVkIGNhbGxlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICB0aGlzLnBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcmVmMTtcbiAgICAgICAgICBpZiAoX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZmFpbGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0RXJyb3IobmV3IEVycm9yKFwiVW5hYmxlIHRvIGVzdGFibGlzaCBJQ0UgY29ubmVjdGlvblwiKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChfdGhpcy5wYy5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdjbG9zZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuY29ubmVjdF9kLnJlamVjdChuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gd2FzIGNsb3NlZCcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKChyZWYxID0gX3RoaXMucGMuaWNlQ29ubmVjdGlvblN0YXRlKSA9PT0gJ2Nvbm5lY3RlZCcgfHwgcmVmMSA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5jb25uZWN0X2QucmVzb2x2ZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5wYy5vbnNpZ25hbGluZ3N0YXRlY2hhbmdlID0gZnVuY3Rpb24oZXZlbnQpIHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQWRkIG5ldyBzaWduYWxpbmcgaW5mb3JtYXRpb24gcmVjZWl2ZWQgZnJvbSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2Qgc2lnbmFsaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIHNpZ25hbGluZyBpbmZvcm1hdGlvblxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLnNpZ25hbGluZyA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBzZHA7XG4gICAgICBzZHAgPSBuZXcgY29tcGF0LlNlc3Npb25EZXNjcmlwdGlvbihkYXRhKTtcbiAgICAgIHJldHVybiB0aGlzLl9zZXRSZW1vdGVEZXNjcmlwdGlvbihzZHApLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnb2ZmZXInICYmIF90aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9hbnN3ZXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgcmVtb3RlIElDRSBjYW5kaWRhdGVcbiAgICAgKiBAbWV0aG9kIGFkZEljZUNhbmRpZGF0ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjIFRoZSBjYW5kaWRhdGVcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRJY2VDYW5kaWRhdGUgPSBmdW5jdGlvbihkZXNjKSB7XG4gICAgICB2YXIgY2FuZGlkYXRlO1xuICAgICAgaWYgKGRlc2MuY2FuZGlkYXRlICE9IG51bGwpIHtcbiAgICAgICAgY2FuZGlkYXRlID0gbmV3IGNvbXBhdC5JY2VDYW5kaWRhdGUoZGVzYyk7XG4gICAgICAgIHJldHVybiB0aGlzLnBjLmFkZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKFwiSUNFIHRyaWNrbGluZyBzdG9wcGVkXCIpO1xuICAgICAgfVxuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG9wdGlvbnMgZm9yIHRoZSBvZmZlci9hbnN3ZXJcbiAgICAgKiBAbWV0aG9kIF9vYU9wdGlvbnNcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fb2FPcHRpb25zID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcHRpb25hbDogW10sXG4gICAgICAgIG1hbmRhdG9yeToge1xuICAgICAgICAgIE9mZmVyVG9SZWNlaXZlQXVkaW86IHRydWUsXG4gICAgICAgICAgT2ZmZXJUb1JlY2VpdmVWaWRlbzogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcmVtb3RlIGRlc2NyaXB0aW9uXG4gICAgICogQG1ldGhvZCBfc2V0UmVtb3RlRGVzY3JpcHRpb25cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzZHAgVGhlIHJlbW90ZSBTRFBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgb25jZSB0aGUgcmVtb3RlIGRlc2NyaXB0aW9uIHdhcyBzZXQgc3VjY2Vzc2Z1bGx5XG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX3NldFJlbW90ZURlc2NyaXB0aW9uID0gZnVuY3Rpb24oc2RwKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICB2YXIgZGVzY3JpcHRpb247XG4gICAgICAgICAgZGVzY3JpcHRpb24gPSBuZXcgcnRjLmNvbXBhdC5TZXNzaW9uRGVzY3JpcHRpb24oc2RwKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGMuc2V0UmVtb3RlRGVzY3JpcHRpb24oc2RwLCByZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBvZmZlciwgc2V0IGl0IG9uIGxvY2FsIGRlc2NyaXB0aW9uIGFuZCBlbWl0IGl0XG4gICAgICogQG1ldGhvZCBfb2ZmZXJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLl9vZmZlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLmNyZWF0ZU9mZmVyKHJlc29sdmUsIHJlamVjdCwgX3RoaXMuX29hT3B0aW9ucygpKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc2RwKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLl9wcm9jZXNzTG9jYWxTZHAoc2RwKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKVtcImNhdGNoXCJdKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLl9jb25uZWN0RXJyb3IoZXJyKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW5zd2VyLCBzZXQgaXQgb24gbG9jYWwgZGVzY3JpcHRpb24gYW5kIGVtaXQgaXRcbiAgICAgKiBAbWV0aG9kIF9vZmZlclxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Fuc3dlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBjLmNyZWF0ZUFuc3dlcihyZXNvbHZlLCByZWplY3QsIF90aGlzLl9vYU9wdGlvbnMoKSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSkudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNkcCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fcHJvY2Vzc0xvY2FsU2RwKHNkcCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSlbXCJjYXRjaFwiXSgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fY29ubmVjdEVycm9yKGVycik7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogU2V0IGxvY2FsIGRlc2NyaXB0aW9uIGFuZCBlbWl0IGl0XG4gICAgICogQG1ldGhvZCBfcHJvY2Vzc0xvY2FsU2RwXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2RwIFRoZSBsb2NhbCBTRFBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgb25jZSB0aGUgbG9jYWwgZGVzY3JpcHRpb24gd2FzIHNldCBzdWNjZXNzZnVsbHlcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fcHJvY2Vzc0xvY2FsU2RwID0gZnVuY3Rpb24oc2RwKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICB2YXIgc3VjY2VzcztcbiAgICAgICAgICBzdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZGF0YTtcbiAgICAgICAgICAgIGRhdGEgPSB7XG4gICAgICAgICAgICAgIHNkcDogc2RwLnNkcCxcbiAgICAgICAgICAgICAgdHlwZTogc2RwLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBfdGhpcy5lbWl0KCdzaWduYWxpbmcnLCBkYXRhKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHNkcCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucGMuc2V0TG9jYWxEZXNjcmlwdGlvbihzZHAsIHN1Y2Nlc3MsIHJlamVjdCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTWFyayBjb25uZWN0aW9uIGF0dGVtcHQgYXMgZmFpbGVkXG4gICAgICogQG1ldGhvZCBfY29ubmVjdEVycm9yXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnIgRXJyb3IgY2F1c2luZyBjb25uZWN0aW9uIHRvIGZhaWxcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5fY29ubmVjdEVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICB0aGlzLmNvbm5lY3RfZC5yZWplY3QoZXJyKTtcbiAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGxvY2FsIHN0cmVhbVxuICAgICAqIEBtZXRob2QgYWRkU3RyZWFtXG4gICAgICogQHBhcmFtIHtydGMuU3RyZWFtfSBzdHJlYW0gVGhlIGxvY2FsIHN0cmVhbVxuICAgICAqL1xuXG4gICAgUGVlckNvbm5lY3Rpb24ucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgcmV0dXJuIHRoaXMucGMuYWRkU3RyZWFtKHN0cmVhbS5zdHJlYW0pO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBsb2NhbCBzdHJlYW1cbiAgICAgKiBAbWV0aG9kIHJlbW92ZVN0cmVhbVxuICAgICAqIEBwYXJhbSB7cnRjLlN0cmVhbX0gc3RyZWFtIFRoZSBsb2NhbCBzdHJlYW1cbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5yZW1vdmVTcmVhbSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgICAgcmV0dXJuIHRoaXMucGMucmVtb3ZlU3RyZWFtKHN0cmVhbS5zdHJlYW0pO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBEYXRhQ2hhbm5lbC4gV2lsbCBvbmx5IGFjdHVhbGx5IGRvIHNvbWV0aGluZyBpZiBgb2ZmZXJpbmdgIGlzIGB0cnVlYC5cbiAgICAgKiBAbWV0aG9kIGFkZERhdGFDaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRlc2MgT3B0aW9ucyBwYXNzZWQgdG8gYFJUQ1BlZXJDb25uZWN0aW9uLmNyZWF0ZURhdGFDaGFubmVsKClgXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuYWRkRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihuYW1lLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY2hhbm5lbDtcbiAgICAgIGlmICh0aGlzLm9mZmVyaW5nKSB7XG4gICAgICAgIGNoYW5uZWwgPSB0aGlzLnBjLmNyZWF0ZURhdGFDaGFubmVsKG5hbWUsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gY2hhbm5lbC5vbm9wZW4gPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZGF0YV9jaGFubmVsX3JlYWR5JywgbmV3IERhdGFDaGFubmVsKGNoYW5uZWwpKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBFc3RhYmxpc2ggY29ubmVjdGlvbiB3aXRoIHJlbW90ZSBwZWVyLiBDb25uZWN0aW9uIHdpbGwgYmUgZXN0YWJsaXNoZWQgb25jZSBib3RoIHBlZXJzIGhhdmUgY2FsbGVkIHRoaXMgZnVuY3Rpb1xuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCBiZSByZXNvbHZlZCBvbmNlIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBQZWVyQ29ubmVjdGlvbi5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCF0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICBpZiAodGhpcy5vZmZlcmluZykge1xuICAgICAgICAgIHRoaXMuX29mZmVyKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wYy5zaWduYWxpbmdTdGF0ZSA9PT0gJ2hhdmUtcmVtb3RlLW9mZmVyJykge1xuICAgICAgICAgIHRoaXMuX2Fuc3dlcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfZC5wcm9taXNlO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlIHRoZSBjb25uZWN0aW9uIHRvIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIFBlZXJDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wYy5jbG9zZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgfTtcblxuICAgIHJldHVybiBQZWVyQ29ubmVjdGlvbjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQ2hhbm5lbENvbGxlY3Rpb24sIFBlZXIsIFByb21pc2UsIFN0cmVhbUNvbGxlY3Rpb24sIG1lcmdlLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgUHJvbWlzZSA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvcHJvbWlzZScpLlByb21pc2U7XG5cbiAgUGVlciA9IHJlcXVpcmUoJy4vcGVlcicpLlBlZXI7XG5cbiAgU3RyZWFtQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtX2NvbGxlY3Rpb24nKS5TdHJlYW1Db2xsZWN0aW9uO1xuXG4gIENoYW5uZWxDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9jaGFubmVsX2NvbGxlY3Rpb24nKS5DaGFubmVsQ29sbGVjdGlvbjtcblxuICBtZXJnZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcnJheSwgaSwga2V5LCBsZW4sIHJlcywgdmFsdWU7XG4gICAgcmVzID0ge307XG4gICAgZm9yIChpID0gMCwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBhcnJheSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAoa2V5IGluIGFycmF5KSB7XG4gICAgICAgIHZhbHVlID0gYXJyYXlba2V5XTtcbiAgICAgICAgcmVzW2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgcmVtb3RlIHVzZXIgb2YgdGhlIHJvb21cbiAgICogQGNsYXNzIHJ0Yy5SZW1vdGVQZWVyXG4gICAqIEBleHRlbmRzIHJ0Yy5QZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLlBlZXJDb25uZWN0aW9ufSBwZWVyX2Nvbm5lY3Rpb24gVGhlIHVuZGVybHlpbmcgcGVlciBjb25uZWN0aW9uXG4gICAqIEBwYXJhbSB7cnRjLlNpZ25hbGluZ1BlZXJ9IHNpZ25hbGluZyBUaGUgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICogQHBhcmFtIHtydGMuTG9jYWxQZWVyfSBsb2NhbCBUaGUgbG9jYWwgcGVlclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBUaGUgb3B0aW9ucyBvYmplY3QgYXMgcGFzc2VkIHRvIGBSb29tYFxuICAgKi9cblxuICBleHBvcnRzLlJlbW90ZVBlZXIgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChSZW1vdGVQZWVyLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogTWVzc2FnZSByZWNlaXZlZCBmcm9tIHBlZXIgdGhyb3VnaCBzaWduYWxpbmdcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkIG9mIHRoZSBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW1vdGUgcGVlciBsZWZ0IG9yIHNpZ25hbGluZyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBBIG5ldyBzdHJlYW0gaXMgYXZhaWxhYmxlIGZyb20gdGhlIHBlZXJcbiAgICAgKiBAZXZlbnQgc3RyZWFtX2FkZGVkXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IHN0cmVhbSBQcm9taXNlIG9mIHRoZSBzdHJlYW1cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgZGF0YSBjaGFubmVsIGlzIGF2YWlsYWJsZSBmcm9tIHRoZSBwZWVyXG4gICAgICogQGV2ZW50IGRhdGFfY2hhbm5lbF9hZGRlZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIGNoYW5uZWxcbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLkRhdGFDaGFubmVsfSBjaGFubmVsIFByb21pc2Ugb2YgdGhlIGNoYW5uZWxcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFJlbW90ZVBlZXIocGVlcl9jb25uZWN0aW9uLCBzaWduYWxpbmcsIGxvY2FsLCBvcHRpb25zMSkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24gPSBwZWVyX2Nvbm5lY3Rpb247XG4gICAgICB0aGlzLnNpZ25hbGluZyA9IHNpZ25hbGluZztcbiAgICAgIHRoaXMubG9jYWwgPSBsb2NhbDtcbiAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMxO1xuICAgICAgdGhpcy5wcml2YXRlX3N0cmVhbXMgPSB7fTtcbiAgICAgIHRoaXMucHJpdmF0ZV9jaGFubmVscyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbiA9IG5ldyBTdHJlYW1Db2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLnN0cmVhbXMgPSB0aGlzLnN0cmVhbV9jb2xsZWN0aW9uLnN0cmVhbXM7XG4gICAgICB0aGlzLnN0cmVhbXNfZGVzYyA9IHt9O1xuICAgICAgdGhpcy5zdHJlYW1fY29sbGVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihuYW1lLCBzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnc3RyZWFtX2FkZGVkJywgbmFtZSwgc3RyZWFtKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uID0gbmV3IENoYW5uZWxDb2xsZWN0aW9uKCk7XG4gICAgICB0aGlzLmNoYW5uZWxzID0gdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uY2hhbm5lbHM7XG4gICAgICB0aGlzLmNoYW5uZWxzX2Rlc2MgPSB7fTtcbiAgICAgIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLm9uKCdkYXRhX2NoYW5uZWxfYWRkZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUsIGNoYW5uZWwpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnZGF0YV9jaGFubmVsX2FkZGVkJywgbmFtZSwgY2hhbm5lbCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnBlZXJfY29ubmVjdGlvbi5vbignc3RyZWFtX2FkZGVkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuc3RyZWFtX2NvbGxlY3Rpb24ucmVzb2x2ZShzdHJlYW0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2RhdGFfY2hhbm5lbF9yZWFkeScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2hhbm5lbCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24ucmVzb2x2ZShjaGFubmVsKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBkYXRhLnN0cmVhbXMgPSBfdGhpcy5zdHJlYW1zX2Rlc2M7XG4gICAgICAgICAgZGF0YS5jaGFubmVscyA9IF90aGlzLmNoYW5uZWxzX2Rlc2M7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnNpZ25hbGluZy5zZW5kKCdzaWduYWxpbmcnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzaWduYWxpbmcnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBfdGhpcy5zdHJlYW1fY29sbGVjdGlvbi51cGRhdGUoZGF0YS5zdHJlYW1zKTtcbiAgICAgICAgICBfdGhpcy5jaGFubmVsX2NvbGxlY3Rpb24uc2V0UmVtb3RlKGRhdGEuY2hhbm5lbHMpO1xuICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uc2lnbmFsaW5nKGRhdGEpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2ljZV9jYW5kaWRhdGUnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zaWduYWxpbmcuc2VuZCgnaWNlX2NhbmRpZGF0ZScsIGNhbmRpZGF0ZSk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbignaWNlX2NhbmRpZGF0ZScsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnBlZXJfY29ubmVjdGlvbi5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdzdGF0dXNfY2hhbmdlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMuc2lnbmFsaW5nLm9uKCdsZWZ0JywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnbGVmdCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24ub24oJ2Nvbm5lY3RlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7fTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMucGVlcl9jb25uZWN0aW9uLm9uKCdjbG9zZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge307XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICBpZiAoKHRoaXMub3B0aW9ucy5hdXRvX2Nvbm5lY3QgPT0gbnVsbCkgfHwgdGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCkge1xuICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdGF0dXMgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNpZ25hbGluZy5zdGF0dXNba2V5XTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kIGEgbWVzc2FnZSB0byB0aGUgcGVlciB0aHJvdWdoIHNpZ25hbGluZ1xuICAgICAqIEBtZXRob2QgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBkYXRhIFRoZSBwYXlsb2FkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIHRoZSBkYXRhIHdhcyBzZW50XG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5tZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLnNlbmQoJ21lc3NhZ2UnLCBkYXRhKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRvIHRoZSByZW1vdGUgcGVlciB0byBleGNoYW5nZSBzdHJlYW1zIGFuZCBjcmVhdGUgZGF0YSBjaGFubmVsc1xuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggd2lsbCByZXNvbHZlZCB3aGVuIHRoZSBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbmFtZSwgcHJvbWlzZSwgcmVmLCBzdHJlYW0sIHN0cmVhbV9wcm9taXNlcztcbiAgICAgIGlmICh0aGlzLmNvbm5lY3RfcCA9PSBudWxsKSB7XG4gICAgICAgIHN0cmVhbV9wcm9taXNlcyA9IFtdO1xuICAgICAgICByZWYgPSBtZXJnZSh0aGlzLmxvY2FsLnN0cmVhbXMsIHRoaXMucHJpdmF0ZV9zdHJlYW1zKTtcbiAgICAgICAgZm9yIChuYW1lIGluIHJlZikge1xuICAgICAgICAgIHN0cmVhbSA9IHJlZltuYW1lXTtcbiAgICAgICAgICBwcm9taXNlID0gc3RyZWFtLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgICByZXR1cm4gW25hbWUsIHN0cmVhbV07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc3RyZWFtX3Byb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSBQcm9taXNlLmFsbChzdHJlYW1fcHJvbWlzZXMpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmVhbXMpIHtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIG9wdGlvbnMsIHJlZjEsIHJlZjI7XG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBzdHJlYW1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgIHJlZjEgPSBzdHJlYW1zW2ldLCBuYW1lID0gcmVmMVswXSwgc3RyZWFtID0gcmVmMVsxXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZFN0cmVhbShzdHJlYW0pO1xuICAgICAgICAgICAgICBfdGhpcy5zdHJlYW1zX2Rlc2NbbmFtZV0gPSBzdHJlYW0uaWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlZjIgPSBtZXJnZShfdGhpcy5sb2NhbC5jaGFubmVscywgX3RoaXMucHJpdmF0ZV9jaGFubmVscyk7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gcmVmMikge1xuICAgICAgICAgICAgICBvcHRpb25zID0gcmVmMltuYW1lXTtcbiAgICAgICAgICAgICAgX3RoaXMucGVlcl9jb25uZWN0aW9uLmFkZERhdGFDaGFubmVsKG5hbWUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICBfdGhpcy5jaGFubmVsc19kZXNjW25hbWVdID0gb3B0aW9ucztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmNoYW5uZWxfY29sbGVjdGlvbi5zZXRMb2NhbChfdGhpcy5jaGFubmVsc19kZXNjKTtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY29ubmVjdCgpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHBlZXJcbiAgICAgKiBAbWV0aG9kIGNsb3NlXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wZWVyX2Nvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzdHJlYW0gZnJvbSB0aGUgcGVlci4gSGFzIHRvIGJlIHNlbnQgYnkgdGhlIHJlbW90ZSBwZWVyIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWU9J3N0cmVhbSddIE5hbWUgb2YgdGhlIHN0cmVhbVxuICAgICAqIEByZXR1cm4ge1Byb21pc2UgLT4gcnRjLlN0cmVhbX0gUHJvbWlzZSBvZiB0aGUgc3RyZWFtXG4gICAgICovXG5cbiAgICBSZW1vdGVQZWVyLnByb3RvdHlwZS5zdHJlYW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLkRFRkFVTFRfU1RSRUFNO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtX2NvbGxlY3Rpb24uZ2V0KG5hbWUpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBsb2NhbCBzdHJlYW0gdG8gYmUgc2VudCB0byB0aGlzIHJlbW90ZSBwZWVyXG4gICAgI1xuICAgICAqIElmIHlvdSB1c2UgdGhpcyBtZXRob2QgeW91IGhhdmUgdG8gc2V0IGBhdXRvX2Nvbm5lY3RgIHRvIGBmYWxzZWAgaW4gdGhlIG9wdGlvbnMgb2JqZWN0IGFuZCBjYWxsIGBjb25uZWN0KClgIG1hbnVhbGx5IG9uIGFsbCByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgICAqIEBtZXRob2QgYWRkU3RyZWFtXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdzdHJlYW0nXSBOYW1lIG9mIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0ge1Byb21pc2UgLT4gcnRjLlN0cmVhbSB8IHJ0Yy5TdHJlYW0gfCBPYmplY3R9IHN0cmVhbSBUaGUgc3RyZWFtLCBhIHByb21pc2UgdG8gdGhlIHN0cmVhbSBvciB0aGUgY29uZmlndXJhdGlvbiB0byBjcmVhdGUgYSBzdHJlYW0gd2l0aCBgcnRjLlN0cmVhbS5jcmVhdGVTdHJlYW0oKWBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2Ugb2YgdGhlIHN0cmVhbSB3aGljaCB3YXMgYWRkZWRcbiAgICAgKi9cblxuICAgIFJlbW90ZVBlZXIucHJvdG90eXBlLmFkZFN0cmVhbSA9IGZ1bmN0aW9uKG5hbWUsIG9iaikge1xuICAgICAgdmFyIHNhdmVTdHJlYW0sIHN0cmVhbV9wO1xuICAgICAgaWYgKCEodGhpcy5vcHRpb25zLmF1dG9fY29ubmVjdCA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcIlVuYWJsZSB0byBhZGQgc3RyZWFtcyBkaXJlY3RseSB0byByZW1vdGUgcGVlcnMgd2l0aG91dCAnYXV0b19jb25uZWN0JyBvcHRpb24gc2V0IHRvICdmYWxzZSdcIik7XG4gICAgICB9XG4gICAgICBzYXZlU3RyZWFtID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHJlYW1fcCkge1xuICAgICAgICAgIF90aGlzLnByaXZhdGVfc3RyZWFtc1tuYW1lXSA9IHN0cmVhbV9wO1xuICAgICAgICAgIHJldHVybiBzdHJlYW1fcDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX1NUUkVBTTtcbiAgICAgIH1cbiAgICAgIGlmICgob2JqICE9IG51bGwgPyBvYmoudGhlbiA6IHZvaWQgMCkgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc2F2ZVN0cmVhbShvYmopO1xuICAgICAgfSBlbHNlIGlmIChvYmogaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgcmV0dXJuIHNhdmVTdHJlYW0oUHJvbWlzZS5yZXNvbHZlKG9iaikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyZWFtX3AgPSBTdHJlYW0uY3JlYXRlU3RyZWFtKG9iaik7XG4gICAgICAgIHJldHVybiBzYXZlU3RyZWFtKHN0cmVhbV9wKTtcbiAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBkYXRhIGNoYW5uZWwgdG8gdGhlIHJlbW90ZSBwZWVyLiBIYXMgdG8gYmUgYWRkZWQgYnkgbG9jYWwgYW5kIHJlbW90ZSBzaWRlIHRvIHN1Y2NlZWQuXG4gICAgICogQG1ldGhvZCBjaGFubmVsXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lPSdkYXRhJ10gTmFtZSBvZiB0aGUgZGF0YSBjaGFubmVsXG4gICAgICogQHJldHVybiB7UHJvbWlzZSAtPiBydGMuRGF0YUNoYW5uZWx9IFByb21pc2Ugb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuY2hhbm5lbCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuREVGQVVMVF9DSEFOTkVMO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbF9jb2xsZWN0aW9uLmdldChuYW1lKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgZGF0YSBjaGFubmVsIHdoaWNoIHdpbGwgYmUgbmVnb3RpYXRlZCB3aXRoIHRoaXMgcmVtb3RlIHBlZXJcbiAgICAjXG4gICAgICogSWYgeW91IHVzZSB0aGlzIG1ldGhvZCB5b3UgaGF2ZSB0byBzZXQgYGF1dG9fY29ubmVjdGAgdG8gYGZhbHNlYCBpbiB0aGUgb3B0aW9ucyBvYmplY3QgYW5kIGNhbGwgYGNvbm5lY3QoKWAgbWFudWFsbHkgb24gYWxsIHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgICogQG1ldGhvZCBhZGREYXRhQ2hhbm5lbFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZT0nZGF0YSddIE5hbWUgb2YgdGhlIGRhdGEgY2hhbm5lbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGVzYz17b3JkZXJlZDogdHJ1ZX1dIE9wdGlvbnMgcGFzc2VkIHRvIGBSVENEYXRhQ2hhbm5lbC5jcmVhdGVEYXRhQ2hhbm5lbCgpYFxuICAgICAqL1xuXG4gICAgUmVtb3RlUGVlci5wcm90b3R5cGUuYWRkRGF0YUNoYW5uZWwgPSBmdW5jdGlvbihuYW1lLCBkZXNjKSB7XG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuYXV0b19jb25uZWN0ID09PSBmYWxzZSkpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFwiVW5hYmxlIHRvIGFkZCBjaGFubmVscyBkaXJlY3RseSB0byByZW1vdGUgcGVlcnMgd2l0aG91dCAnYXV0b19jb25uZWN0JyBvcHRpb24gc2V0IHRvICdmYWxzZSdcIik7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlc2MgPSBuYW1lO1xuICAgICAgICBuYW1lID0gdGhpcy5ERUZBVUxUX0NIQU5ORUw7XG4gICAgICB9XG4gICAgICBpZiAoZGVzYyA9PSBudWxsKSB7XG4gICAgICAgIGRlc2MgPSB7XG4gICAgICAgICAgb3JkZXJlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5wcml2YXRlX2NoYW5uZWxzW25hbWVdID0gZGVzYztcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwobmFtZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBSZW1vdGVQZWVyO1xuXG4gIH0pKFBlZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRXZlbnRFbWl0dGVyLCBMb2NhbFBlZXIsIE11Y1NpZ25hbGluZywgUGVlckNvbm5lY3Rpb24sIFJlbW90ZVBlZXIsIFdlYlNvY2tldENoYW5uZWwsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cbiAgV2ViU29ja2V0Q2hhbm5lbCA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nL3dlYl9zb2NrZXRfY2hhbm5lbC5jb2ZmZWUnKS5XZWJTb2NrZXRDaGFubmVsO1xuXG4gIE11Y1NpZ25hbGluZyA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nL211Y19zaWduYWxpbmcuY29mZmVlJykuTXVjU2lnbmFsaW5nO1xuXG4gIFJlbW90ZVBlZXIgPSByZXF1aXJlKCcuL3JlbW90ZV9wZWVyLmNvZmZlZScpLlJlbW90ZVBlZXI7XG5cbiAgTG9jYWxQZWVyID0gcmVxdWlyZSgnLi9sb2NhbF9wZWVyLmNvZmZlZScpLkxvY2FsUGVlcjtcblxuICBQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vcGVlcl9jb25uZWN0aW9uLmNvZmZlZScpLlBlZXJDb25uZWN0aW9uO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEEgdmlydHVhbCByb29tIHdoaWNoIGNvbm5lY3RzIG11bHRpcGxlIFBlZXJzXG4gICAqIEBjbGFzcyBydGMuUm9vbVxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgcm9vbS4gV2lsbCBiZSBwYXNzZWQgb24gdG8gc2lnbmFsaW5nXG4gICAqIEBwYXJhbSB7cnRjLlNpZ25hbGluZyB8IFN0cmluZ30gc2lnbmFsaW5nIFRoZSBzaWduYWxpbmcgdG8gYmUgdXNlZC4gSWYgeW91IHBhc3MgYSBzdHJpbmcgaXQgd2lsbCBiZSBpbnRlcnByZXRlZCBhcyBhIHdlYnNvY2tldCBhZGRyZXNzIGFuZCBhIHBhbGF2YSBzaWduYWxpbmcgY29ubmVjdGlvbiB3aWxsIGJlIGVzdGFibGlzaGVkIHdpdGggaXQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gVmFyaW91cyBvcHRpb25zIHRvIGJlIHVzZWQgaW4gY29ubmVjdGlvbnMgY3JlYXRlZCBieSB0aGlzIHJvb21cbiAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5hdXRvX2Nvbm5lY3Q9dHJ1ZV0gV2hldGhlciByZW1vdGUgcGVlcnMgYXJlIGNvbm5lY3RlZCBhdXRvbWF0aWNhbGx5IG9yIGFuIGV4cGxpY2l0IGBSZW1vdGVQZWVyLmNvbm5lY3QoKWAgY2FsbCBpcyBuZWVkZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLnN0dW5dIFRoZSBVUkkgb2YgdGhlIFNUVU4gc2VydmVyIHRvIHVzZVxuICAgKiBAcGFyYW0ge3J0Yy5Mb2NhbFBlZXJ9IFtvcHRpb25zLmxvY2FsXSBUaGUgbG9jYWwgdXNlclxuICAgKi9cblxuICBleHBvcnRzLlJvb20gPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChSb29tLCBzdXBlckNsYXNzKTtcblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgcGVlciBpcyBlbmNvdW50ZXJlZCBpbiB0aGUgcm9vbS4gRmlyZXMgb24gbmV3IHJlbW90ZSBwZWVycyBhZnRlciBqb2luaW5nIGFuZCBmb3IgYWxsIHBlZXJzIGluIHRoZSByb29tIHdoZW4gam9pbmluZy5cbiAgICAgKiBAZXZlbnQgcGVlcl9qb3BpbmVkXG4gICAgICogQHBhcmFtIHtydGMuUmVtb3RlUGVlcn0gcGVlciBUaGUgbmV3IHBlZXJcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHJvb20gd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIFJvb20oc2lnbmFsaW5nLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY2hhbm5lbDtcbiAgICAgIHRoaXMuc2lnbmFsaW5nID0gc2lnbmFsaW5nO1xuICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyAhPSBudWxsID8gb3B0aW9ucyA6IHt9O1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLnNpZ25hbGluZyA9PT0gJ3N0cmluZycgfHwgdGhpcy5zaWduYWxpbmcgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgY2hhbm5lbCA9IG5ldyBXZWJTb2NrZXRDaGFubmVsKHRoaXMuc2lnbmFsaW5nKTtcbiAgICAgICAgdGhpcy5zaWduYWxpbmcgPSBuZXcgTXVjU2lnbmFsaW5nKGNoYW5uZWwpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbCA9IHRoaXMub3B0aW9ucy5sb2NhbCB8fCBuZXcgTG9jYWxQZWVyKCk7XG4gICAgICB0aGlzLnNpZ25hbGluZy5vbigncGVlcl9qb2luZWQnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHNpZ25hbGluZ19wZWVyKSB7XG4gICAgICAgICAgdmFyIHBjLCBwZWVyO1xuICAgICAgICAgIHBjID0gbmV3IFBlZXJDb25uZWN0aW9uKHNpZ25hbGluZ19wZWVyLmZpcnN0LCBfdGhpcy5vcHRpb25zKTtcbiAgICAgICAgICBwZWVyID0gbmV3IFJlbW90ZVBlZXIocGMsIHNpZ25hbGluZ19wZWVyLCBfdGhpcy5sb2NhbCwgX3RoaXMub3B0aW9ucyk7XG4gICAgICAgICAgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdID0gcGVlcjtcbiAgICAgICAgICBfdGhpcy5lbWl0KCdwZWVyX2pvaW5lZCcsIHBlZXIpO1xuICAgICAgICAgIHJldHVybiBwZWVyLm9uKCdjbG9zZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWxldGUgX3RoaXMucGVlcnNbc2lnbmFsaW5nX3BlZXIuaWRdO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5wZWVycyA9IHt9O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogSm9pbnMgdGhlIHJvb20uIEluaXRpYXRlcyBjb25uZWN0aW9uIHRvIHNpZ25hbGluZyBzZXJ2ZXIgaWYgbm90IGRvbmUgYmVmb3JlLlxuICAgICAqIEBtZXRob2Qgam9pblxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSB3aGljaCB3aWxsIGJlIHJlc29sdmVkIG9uY2UgdGhlIHJvb20gd2FzIGpvaW5lZFxuICAgICAqL1xuXG4gICAgUm9vbS5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuam9pbl9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5qb2luX3AgPSB0aGlzLnNpZ25hbGluZy5jb25uZWN0KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5qb2luX3A7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTGVhdmVzIHRoZSByb29tIGFuZCBjbG9zZXMgYWxsIGVzdGFibGlzaGVkIHBlZXIgY29ubmVjdGlvbnNcbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5sZWF2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2lnbmFsaW5nLmxlYXZlKCk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xlYW5zIHVwIGFsbCByZXNvdXJjZXMgdXNlZCBieSB0aGUgcm9vbS5cbiAgICAgKiBAbWV0aG9kIGxlYXZlXG4gICAgICovXG5cbiAgICBSb29tLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zaWduYWxpbmcubGVhdmUoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFJvb207XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIERlZmVycmVkLCBFdmVudEVtaXR0ZXIsIFNpZ25hbGluZywgU2lnbmFsaW5nUGVlciwgcmVmLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9pbnRlcm5hbC9wcm9taXNlJykuRGVmZXJyZWQ7XG5cbiAgcmVmID0gcmVxdWlyZSgnLi9zaWduYWxpbmcnKSwgU2lnbmFsaW5nID0gcmVmLlNpZ25hbGluZywgU2lnbmFsaW5nUGVlciA9IHJlZi5TaWduYWxpbmdQZWVyO1xuXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICovXG5cblxuICAvKipcbiAgICogU2lnbmFsaW5nIHBlZXIgZm9yIG11bHRpIHVzZXIgY2hhdHMuXG4gICNcbiAgICogRm9yIGEgZGV0YWlsZWQgZGVzY3JpcHRpb24gb2YgdGhlIHNpZ25hbGluZyBwcm90b2NvbCBzZWUgYHJ0Yy5zaWduYWxpbmcuTXVjU2lnbmFsaW5nYFxuICAjXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nUGVlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5NdWNTaWduYWxpbmdQZWVyXG4gICNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7cnRjLnNpZ25hbGluZy5DaGFubmVsfSBjaGFubmVsIFRoZSBjaGFubmVsIHRvIHRoZSBzaWdhbmxpbmcgc2VydmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwZWVyX2lkIFRoZSBpZCBvZiB0aGUgcmVtb3RlIHBlZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0YXR1cyBUaGUgc3RhdHVzIG9mIHRoZSByZW1vdGUgcGVlclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGZpcnN0IFdoZXRoZXIgdGhlIGxvY2FsIHBlZXIgd2FzIGluIHRoZSByb29tIGJlZm9yZSB0aGUgcmVtb3RlIHBlZXJcbiAgICovXG5cbiAgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoTXVjU2lnbmFsaW5nUGVlciwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBNdWNTaWduYWxpbmdQZWVyKGNoYW5uZWwsIHBlZXJfaWQxLCBzdGF0dXMxLCBmaXJzdCkge1xuICAgICAgdmFyIHJlY3ZfbXNnO1xuICAgICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICAgIHRoaXMucGVlcl9pZCA9IHBlZXJfaWQxO1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXMxO1xuICAgICAgdGhpcy5maXJzdCA9IGZpcnN0O1xuICAgICAgcmVjdl9tc2cgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICBpZiAoZGF0YS5wZWVyICE9PSBfdGhpcy5wZWVyX2lkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChkYXRhLnR5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZnJvbSc6XG4gICAgICAgICAgICAgIGlmICgoZGF0YS5ldmVudCA9PSBudWxsKSB8fCAoZGF0YS5kYXRhID09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX2xlZnQnOlxuICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdsZWZ0Jyk7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5jaGFubmVsLnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgICAgICAgY2FzZSAncGVlcl9zdGF0dXMnOlxuICAgICAgICAgICAgICBfdGhpcy5zdGF0dXMgPSBkYXRhLnN0YXR1cztcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgX3RoaXMuc3RhdHVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignbWVzc2FnZScsIHJlY3ZfbXNnKTtcbiAgICB9XG5cbiAgICBNdWNTaWduYWxpbmdQZWVyLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIGlmIChkYXRhID09IG51bGwpIHtcbiAgICAgICAgZGF0YSA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgdHlwZTogJ3RvJyxcbiAgICAgICAgcGVlcjogdGhpcy5wZWVyX2lkLFxuICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgIGRhdGE6IGRhdGFcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gTXVjU2lnbmFsaW5nUGVlcjtcblxuICB9KShTaWduYWxpbmdQZWVyKTtcblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgZm9yIG11bHRpIHVzZXIgY2hhdHNcbiAgI1xuICAgKiBUaGUgZm9sbG93aW5nIG1lc3NhZ2VzIGFyZSBzZW50IHRvIHRoZSBzZXJ2ZXI6XG4gICNcbiAgICogICAgIC8vIGpvaW4gdGhlIHJvb20uIGhhcyB0byBiZSBzZW50IGJlZm9yZSBhbnkgb3RoZXIgbWVzc2FnZS5cbiAgICogICAgIC8vIHJlc3BvbnNlIHdpbGwgYmUgJ2pvaW5lZCcgb24gc3VjY2Vzc1xuICAgKiAgICAgLy8gb3RoZXIgcGVlcnMgaW4gdGhlIHJvb20gd2lsbCBnZXQgJ3BlZXJfam9pbmVkJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJqb2luXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gbGVhdmUgdGhlIHJvb20uIHNlcnZlciB3aWxsIGNsb3NlIHRoZSBjb25uZWN0aW5vLlxuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJsZWF2ZVwiXG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHVwZGF0ZSBzdGF0dXMgb2JqZWN0XG4gICAqICAgICAvLyBvdGhlciBwZWVycyB3aWxsIGdldCAncGVlcl9zdGF0dXMnXG4gICAqICAgICB7XG4gICAqICAgICAgIFwidHlwZVwiOiBcInN0YXR1c1wiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIHNlbmQgbWVzc2FnZSB0byBhIHBlZXIuIHdpbGwgYmUgcmVjZWl2ZWQgYXMgJ3RvJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJ0b1wiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCIsXG4gICAqICAgICAgIFwiZXZlbnRcIjogXCJldmVudF9pZFwiLFxuICAgKiAgICAgICBcImRhdGFcIjogeyAuLiBjdXN0b20gZGF0YSAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogVGhlIGZvbGxvd2luZyBtZXNzYWdlcyBhcmUgcmVjZWl2ZWQgZm9ybSB0aGUgc2VydmVyOlxuICAjXG4gICAqICAgICAvLyBqb2luZWQgdGhlIHJvb20uIGlzIHRoZSByZXNwb25zZSB0byAnam9pbidcbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwiam9pbmVkXCIsXG4gICAqICAgICAgIFwicGVlcnNcIjoge1xuICAgKiAgICAgICAgIFwicGVlcl9pZFwiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICAgIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gYW5vdGhlciBwZWVyIGpvaW5lZCB0aGUgcm9vbS5cbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwicGVlcl9qb2luZWRcIixcbiAgICogICAgICAgXCJwZWVyXCI6IFwicGVlcl9pZFwiLFxuICAgKiAgICAgICBcInN0YXR1c1wiOiB7IC4uIHN0YXR1cyAuLiB9XG4gICAqICAgICB9XG4gICNcbiAgICogICAgIC8vIGFub3N0aGVyIHBlZXIgdXBkYXRlZCBpdHMgc3RhdHVzIG9iamVjdCB1c2luZyAnc3RhdHVzJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJwZWVyX3N0YXR1c1wiLFxuICAgKiAgICAgICBcInBlZXJcIjogXCJwZWVyX2lkXCIsXG4gICAqICAgICAgIFwic3RhdHVzXCI6IHsgLi4gc3RhdHVzIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiAgICAgLy8gYW5vdGhlciBwZWVyIGxlZnQgdGhlIHJvb21cbiAgICogICAgIHtcbiAgICogICAgICAgXCJ0eXBlXCI6IFwicGVlcl9sZWZ0XCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIlxuICAgKiAgICAgfVxuICAjXG4gICAqICAgICAvLyBtZXNzYWdlIGZyb20gYW5vdGhlciBwZWVyIHNlbnQgYnkgJ3RvJ1xuICAgKiAgICAge1xuICAgKiAgICAgICBcInR5cGVcIjogXCJmcm9tXCIsXG4gICAqICAgICAgIFwicGVlclwiOiBcInBlZXJfaWRcIixcbiAgICogICAgICAgXCJldmVudFwiOiBcImV2ZW50X2lkXCIsXG4gICAqICAgICAgIFwiZGF0YVwiOiB7IC4uIGN1c3RvbSBkYXRhIC4uIH1cbiAgICogICAgIH1cbiAgI1xuICAgKiBUaGUgbWVzc2FnZXMgdHJhbnNtaXR0ZWQgaW4gdGhlIGB0b2AvYGZyb21gIG1lc3NhZ2VzIGFyZSBlbWl0dGVkIGFzIGV2ZW50cyBpbiBgTXVjU2lnbmFsaW5nUGVlcmBcbiAgI1xuICAgKiBAZXh0ZW5kcyBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1xuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5NdWNTaWduYWxpbmdcbiAgI1xuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtydGMuc2lnbmFsaW5nLkNoYW5uZWx9IGNoYW5uZWwgVGhlIGNoYW5uZWwgdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICovXG5cbiAgZXhwb3J0cy5NdWNTaWduYWxpbmcgPSAoZnVuY3Rpb24oc3VwZXJDbGFzcykge1xuICAgIGV4dGVuZChNdWNTaWduYWxpbmcsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gTXVjU2lnbmFsaW5nKGNoYW5uZWwpIHtcbiAgICAgIHZhciBqb2luX2Q7XG4gICAgICB0aGlzLmNoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgdGhpcy5zdGF0dXMgPSB7fTtcbiAgICAgIGpvaW5fZCA9IG5ldyBEZWZlcnJlZCgpO1xuICAgICAgdGhpcy5qb2luX3AgPSBqb2luX2QucHJvbWlzZTtcbiAgICAgIHRoaXMuY2hhbm5lbC5vbignY2xvc2VkJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ21lc3NhZ2UnLCAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICB2YXIgcGVlciwgcGVlcl9pZCwgcmVmMSwgc3RhdHVzO1xuICAgICAgICAgIGlmIChkYXRhLnR5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnam9pbmVkJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlcnMgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZWYxID0gZGF0YS5wZWVycztcbiAgICAgICAgICAgICAgZm9yIChwZWVyX2lkIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMgPSByZWYxW3BlZXJfaWRdO1xuICAgICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5NdWNTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIHBlZXJfaWQsIHN0YXR1cywgZmFsc2UpO1xuICAgICAgICAgICAgICAgIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGpvaW5fZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICBjYXNlICdwZWVyX2pvaW5lZCc6XG4gICAgICAgICAgICAgIGlmIChkYXRhLnBlZXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuTXVjU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBkYXRhLnBlZXIsIGRhdGEuc3RhdHVzLCB0cnVlKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSB0aGlzLmNoYW5uZWwuY29ubmVjdCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgICAgICAgIHR5cGU6ICdqb2luJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiBfdGhpcy5zdGF0dXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKS50aGVuKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5qb2luX2Q7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBNdWNTaWduYWxpbmcucHJvdG90eXBlLnNldFN0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXM7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3ApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2hhbm5lbC5zZW5kKHtcbiAgICAgICAgICAgIHR5cGU6ICdzdGF0dXMnLFxuICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE11Y1NpZ25hbGluZy5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIHR5cGU6ICdsZWF2ZSdcbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gTXVjU2lnbmFsaW5nO1xuXG4gIH0pKFNpZ25hbGluZyk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBEZWZlcnJlZCwgU2lnbmFsaW5nLCBTaWduYWxpbmdQZWVyLCByZWYsXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChoYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9LFxuICAgIGhhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcblxuICBEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL2ludGVybmFsL3Byb21pc2UnKS5EZWZlcnJlZDtcblxuICByZWYgPSByZXF1aXJlKCcuL3NpZ25hbGluZycpLCBTaWduYWxpbmcgPSByZWYuU2lnbmFsaW5nLCBTaWduYWxpbmdQZWVyID0gcmVmLlNpZ25hbGluZ1BlZXI7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGMuc2lnbmFsaW5nXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFNpZ25hbGluZyBwZWVyIGNvbXBhdGlibGUgd2l0aCB0aGUgZnJhbWluZyBvZiBwYWxhdmEgc2lnbmFsaW5nXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLlBhbGF2YVNpZ25hbGluZ1BlZXJcbiAgICogQGV4dGVuZHMgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFBhbGF2YVNpZ25hbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gUGFsYXZhU2lnbmFsaW5nUGVlcihjaGFubmVsLCBpZCwgc3RhdHVzMSwgZmlyc3QpIHtcbiAgICAgIHZhciByZWN2X21zZztcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLmlkID0gaWQ7XG4gICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1czE7XG4gICAgICB0aGlzLmZpcnN0ID0gZmlyc3Q7XG4gICAgICByZWN2X21zZyA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLnNlbmRlcl9pZCAhPT0gX3RoaXMuaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRhdGEuZXZlbnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgX3RoaXMuc2VuZCgnZXJyb3InLCBcIkludmFsaWQgbWVzc2FnZVwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgcmVjdl9tc2cpO1xuICAgICAgdGhpcy5vbigncGVlcl91cGRhdGVkX3N0YXR1cycsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3N0YXR1c19jaGFuZ2VkJywgc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHRoaXMub24oJ3BlZXJfbGVmdCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX3RoaXMuZW1pdCgnY2xvc2VkJyk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2UnLCByZWN2X21zZyk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSk7XG4gICAgfVxuXG4gICAgUGFsYXZhU2lnbmFsaW5nUGVlci5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgIGV2ZW50OiAnc2VuZF90b19wZWVyJyxcbiAgICAgICAgcGVlcl9pZDogdGhpcy5pZCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gUGFsYXZhU2lnbmFsaW5nUGVlcjtcblxuICB9KShTaWduYWxpbmdQZWVyKTtcblxuXG4gIC8qKlxuICAgKiBTaWduYWxpbmcgaW1wbGVtZW50YXRpb24gY29tcGF0aWJsZSB3aXRoIHRoZSBmcmFtaW5nIG9mIHBhbGF2YSBzaWduYWxpbmdcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuUGFsYXZhU2lnbmFsaW5nXG4gICAqIEBleHRlbmRzIHJ0Yy5zaWduYWxpbmcuU2lnbmFsaW5nXG4gICAqL1xuXG4gIGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoUGFsYXZhU2lnbmFsaW5nLCBzdXBlckNsYXNzKTtcblxuICAgIGZ1bmN0aW9uIFBhbGF2YVNpZ25hbGluZyhjaGFubmVsLCByb29tMSwgc3RhdHVzMSkge1xuICAgICAgdmFyIGpvaW5fZDtcbiAgICAgIHRoaXMuY2hhbm5lbCA9IGNoYW5uZWw7XG4gICAgICB0aGlzLnJvb20gPSByb29tMTtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzMTtcbiAgICAgIHRoaXMucGVlcnMgPSB7fTtcbiAgICAgIHRoaXMuam9pbmVkID0gZmFsc2U7XG4gICAgICBqb2luX2QgPSBuZXcgRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuam9pbl9wID0gam9pbl9kLnByb21pc2U7XG4gICAgICB0aGlzLmNoYW5uZWwub24oJ2Nsb3NlZCcsIChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ2Nsb3NlZCcpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgdGhpcy5jaGFubmVsLm9uKCdtZXNzYWdlJywgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgdmFyIGksIHBlZXIsIHJlZjE7XG4gICAgICAgICAgaWYgKGRhdGEuZXZlbnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzd2l0Y2ggKGRhdGEuZXZlbnQpIHtcbiAgICAgICAgICAgIGNhc2UgJ2pvaW5lZF9yb29tJzpcbiAgICAgICAgICAgICAgaWYgKChkYXRhLnBlZXJzID09IG51bGwpIHx8IChkYXRhLm93bl9pZCA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZWYxID0gZGF0YS5wZWVycztcbiAgICAgICAgICAgICAgZm9yIChpIGluIHJlZjEpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gcmVmMVtpXTtcbiAgICAgICAgICAgICAgICBwZWVyID0gbmV3IGV4cG9ydHMuUGFsYXZhU2lnbmFsaW5nUGVlcihfdGhpcy5jaGFubmVsLCBkYXRhLnBlZXJfaWQsIGRhdGEuc3RhdHVzLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgX3RoaXMucGVlcnNbZGF0YS5wZWVyX2lkXSA9IHBlZXI7XG4gICAgICAgICAgICAgICAgX3RoaXMuZW1pdCgncGVlcl9qb2luZWQnLCBwZWVyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gam9pbl9kLnJlc29sdmUoKTtcbiAgICAgICAgICAgIGNhc2UgJ25ld19wZWVyJzpcbiAgICAgICAgICAgICAgaWYgKGRhdGEucGVlcl9pZCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBlZXIgPSBuZXcgZXhwb3J0cy5QYWxhdmFTaWduYWxpbmdQZWVyKF90aGlzLmNoYW5uZWwsIGRhdGEucGVlcl9pZCwgZGF0YS5zdGF0dXMsIHRydWUpO1xuICAgICAgICAgICAgICBfdGhpcy5wZWVyc1tkYXRhLnBlZXJdID0gcGVlcjtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVtaXQoJ3BlZXJfam9pbmVkJywgcGVlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgIH1cblxuICAgIFBhbGF2YVNpZ25hbGluZy5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdF9wID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0X3AgPSB0aGlzLmNoYW5uZWwuY29ubmVjdCgpLnRoZW4oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmNoYW5uZWwuc2VuZCh7XG4gICAgICAgICAgICAgIGV2ZW50OiAnam9pbl9yb29tJyxcbiAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbSxcbiAgICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3RfcDtcbiAgICB9O1xuXG4gICAgUGFsYXZhU2lnbmFsaW5nLnByb3RvdHlwZS5zZXRfc3RhdHVzID0gZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGFubmVsLnNlbmQoe1xuICAgICAgICBldmVudDogJ3VwZGF0ZV9zdGF0dXMnLFxuICAgICAgICBzdGF0dXM6IHN0YXR1c1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIFBhbGF2YVNpZ25hbGluZy5wcm90b3R5cGUubGVhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoYW5uZWwuY2xvc2UoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBhbGF2YVNpZ25hbGluZztcblxuICB9KShTaWduYWxpbmcpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjkuMlxuKGZ1bmN0aW9uKCkge1xuICB2YXIgRXZlbnRFbWl0dGVyLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHk7XG5cbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5cbiAgLyoqXG4gICAqIEBtb2R1bGUgcnRjLnNpZ25hbGluZ1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBDb25jZXB0IG9mIGEgY2xhc3MgaW1wbGVtZW50aW5nIHNpZ25hbGluZy4gTWlnaHQgdXNlIGEgYHJ0Yy5zaWduYWxpbmcuQ2hhbm5lbGAgdG8gYWJzdHJhY3QgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNlcnZlci5cbiAgI1xuICAgKiBZb3UgZG8gbm90IGhhdmUgdG8gZXh0ZW5kIHRoaXMgY2xhYXNzLCBqdXN0IGltcGxlbWVudCB0aGUgZnVuY3Rpb25hbGl0eS5cbiAgI1xuICAgKiBAZXh0ZW5kcyBldmVudHMuRXZlbnRFbWl0dGVyXG4gICAqIEBjbGFzcyBydGMuc2lnbmFsaW5nLlNpZ25hbGluZ1xuICAgKi9cblxuICBleHBvcnRzLlNpZ25hbGluZyA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFNpZ25hbGluZywgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBTaWduYWxpbmcoKSB7XG4gICAgICByZXR1cm4gU2lnbmFsaW5nLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQSBuZXcgcGVlciBqb2luZWQgdGhlIHJvb21cbiAgICAgKiBAZXZlbnQgcGVlcl9qb2luZWRcbiAgICAgKiBAcGFyYW0ge3J0Yy5zaWduYWxpbmcuU2lnbmFsaW5nUGVlcn0gcGVlciBUaGUgbmV3IHBlZXJcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXIgd2FzIGNsb3NlZFxuICAgICAqIEBldmVudCBjbG9zZWRcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogRXN0YWJsaXNoZXMgdGhlIGNvbm5lY3Rpb24gd2l0aCB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2QgY29ubmVjdFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiB0aGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZFxuICAgICAqL1xuXG4gICAgU2lnbmFsaW5nLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIHRoZSBjb25uZWN0aW9uIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQG1ldGhvZCBjbG9zZVxuICAgICAqL1xuXG4gICAgU2lnbmFsaW5nLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsIHN0YXR1cyBvYmplY3QgYW5kIGJyb2FkY2FzdHMgdGhlIGNoYW5nZSB0byB0aGUgcGVlcnNcbiAgICAgKiBAbWV0aG9kIHNldFN0YXR1c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogTmV3IHN0YXR1cyBvYmplY3RcbiAgICAgKi9cblxuICAgIFNpZ25hbGluZy5wcm90b3R5cGUuc2V0U3RhdHVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBTaWduYWxpbmc7XG5cbiAgfSkoRXZlbnRFbWl0dGVyKTtcblxuXG4gIC8qKlxuICAgKiBDb25jZXB0IG9mIGEgY2xhc3MgaW1wbGVtZW50aW5nIGEgc2lnbmFsaW5nIGNvbm5lY3Rpb24gdG8gYSBwZWVyLlxuICAjXG4gICAqIFlvdSBkbyBub3QgaGF2ZSB0byBleHRlbmQgdGhpcyBjbGFzcywganVzdCBpbXBsZW1lbnQgdGhlIGZ1bmN0aW9uYWxpdHkuXG4gICNcbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5TaWduYWxpbmdQZWVyXG4gICAqL1xuXG4gIGV4cG9ydHMuU2lnbmFsaW5nUGVlciA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKFNpZ25hbGluZ1BlZXIsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gU2lnbmFsaW5nUGVlcigpIHtcbiAgICAgIHJldHVybiBTaWduYWxpbmdQZWVyLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbW90ZSBwZWVyIGxlZnQgdGhlIHJvb21cbiAgICAgKiBAZXZlbnQgbGVmdFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBSZWNlaXZlZCBhIG1lc3NhZ2UgZnJvbSB0aGUgcmVtb3RlIHBlZXJcbiAgICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBJRCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcGFyYW0ge09iZWpjdH0gZGF0YSBQYXlsb2FkIG9mIHRoZSBldmVudFxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9iamVjdCBvZiB0aGUgcmVtb3RlIHBlZXIgd2FzIHVwZGF0ZWRcbiAgICAgKiBAZXZlbnQgc3RhdHVzX2NoYW5nZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIFRoZSBuZXcgc3RhdHVzXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGF0dXMgb2JqZWN0IG9mIHRoZSByZW1vdGUgcGVlclxuICAgICAqIEBwcm9wZXJ0eSBzdGF0dXNcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgbG9jYWwgdXNlciB3YXMgaW4gdGhlIHJvb20gYmVmb3JlIHRoZSByZW1vdGUgdXNlciAodXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggcGVlciB3aWxsIGluaXRpYXRlIHRoZSBjb25uZWN0aW9uKVxuICAgICAqIEBwcm9wZXJ0eSBmaXJzdFxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogU2VuZHMgdGhlIGV2ZW50IHdpdGggdGhlIGdpdmVuIHBheWxvYWQgdG8gdGhlIHJlbW90ZSBwZWVyXG4gICAgICogQG1ldGhvZCBzZW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IFRoZSBpZCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBUaGUgcGF5bG9hZCBvZiB0aGUgZXZlbnRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIHdpbGwgYmUgcmVzb2x2ZWQgb25jZSB0aGUgbWVzc2FnZSBpcyBzZW50XG4gICAgICovXG5cbiAgICBTaWduYWxpbmdQZWVyLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIGlmIChkYXRhID09IG51bGwpIHtcbiAgICAgICAgZGF0YSA9IHt9O1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU2lnbmFsaW5nUGVlcjtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG5cbiAgLyoqXG4gICAqIENvbmNlcHQgb2YgYSBjbGFzcyBpbXBsZW1lbnRpbmcgYSBzaWduYWxpbmcgY2hhbm5lbC4gTWlnaHQgYmUgdXNlZCBieSBzaWduYWxpbmcgaW1wbGVtZW50YXRpb25zIHRvIGNvbm5lY3QgdG8gYSBzaWduYWxpbmcgc2VydmVyLlxuICAjXG4gICAqIFlvdSBkbyBub3QgaGF2ZSB0byBleHRlbmQgdGhpcyBjbGFzcywganVzdCBpbXBsZW1lbnQgdGhlIGZ1bmN0aW9uYWxpdHkuXG4gICNcbiAgICogQGV4dGVuZHMgZXZlbnRzLkV2ZW50RW1pdHRlclxuICAgKiBAY2xhc3MgcnRjLnNpZ25hbGluZy5DaGFubmVsXG4gICAqL1xuXG4gIGV4cG9ydHMuQ2hhbm5lbCA9IChmdW5jdGlvbihzdXBlckNsYXNzKSB7XG4gICAgZXh0ZW5kKENoYW5uZWwsIHN1cGVyQ2xhc3MpO1xuXG4gICAgZnVuY3Rpb24gQ2hhbm5lbCgpIHtcbiAgICAgIHJldHVybiBDaGFubmVsLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQSBtZXNzYWdlIHdhcyByZWNlaXZlZCBmcm9tIHRoZSBzaWduYWxpbmcgc2VydmVyXG4gICAgICogQGV2ZW50IG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSByZWNlaXZlZCBtZXNzYWdlXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb25uZWN0aW9uIHRvIHRoZSBzaWduYWxpbmcgc2VydmVyIHdhcyBjbG9zZWRcbiAgICAgKiBAZXZlbnQgY2xvc2VkXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIEVzdGFibGlzaGVzIHRoZSBjb25uZWN0aW9uIHdpdGggdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIGNvbm5lY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gdGhlIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWRcbiAgICAgKi9cblxuICAgIENoYW5uZWwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhIG1lc3NhZ2UgdG8gdGhlIHNpZ25hbGluZyBzZXJ2ZXJcbiAgICAgKiBAbWV0aG9kIHNlbmRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSBtZXNzYWdlIHRvIHNlbmRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBQcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gdGhlIG1lc3NhZ2UgaXMgc2VudFxuICAgICAqL1xuXG4gICAgQ2hhbm5lbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiB0byB0aGUgc2lnbmFsaW5nIHNlcnZlclxuICAgICAqIEBtZXRob2QgY2xvc2VcbiAgICAgKi9cblxuICAgIENoYW5uZWwucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfTtcblxuICAgIHJldHVybiBDaGFubmVsO1xuXG4gIH0pKEV2ZW50RW1pdHRlcik7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBDaGFubmVsLCBQcm9taXNlLFxuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoaGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfSxcbiAgICBoYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgc2xpY2UgPSBbXS5zbGljZTtcblxuICBQcm9taXNlID0gcmVxdWlyZSgnLi4vaW50ZXJuYWwvcHJvbWlzZScpLlByb21pc2U7XG5cbiAgQ2hhbm5lbCA9IHJlcXVpcmUoJy4vc2lnbmFsaW5nJykuQ2hhbm5lbDtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Yy5zaWduYWxpbmdcbiAgICovXG5cblxuICAvKipcbiAgICogQGNsYXNzIHJ0Yy5zaWduYWxpbmcuV2ViU29ja2V0Q2hhbm5lbFxuICAgKiBAZXh0ZW5kcyBydGMuc2lnbmFsaW5nLkNoYW5uZWxcbiAgICovXG5cbiAgZXhwb3J0cy5XZWJTb2NrZXRDaGFubmVsID0gKGZ1bmN0aW9uKHN1cGVyQ2xhc3MpIHtcbiAgICBleHRlbmQoV2ViU29ja2V0Q2hhbm5lbCwgc3VwZXJDbGFzcyk7XG5cbiAgICBmdW5jdGlvbiBXZWJTb2NrZXRDaGFubmVsKCkge1xuICAgICAgdmFyIGFkZHJlc3MsIGksIGxlbiwgcGFydCwgcGFydHM7XG4gICAgICBhZGRyZXNzID0gYXJndW1lbnRzWzBdLCBwYXJ0cyA9IDIgPD0gYXJndW1lbnRzLmxlbmd0aCA/IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSA6IFtdO1xuICAgICAgdGhpcy5hZGRyZXNzID0gYWRkcmVzcztcbiAgICAgIGlmIChwYXJ0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLmFkZHJlc3MuZW5kc1dpdGgoJy8nKSkge1xuICAgICAgICAgIHRoaXMuYWRkcmVzcyA9IHRoaXMuYWRkcmVzcy5zdWJzdHIoMCwgdGhpcy5hZGRyZXNzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHBhcnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICAgIHRoaXMuYWRkcmVzcyArPSAnLycgKyBlbmNvZGVVcmlDb21wb25lbnQocGFydCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBXZWJTb2NrZXRDaGFubmVsLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0X3AgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbm5lY3RfcCA9IG5ldyBQcm9taXNlKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHZhciBzb2NrZXQ7XG4gICAgICAgICAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KF90aGlzLmFkZHJlc3MpO1xuICAgICAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBfdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc29ja2V0Lm9uZXJyb3IgPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgZGVsZXRlIF90aGlzLnNvY2tldDtcbiAgICAgICAgICAgICAgX3RoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcihcIlVuYWJsZSB0byBjb25uZWN0IHRvIHNvY2tldFwiKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICAgIHZhciBkYXRhO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbWl0KCdlcnJvcicsIFwiVW5hYmxlIHRvIHBhcnNlIGluY29taW5nIG1lc3NhZ2VcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdtZXNzYWdlJywgZGF0YSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHJldHVybiBfdGhpcy5lbWl0KCdjbG9zZWQnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdF9wO1xuICAgIH07XG5cbiAgICBXZWJTb2NrZXRDaGFubmVsLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICB2YXIgZXJyO1xuICAgICAgaWYgKHRoaXMuc29ja2V0ICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KG1zZykpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICAgICAgZXJyID0gX2Vycm9yO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiVHJ5aW5nIHRvIHNlbmQgb24gV2ViU29ja2V0IHdpdGhvdXQgYmVpbmcgY29ubmVjdGVkXCIpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgV2ViU29ja2V0Q2hhbm5lbC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICBpZiAodGhpcy5zb2NrZXQgIT0gbnVsbCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMuc29ja2V0LmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgICAgICBlcnIgPSBfZXJyb3I7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJUcnlpbmcgdG8gY2xvc2UgV2ViU29ja2V0IHdpdGhvdXQgYmVpbmcgY29ubmVjdGVkXCIpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIFdlYlNvY2tldENoYW5uZWw7XG5cbiAgfSkoQ2hhbm5lbCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIvLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuOS4yXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBjb21wYXQ7XG5cbiAgY29tcGF0ID0gcmVxdWlyZSgnLi9jb21wYXQnKS5jb21wYXQ7XG5cblxuICAvKipcbiAgICogQG1vZHVsZSBydGNcbiAgICovXG5cblxuICAvKipcbiAgICogQSB3cmFwcGVyIGFyb3VuZCBhbiBIVE1MNSBNZWRpYVN0cmVhbVxuICAgKiBAY2xhc3MgcnRjLlN0cmVhbVxuICAjXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JUQ0RhdGFTdHJlYW19IHN0cmVhbSBUaGUgbmF0aXZlIHN0cmVhbVxuICAgKi9cblxuICBleHBvcnRzLlN0cmVhbSA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBTdHJlYW0oc3RyZWFtMSkge1xuICAgICAgdGhpcy5zdHJlYW0gPSBzdHJlYW0xO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBpZCBvZiB0aGUgc3RyZWFtLiBUaGlzIGlzIG5laXRoZXIgdXNlciBkZWZpbmVkIG5vciBodW1hbiByZWFkYWJsZS5cbiAgICAgKiBAbWV0aG9kIGlkXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBUaGUgaWQgb2YgdGhlIHVuZGVybHlpbmcgc3RyZWFtXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLmlkID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zdHJlYW0uaWQ7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHN0cmVhbSBoYXMgYW55IHRyYWNrcyBvZiB0aGUgZ2l2ZW4gdHlwZVxuICAgICAqIEBtZXRob2QgaGFzVHJhY2tzXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2JvdGgnXSBUaGUgdHlwZSBvZiB0cmFjayB0byBjaGVjayBmb3JcbiAgICAgKiBAcmV0dXJuIHtOdW1iZXJ9IFRoZSBhbW91bnQgb2YgdHJhY2tzIG9mIHRoZSBnaXZlbiB0eXBlXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLmhhc1RyYWNrcyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFRyYWNrcyh0eXBlKS5sZW5ndGg7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdHJhY2tzIG9mIHRoZSBnaXZlbiB0eXBlXG4gICAgICogQG1ldGhvZCBnZXRUcmFja3NcbiAgICAgKiBAcGFyYW0geydhdWRpbycgfCAndmlkZW8nIHwgJ2JvdGgnfSBbdHlwZT0nYm90aCddIFRoZSB0eXBlIG9mIHRyYWNrcyB0byBnZXRcbiAgICAgKiBAcmV0dXJuIHtBcnJheX0gQW4gQXJyYXkgb2YgdGhlIHRyYWNrc1xuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS5nZXRUcmFja3MgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICB0eXBlID0gdHlwZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKHR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtX3AudGhlbihmdW5jdGlvbihzdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gc3RyZWFtLmdldEF1ZGlvVHJhY2tzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAndmlkZW8nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmVhbS5nZXRWaWRlb1RyYWNrcygpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmVhbV9wLnRoZW4oZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICAgICAgdmFyIHZhdWRpbywgdmlkZW87XG4gICAgICAgICAgdmlkZW8gPSBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKTtcbiAgICAgICAgICB2YXVkaW8gPSBzdHJlYW0uZ2V0QXVkaW9UcmFja3MoKTtcbiAgICAgICAgICByZXR1cm4gdmlkZW8uY29uY2F0KGF1ZGlvKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHN0cmVhbSBwYXJ0ICdcIiArIHR5cGUgKyBcIidcIik7XG4gICAgICB9XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogTXV0ZXMgb3IgdW5tdXRlcyB0cmFja3Mgb2YgdGhlIHN0cmVhbVxuICAgICAqIEBtZXRob2QgbXV0ZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW211dGVkPXRydWVdIE11dGUgb24gYHRydWVgIGFuZCB1bm11dGUgb24gYGZhbHNlYFxuICAgICAqIEBwYXJhbSB7J2F1ZGlvJyB8ICd2aWRlbycgfCAnYm90aCd9IFt0eXBlPSdhdWRpbyddIFRoZSB0eXBlIG9mIHRyYWNrcyB0byBtdXRlIG9yIHVubXV0ZVxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFdoZXRoZXIgdGhlIHRyYWNrcyB3ZXJlIG11dGVkIG9yIHVubXV0ZWRcbiAgICAgKi9cblxuICAgIFN0cmVhbS5wcm90b3R5cGUubXV0ZSA9IGZ1bmN0aW9uKG11dGVkLCB0eXBlKSB7XG4gICAgICB2YXIgaSwgbGVuLCByZWYsIHRyYWNrO1xuICAgICAgaWYgKG11dGVkID09IG51bGwpIHtcbiAgICAgICAgbXV0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGUgPT0gbnVsbCkge1xuICAgICAgICB0eXBlID0gJ2F1ZGlvJztcbiAgICAgIH1cbiAgICAgIHJlZiA9IGdldFRyYWNrcyh0eXBlKTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB0cmFjayA9IHJlZltpXTtcbiAgICAgICAgdHJhY2suZW5hYmxlZCA9ICFtdXRlZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtdXRlZDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSBtdXRlIHN0YXRlIG9mIHRyYWNrcyBvZiB0aGUgc3RyZWFtXG4gICAgICogQG1ldGhvZCB0b2dnbGVNdXRlXG4gICAgICogQHBhcmFtIHsnYXVkaW8nIHwgJ3ZpZGVvJyB8ICdib3RoJ30gW3R5cGU9J2F1ZGlvJ10gVGhlIHR5cGUgb2YgdHJhY2tzIHRvIG11dGUgb3IgdW5tdXRlXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gV2hldGhlciB0aGUgdHJhY2tzIHdlcmUgbXV0ZWQgb3IgdW5tdXRlZFxuICAgICAqL1xuXG4gICAgU3RyZWFtLnByb3RvdHlwZS50b2dnbGVNdXRlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgdmFyIGksIGxlbiwgbXV0ZWQsIHJlZiwgdHJhY2ssIHRyYWNrcztcbiAgICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgICAgdHlwZSA9ICdhdWRpbyc7XG4gICAgICB9XG4gICAgICB0cmFja3MgPSBnZXRUcmFja3ModHlwZSk7XG4gICAgICBtdXRlZCA9ICEoKHJlZiA9IHRyYWNrc1swXSkgIT0gbnVsbCA/IHJlZi5lbmFibGVkIDogdm9pZCAwKTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHRyYWNrcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1tpXTtcbiAgICAgICAgdHJhY2suZW5hYmxlZCA9ICFtdXRlZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtdXRlZDtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyB0aGUgc3RyZWFtXG4gICAgICogQG1ldGhvZCBzdG9wXG4gICAgICovXG5cbiAgICBTdHJlYW0ucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzdHJlYW0uc3RvcCgpO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzdHJlYW0gdXNpbmcgYGdldFVzZXJNZWRpYSgpYFxuICAgICAqIEBtZXRob2QgY3JlYXRlU3RyZWFtXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29uZmlnPXthdWRpbzogdHJ1ZSwgdmlkZW86IHRydWV9XSBUaGUgY29uZmlndXJhdGlvbiB0byBwYXNzIHRvIGBnZXRVc2VyTWVkaWEoKWBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlIC0+IHJ0Yy5TdHJlYW19IFByb21pc2UgdG8gdGhlIHN0cmVhbVxuICAgICNcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqICAgICB2YXIgc3RyZWFtID0gcnRjLlN0cmVhbS5jcmVhdGVTdHJlYW0oe2F1ZGlvOiB0cnVlLCB2aWRlbzogZmFsc2V9KTtcbiAgICAgKiAgICAgcnRjLk1lZGlhRG9tRWxlbWVudCgkKCd2aWRlbycpLCBzdHJlYW0pO1xuICAgICAqL1xuXG4gICAgU3RyZWFtLmNyZWF0ZVN0cmVhbSA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgaWYgKGNvbmZpZyA9PSBudWxsKSB7XG4gICAgICAgIGNvbmZpZyA9IHtcbiAgICAgICAgICBhdWRpbzogdHJ1ZSxcbiAgICAgICAgICB2aWRlbzogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB2YXIgc3VjY2VzcztcbiAgICAgICAgc3VjY2VzcyA9IGZ1bmN0aW9uKG5hdGl2ZV9zdHJlYW0pIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShuZXcgU3RyZWFtKG5hdGl2ZV9zdHJlYW0pKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNvbXBhdC5nZXRVc2VyTWVkaWEoY29uZmlnLCBzdWNjZXNzLCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBTdHJlYW07XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS45LjJcbihmdW5jdGlvbigpIHtcbiAgdmFyIFBlZXIsIFN0cmVhbTtcblxuICBTdHJlYW0gPSByZXF1aXJlKCcuL3N0cmVhbScpLlN0cmVhbTtcblxuICBQZWVyID0gcmVxdWlyZSgnLi9wZWVyJykuUGVlcjtcblxuXG4gIC8qKlxuICAgKiBAbW9kdWxlIHJ0Y1xuICAgKi9cblxuXG4gIC8qKlxuICAgKiBAY2xhc3MgcnRjLk1lZGlhRG9tRWxlbWVudFxuICAgKi9cblxuICBleHBvcnRzLk1lZGlhRG9tRWxlbWVudCA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBNZWRpYURvbUVsZW1lbnQoZG9tLCBkYXRhKSB7XG4gICAgICB0aGlzLmRvbSA9IGRvbTtcbiAgICAgIGlmICh0aGlzLmRvbS5qcXVlcnkgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRvbSA9IHRoaXMuZG9tWzBdO1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRhY2goZGF0YSk7XG4gICAgfVxuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5hdHRhY2ggPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0cmVhbTtcbiAgICAgICAgdGhpcy5kb20ucGF1c2UoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZG9tLnNyYyA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKGRhdGEgaW5zdGFuY2VvZiBTdHJlYW0pIHtcbiAgICAgICAgdGhpcy5zdHJlYW0gPSBkYXRhO1xuICAgICAgICBpZiAodHlwZW9mIG1vekdldFVzZXJNZWRpYSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb3pHZXRVc2VyTWVkaWEgIT09IG51bGwpIHtcbiAgICAgICAgICB0aGlzLmRvbS5tb3pTcmNPYmplY3QgPSBkYXRhLnN0cmVhbTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRvbS5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGRhdGEuc3RyZWFtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5kb20ucGxheSgpO1xuICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgUGVlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2goZGF0YS5zdHJlYW0oKSk7XG4gICAgICB9IGVsc2UgaWYgKChkYXRhICE9IG51bGwgPyBkYXRhLnRoZW4gOiB2b2lkIDApICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGRhdGEudGhlbigoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuYXR0YWNoKHJlcyk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpW1wiY2F0Y2hcIl0oKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmVycm9yKGVycik7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoXCJUcmllZCB0byBhdHRhY2ggaW52YWxpZCBkYXRhXCIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNZWRpYURvbUVsZW1lbnQucHJvdG90eXBlLmVycm9yID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICByZXR1cm4gY29uc29sZS5sb2coZXJyKTtcbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoKCk7XG4gICAgfTtcblxuICAgIE1lZGlhRG9tRWxlbWVudC5wcm90b3R5cGUubXV0ZSA9IGZ1bmN0aW9uKG11dGVkKSB7XG4gICAgICBpZiAobXV0ZWQgPT0gbnVsbCkge1xuICAgICAgICBtdXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5kb20ubXV0ZWQgPSBtdXRlZDtcbiAgICB9O1xuXG4gICAgTWVkaWFEb21FbGVtZW50LnByb3RvdHlwZS50b2dnbGVNdXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5kb20ubXV0ZWQgPSAhdGhpcy5kb20ubXV0ZWQ7XG4gICAgfTtcblxuICAgIHJldHVybiBNZWRpYURvbUVsZW1lbnQ7XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiJdfQ==
