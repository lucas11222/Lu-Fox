// |reftest| shell-option(--enable-atomics-pause) skip-if(!this.hasOwnProperty('Atomics')||!Atomics.pause||!xulRuntime.shell) -- Atomics.pause is not enabled unconditionally, requires shell-options
// Copyright 2024 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-ecmascript-standard-built-in-objects
description: Atomics.pause does not implement [[Construct]], is not new-able
info: |
  ECMAScript Function Objects

  Built-in function objects that are not identified as constructors do not
  implement the [[Construct]] internal method unless otherwise specified in
  the description of a particular function.

  sec-evaluatenew

  ...
  7. If IsConstructor(constructor) is false, throw a TypeError exception.
  ...
includes: [isConstructor.js]
features: [Reflect.construct, Atomics.pause]
---*/

assert.sameValue(isConstructor(Atomics.pause), false, 'isConstructor(Atomics.pause) must return false');

assert.throws(TypeError, () => {
  new Atomics.pause();
});


reportCompare(0, 0);
