'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const sessionMiddleware = require('@arangodb/foxx/sessions');
const cookieTransport = require('@arangodb/foxx/sessions/transports/cookie');

const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');
const permission = require('../util/permissions');

const IsAppointed = require('../models/isappointed');

const isAppointedItems = module.context.collection('isAppointed');
const staff = module.context.collection('Staff');
const Appointments = module.context.collection('Appointments');

const keySchema = joi.string().required()
    .description('The key of the isAppointed');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;

router.use(sessionMiddleware({
  storage: module.context.collection('sessions'),
  transport: cookieTransport(['header', 'cookie'])
}));

router.tag('isAppointed');

const NewIsAppointed = Object.assign({}, IsAppointed, {
    schema: Object.assign({}, IsAppointed.schema, {
        _from: joi.string(),
        _to: joi.string()
    })
});



router.get(restrict(permission.appointments.view), function (req, res) {
    res.send(isAppointedItems.all());
}, 'list')
    .response([IsAppointed], 'A list of isAppointedItems.')
    .summary('List all isAppointedItems')
    .description(dd`
  Retrieves a list of all isAppointedItems.
`);


router.post(restrict(permission.appointments.create), function (req, res) {
    const isAppointed = req.body;
    let meta;
    try {
        isAppointed._from = `${staff.name()}/${isAppointed._from}`;
        isAppointed._to = `${Appointments.name()}/${isAppointed._to}`;
        meta = isAppointedItems.save(isAppointed);
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
            throw httpError(HTTP_CONFLICT, e.message);
        }
        throw e;
    }
    Object.assign(isAppointed, meta);
    res.status(201);
    res.set('location', req.makeAbsolute(
        req.reverse('detail', {key: isAppointed._key})
    ));
    res.send(isAppointed);
}, 'create')
    .body(NewIsAppointed, 'The isAppointed to create.')
    .response(201, IsAppointed, 'The created isAppointed.')
    .error(HTTP_CONFLICT, 'The isAppointed already exists.')
    .summary('Create a new isAppointed')
    .description(dd`
  Creates a new isAppointed from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.session.uid, permission.appointments.view)) res.throw(403, 'Forbidden');
    const key = req.pathParams.key;
    let isAppointed;
    try {
        isAppointed = isAppointedItems.document(key);
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
    }
    res.send(isAppointed);
}, 'detail')
    .pathParam('key', keySchema)
    .response(IsAppointed, 'The isAppointed.')
    .summary('Fetch an isAppointed')
    .description(dd`
  Retrieves an isAppointed by its key.
`);


router.get('/schedule', function (req, res) {
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.session.uid, permission.appointments.view)) res.throw(403, 'Forbidden');
    let isAppointed;
    try {
        isAppointed = isAppointedItems.byExample( {'_from': req.session.uid} );
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
    }
    res.send(isAppointed);
}, 'detail')
    .response([IsAppointed], 'The schedule')
    .summary('Fetch a schedule of a specific doctor')
    .description(dd`
  Retrieves a schedule by key of a doctor.
`);


router.put(function (req, res) {
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.session.uid, permission.appointments.edit)) res.throw(403, 'Forbidden');
    const key = req.pathParams.key;
    const isAppointed = req.body;
    let meta;
    try {
        const user = staff.firstExample( {"_id": req.session.uid} );
        meta = isAppointedItems.replace(user._key, isAppointed);
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
            throw httpError(HTTP_CONFLICT, e.message);
        }
        throw e;
    }
    Object.assign(isAppointed, meta);
    res.send(isAppointed);
}, 'replace')
    .body(IsAppointed, 'The data to replace the isAppointed with.')
    .response(IsAppointed, 'The new isAppointed.')
    .summary('Replace an isAppointed')
    .description(dd`
  Replaces an existing isAppointed with the request body and
  returns the new document.
`);


router.patch(function (req, res) {
    const key = req.pathParams.key;
    const appointmentId = `${Appointments.name()}/${key}`;
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.session.uid, permission.appointments.edit, appointmentId)) res.throw(403, 'Forbidden');
    const patchData = req.body;
    let isAppointed;
    try {
        const user = staff.firstExample( {"_id": req.session.uid} );
        isAppointedItems.update(user._key, patchData);
        isAppointed = isAppointedItems.document(user._key);
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
            throw httpError(HTTP_CONFLICT, e.message);
        }
        throw e;
    }
    res.send(isAppointed);
}, 'update')
    .body(IsAppointed, 'The data to update the isAppointed with.')
    .response(IsAppointed, 'The updated isAppointed.')
    .summary('Update an isAppointed')
    .description(dd`
  Patches an isAppointed with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.session.uid, permission.appointments.delete)) res.throw(403, 'Forbidden');
    const key = req.pathParams.key;
    try {
        isAppointedItems.remove(key);
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
    }
}, 'delete')
    .pathParam('key', keySchema)
    .response(null)
    .summary('Remove a isAppointed')
    .description(dd`
  Deletes a isAppointed from the database.
`);
