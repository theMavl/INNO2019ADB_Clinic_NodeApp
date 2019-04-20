'use strict';
const hasPerm = require('./hasPerm');
module.exports = function (name) {
  return function (req, res, next) {
    if (!hasPerm(req.session.uid, name)) res.throw(403, 'Not authorized!');
    next();
  };
};
