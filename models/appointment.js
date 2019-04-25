'use strict';
const _ = require('lodash');
const joi = require('joi');
const Enumerators = require('../models/enumerators');


module.exports = {
  schema: {
    // Describe the attributes with joi here
    patient: joi.string().required(),
    doctor: joi.string(),
    symptoms: joi.array().required(),
    description: joi.string().required(),
    date_created: joi.date().required(),
    since_when: joi.date().required(),
    payment_type: joi.string().valid(Enumerators.payment_types),
    payed: joi.bool().required(),
    urgent: joi.bool(),
    status: joi.string().valid(Enumerators.appointment_status),
    appointment_date: joi.date(),
    cancel_reason: joi.string(),
    reject_reason: joi.string()    
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
