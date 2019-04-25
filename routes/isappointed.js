'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');
const IsAppointed = require('../models/isappointed');
const permission = require('../util/permissions');

const Appointments = module.context.collection('Appointments');
const isAppointedItems = module.context.collection('isAppointed');
const Doctors = module.context.collection('Staff');
const keySchema = joi.string().required()
    .description('The key of the isAppointed');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;


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
        meta = isAppointedItems.save(`${Doctors.name()}/${isAppointed._from}`, `${Appointments.name()}/${isAppointed._to}`, isAppointed);
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
    if (!hasPerm(req.user, permission.appointments.view)) res.throw(403, 'Not authorized');
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


router.get(':key/doctor', function (req, res) {
    const doctor_key = req.pathParams.key;
    const doctorId = `${Doctors.name()}/${doctor_key}`;
    if (!hasPerm(doctorId, permission.appointments.view)) res.throw(403, 'Not authorized');
    let isAppointed;
    try {
        isAppointed = isAppointedItems.byExample( {'_from': doctorId} );
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        throw e;
    }
    res.send(isAppointed);
}, 'detail')
    .pathParam('key', keySchema)
    .response([IsAppointed], 'The schedule')
    .summary('Fetch an schedule of a specific doctor')
    .description(dd`
  Retrieves a schedule by key of a doctor.
`);


router.put(':key', function (req, res) {
    if (!hasPerm(req.user, permission.appointments.edit)) res.throw(403, 'Not authorized');
    const key = req.pathParams.key;
    const isAppointed = req.body;
    let meta;
    try {
        meta = isAppointedItems.replace(key, isAppointed);
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
    .pathParam('key', keySchema)
    .body(IsAppointed, 'The data to replace the isAppointed with.')
    .response(IsAppointed, 'The new isAppointed.')
    .summary('Replace an isAppointed')
    .description(dd`
  Replaces an existing isAppointed with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
    const key = req.pathParams.key;
    const appointmentId = `${appointments.name()}/${key}`;
    if (!hasPerm(req.user, permission.appointments.edit, appointmentId)) res.throw(403, 'Not authorized');
    const patchData = req.body;
    let isAppointed;
    try {
        isAppointedItems.update(key, patchData);
        isAppointed = isAppointedItems.document(key);
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
    .pathParam('key', keySchema)
    .body(joi.object().description('The data to update the isAppointed with.'))
    .response(IsAppointed, 'The updated isAppointed.')
    .summary('Update an isAppointed')
    .description(dd`
  Patches an isAppointed with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
    if (!hasPerm(req.user, permission.appointments.delete)) res.throw(403, 'Not authorized');
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
