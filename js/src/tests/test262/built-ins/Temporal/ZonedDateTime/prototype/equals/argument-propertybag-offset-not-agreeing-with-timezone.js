// |reftest| shell-option(--enable-temporal) skip-if(!this.hasOwnProperty('Temporal')||!xulRuntime.shell) -- Temporal is not enabled unconditionally, requires shell-options
// Copyright (C) 2022 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-temporal.zoneddatetime.prototype.equals
description: Property bag with offset property is rejected if offset does not agree with time zone
features: [Temporal]
---*/

const timeZone = "+01:00";
const instance = new Temporal.ZonedDateTime(0n, timeZone);

const properties = { year: 2021, month: 10, day: 28, offset: "-07:00", timeZone };
assert.throws(RangeError, () => instance.equals(properties), "offset property not matching time zone is rejected");

reportCompare(0, 0);
