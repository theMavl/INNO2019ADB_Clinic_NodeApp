'use strict';
const hasPerm = require('./hasPerm');
module.exports = function (name) {
  return function (req, res, next) {
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.session.uid, name)) res.throw(403, 'Forbidden '+req.session.uid);
    next();
  };
};
