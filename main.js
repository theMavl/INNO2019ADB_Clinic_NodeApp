'use strict';

module.context.use('/patients', require('./routes/patients'), 'patients');
module.context.use('/auth', require('./routes/auth'), 'auth');
module.context.use('/geo_test', require('./routes/geo_test'), 'geo_test');

const sessionsMiddleware = require('@arangodb/foxx/sessions');
const sessions = sessionsMiddleware({
    storage: module.context.collection('sessions'),
    transport: 'cookie'
});
module.context.use(sessions);

const users = module.context.collection('users');
module.context.use(function (req, res, next) {
    if (req.session.uid) {
        try {
            req.user = users.document(req.session.uid)
        } catch (e) {
            req.session.uid = null;
            req.sessionStorage.save();
        }
    }
    next();
});
