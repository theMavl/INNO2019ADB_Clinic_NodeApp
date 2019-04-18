'use strict';
const _ = require('lodash');
const joi = require('joi');
const Enumerators = require('../models/enumerators');



module.exports = {
  schema: {
    // Describe the attributes with joi here
    _key: joi.string(),
    first_name: joi.string().required(),
    last_name: joi.string().required(),
    birth_date: joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
    ssn: joi.string().regex(/^\d{3}-\d{2}-\d{4}$/).required(),
    email: joi.string().email({ minDomainAtoms: 2 }),
    address: joi.object().keys( {
      zip: joi.string().required(),
      country: joi.string().required(),
      city: joi.string().required(),
      street: joi.string().required(),
      building: joi.string().required()
    }),
    designation: joi.string().allow(Enumerators.staff_designations),
    doctor_designation: joi.string().allow(Enumerators.doctor_designations)
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
