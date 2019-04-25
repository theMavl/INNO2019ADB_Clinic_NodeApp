'use strict';
const _ = require('lodash');
const joi = require('joi');

module.exports = {
    schema: {
        // Describe the attributes with joi here
        _key: joi.string(),
        date: joi.date().required(),
        time: joi.string().regex(/^(?:\d|[01]\d|2[0-3]):[0-5]\d$/).required()
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
