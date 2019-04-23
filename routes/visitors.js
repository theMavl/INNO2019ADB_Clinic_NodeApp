'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const Visitor = require('../models/visitor');

const Visitors = module.context.collection('Visitors');
const Doctors = module.context.collection('Staff');
const Facilities = module.context.collection('Facilities')
const keySchema = joi.string().required()
  .description('The key of the visitor');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;


router.tag('visitor');


router.get(function (req, res) {
    res.send(Visitors.all());
  }, 'list')
  .response([Visitor], 'A list of Visitors.')
  .summary('List all Visitors')
  .description(dd `
  Retrieves a list of all Visitors.
`);


router.post(function (req, res) {
    const visitor = req.body;
    let meta;
    try {
      meta = Visitors.save(visitor);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
        throw httpError(HTTP_CONFLICT, e.message);
      }
      throw e;
    }
    Object.assign(visitor, meta);
    res.status(201);
    res.set('location', req.makeAbsolute(
      req.reverse('detail', {
        key: visitor._key
      })
    ));
    res.send(visitor);
  }, 'create')
  .body(Visitor, 'The visitor to create.')
  .response(201, Visitor, 'The created visitor.')
  .error(HTTP_CONFLICT, 'The visitor already exists.')
  .summary('Create a new visitor')
  .description(dd `
  Creates a new visitor from the request body and
  returns the saved document.
`)

router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  let facilities
  try {
    facilities = Facilities.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(facilities);
}, 'detail')
.pathParam('key', keySchema)
.response(Facilities, 'The fascility.')
.summary('Fetch a fascility')
.description(dd `
Retrieves a fascility by its key.
`);

router.get(':doctor_designation', function (req, res) {
    const doctor_designation = req.pathParams.doctor_designation;
    // const key = req.pathParam.key;
    let doctor
    try {
      doctor = Doctors.document(doctor_designation);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    res.send(doctor);
  }, 'detail')
  .pathParam('key', keySchema)
  .response(Doctors, 'The designation.')
  .summary('Fetch a doctor designation')
  .description(dd `
Retrieves a doctor by its key.
`);


router.get(':key', function (req, res) {
    const key = req.pathParams.key;
    let visitor
    try {
      visitor = Visitors.document(key);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
    res.send(visitor);
  }, 'detail')
  .pathParam('key', keySchema)
  .response(Visitor, 'The visitor.')
  .summary('Fetch a visitor')
  .description(dd `
  Retrieves a visitor by its key.
`);


router.put(':key', function (req, res) {
    const key = req.pathParams.key;
    const visitor = req.body;
    let meta;
    try {
      meta = Visitors.replace(key, visitor);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
        throw httpError(HTTP_CONFLICT, e.message);
      }
      throw e;
    }
    Object.assign(visitor, meta);
    res.send(visitor);
  }, 'replace')
  .pathParam('key', keySchema)
  .body(Visitor, 'The data to replace the visitor with.')
  .response(Visitor, 'The new visitor.')
  .summary('Replace a visitor')
  .description(dd `
  Replaces an existing visitor with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
    const key = req.pathParams.key;
    const patchData = req.body;
    let visitor;
    try {
      Visitors.update(key, patchData);
      visitor = Visitors.document(key);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
        throw httpError(HTTP_CONFLICT, e.message);
      }
      throw e;
    }
    res.send(visitor);
  }, 'update')
  .pathParam('key', keySchema)
  .body(joi.object().description('The data to update the visitor with.'))
  .response(Visitor, 'The updated visitor.')
  .summary('Update a visitor')
  .description(dd `
  Patches a visitor with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
    const key = req.pathParams.key;
    try {
      Visitors.remove(key);
    } catch (e) {
      if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
        throw httpError(HTTP_NOT_FOUND, e.message);
      }
      throw e;
    }
  }, 'delete')
  .pathParam('key', keySchema)
  .response(null)
  .summary('Remove a visitor')
  .description(dd `
  Deletes a visitor from the database.
`);
