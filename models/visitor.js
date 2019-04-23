'use strict';
const _ = require('lodash');
const joi = require('joi');

module.exports = {
  schema: {
    // Describe the attributes with joi here
    first_name: joi.string().required(), 
    last_name: joi.string().required(), 
    registered: joi.bool(),
    visited_date: joi.date().required()
  },
  forClient(obj) {
    // Implement outgoing transformations here
    obj = _.omit(obj, ['_id', '_rev', '_oldRev']);
    return obj;
  },
  fromClient(obj) {
    // Implement incoming transformations here
    return obj;
  }
};
