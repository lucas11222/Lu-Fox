// |reftest| shell-option(--enable-temporal) skip-if(!this.hasOwnProperty('Temporal')||!xulRuntime.shell) -- Temporal is not enabled unconditionally, requires shell-options
// Copyright (C) 2022 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-temporal.now.plaindatetimeiso
description: Temporal.Now.plainDateTimeISO is extensible.
features: [Temporal]
---*/

const result = Temporal.Now.plainDateTimeISO();
assert.sameValue(result.calendarId, "iso8601", "calendar string should be iso8601");

reportCompare(0, 0);
