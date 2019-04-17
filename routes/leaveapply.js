'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const LeaveApply = require('../models/leaveapply');

const LeaveApplyItems = module.context.collection('LeaveApply');
const keySchema = joi.string().required()
.description('The key of the leaveApply');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;


router.tag('leaveApply');


router.get(function (req, res) {
  res.send(LeaveApplyItems.all());
}, 'list')
.response([LeaveApply], 'A list of LeaveApplyItems.')
.summary('List all LeaveApplyItems')
.description(dd`
  Retrieves a list of all LeaveApplyItems.
`);


router.post(function (req, res) {
  const leaveApply = req.body;
  let meta;
  try {
    meta = LeaveApplyItems.save(leaveApply);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(leaveApply, meta);
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', {key: leaveApply._key})
  ));
  res.send(leaveApply);
}, 'create')
.body(LeaveApply, 'The leaveApply to create.')
.response(201, LeaveApply, 'The created leaveApply.')
.error(HTTP_CONFLICT, 'The leaveApply already exists.')
.summary('Create a new leaveApply')
.description(dd`
  Creates a new leaveApply from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  let leaveApply
  try {
    leaveApply = LeaveApplyItems.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(leaveApply);
}, 'detail')
.pathParam('key', keySchema)
.response(LeaveApply, 'The leaveApply.')
.summary('Fetch a leaveApply')
.description(dd`
  Retrieves a leaveApply by its key.
`);


router.put(':key', function (req, res) {
  const key = req.pathParams.key;
  const leaveApply = req.body;
  let meta;
  try {
    meta = LeaveApplyItems.replace(key, leaveApply);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(leaveApply, meta);
  res.send(leaveApply);
}, 'replace')
.pathParam('key', keySchema)
.body(LeaveApply, 'The data to replace the leaveApply with.')
.response(LeaveApply, 'The new leaveApply.')
.summary('Replace a leaveApply')
.description(dd`
  Replaces an existing leaveApply with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const patchData = req.body;
  let leaveApply;
  try {
    LeaveApplyItems.update(key, patchData);
    leaveApply = LeaveApplyItems.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(leaveApply);
}, 'update')
.pathParam('key', keySchema)
.body(joi.object().description('The data to update the leaveApply with.'))
.response(LeaveApply, 'The updated leaveApply.')
.summary('Update a leaveApply')
.description(dd`
  Patches a leaveApply with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  try {
    LeaveApplyItems.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
.pathParam('key', keySchema)
.response(null)
.summary('Remove a leaveApply')
.description(dd`
  Deletes a leaveApply from the database.
`);
