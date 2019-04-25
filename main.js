'use strict';

module.context.use('/patients', require('./routes/patients'), 'patients');
module.context.use('/geo_test', require('./routes/geo_test'), 'geo_test');
module.context.use('/auth', require('./routes/auth'), 'auth');
module.context.use('/appointments', require('./routes/appointments'), 'appointments');
module.context.use('/homeremedies', require('./routes/homeremedies'), 'homeremedies');
module.context.use('/leaveapply', require('./routes/leaveapply'), 'leaveapply');
module.context.use('/staff', require('./routes/staff'), 'staff');
module.context.use('/tips', require('./routes/tips'), 'tips');
module.context.use('/visitors', require('./routes/visitors'), 'visitors');
// module.context.use('/users', require('./routes/users'), 'users');
module.context.use('/usergroups', require('./routes/usergroups'), 'usergroups');
module.context.use('/memberof', require('./routes/memberof'), 'memberof');
module.context.use('/isappointed', require('./routes/isappointed'), 'isappointed');

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
