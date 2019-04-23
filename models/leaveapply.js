'use strict';
const _ = require('lodash');
const joi = require('joi');
const Enumerators = require('../models/enumerators');


module.exports = {
    schema: {
        // Describe the attributes with joi here
        member: joi.string().required(),
        leave_reason: joi.string().required(),
        beginning_date: joi.date().required(),
        ending_date: joi.date().required(),
        status: joi.string().allow(Enumerators.leave_apply_status)
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
