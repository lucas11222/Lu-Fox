/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {
  ENABLE_REQUEST_FILTER_TYPE_ONLY,
  TOGGLE_REQUEST_FILTER_TYPE,
  SET_REQUEST_FILTER_TEXT,
  FILTER_TAGS,
} = require("resource://devtools/client/netmonitor/src/constants.js");

function FilterTypes(overrideParams = {}) {
  const allFilterTypes = ["all"].concat(FILTER_TAGS);
  // filter only those keys which are valid filter tags
  overrideParams = Object.keys(overrideParams)
    .filter(key => allFilterTypes.includes(key))
    .reduce((obj, key) => {
      obj[key] = overrideParams[key];
      return obj;
    }, {});
  const filterTypes = allFilterTypes.reduce(
    (o, tag) => Object.assign(o, { [tag]: false }),
    {}
  );
  return Object.assign({}, filterTypes, overrideParams);
}

function Filters(overrideParams = {}) {
  return Object.assign(
    {
      requestFilterTypes: new FilterTypes({ all: true }),
      requestFilterText: "",
    },
    overrideParams
  );
}

function toggleRequestFilterType(state, action) {
  const { filter } = action;
  let newState;

  // Ignore unknown filter type
  if (!state.hasOwnProperty(filter)) {
    return state;
  }
  if (filter === "all") {
    return new FilterTypes({ all: true });
  }

  newState = { ...state };
  newState.all = false;
  newState[filter] = !state[filter];

  if (!Object.values(newState).includes(true)) {
    newState = new FilterTypes({ all: true });
  }

  return newState;
}

function enableRequestFilterTypeOnly(state, action) {
  const { filter } = action;

  // Ignore unknown filter type
  if (!state.hasOwnProperty(filter)) {
    return state;
  }

  return new FilterTypes({ [filter]: true });
}

function filters(state = new Filters(), action) {
  switch (action.type) {
    case ENABLE_REQUEST_FILTER_TYPE_ONLY:
      return {
        ...state,
        requestFilterTypes: enableRequestFilterTypeOnly(
          state.requestFilterTypes,
          action
        ),
      };
    case TOGGLE_REQUEST_FILTER_TYPE:
      return {
        ...state,
        requestFilterTypes: toggleRequestFilterType(
          state.requestFilterTypes,
          action
        ),
      };
    case SET_REQUEST_FILTER_TEXT:
      if (state.requestFilterText == action.text) {
        return state;
      }
      return {
        ...state,
        requestFilterText: action.text,
      };
    default:
      break;
  }
  return state;
}

module.exports = {
  FilterTypes,
  Filters,
  filters,
};
