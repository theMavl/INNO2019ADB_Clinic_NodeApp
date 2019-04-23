'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const MemberOf = require('../models/memberof');

const permission = require('../util/permissions');
const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');

const memberOfItems = module.context.collection('memberOf');
const keySchema = joi.string().required()
.description('The key of the memberOf');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;


router.tag('memberOf');


const NewMemberOf = Object.assign({}, MemberOf, {
  schema: Object.assign({}, MemberOf.schema, {
    _from: joi.string(),
    _to: joi.string()
  })
});


router.get(restrict(permission.usergroups.view), function (req, res) {
  res.send(memberOfItems.all());
}, 'list')
.response([MemberOf], 'A list of memberOfItems.')
.summary('List all memberOfItems')
.description(dd`
  Retrieves a list of all memberOfItems.
`);


router.post(restrict(permission.usergroups.create),function (req, res) {
  const memberOf = req.body;
  let meta;
  try {
    meta = memberOfItems.save(memberOf._from, memberOf._to, memberOf);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(memberOf, meta);
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', {key: memberOf._key})
  ));
  res.send(memberOf);
}, 'create')
.body(NewMemberOf, 'The memberOf to create.')
.response(201, MemberOf, 'The created memberOf.')
.error(HTTP_CONFLICT, 'The memberOf already exists.')
.summary('Create a new memberOf')
.description(dd`
  Creates a new memberOf from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  const memberOfID = `${MemberOf.name()}/${key}`;
  if (!hasPerm(req.session.uid, permission.usergroups.view, memberOfID)) res.throw(403, 'Not authorized');
  let memberOf
  try {
    memberOf = memberOfItems.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(memberOf);
}, 'detail')
.pathParam('key', keySchema)
.response(MemberOf, 'The memberOf.')
.summary('Fetch a memberOf')
.description(dd`
  Retrieves a memberOf by its key.
`);


router.put(':key', function (req, res) {
  const key = req.pathParams.key;
  const memberOfID = `${MemberOf.name()}/${key}`;
  if (!hasPerm(req.session.uid, permission.usergroups.edit, memberOfID)) res.throw(403, 'Not authorized');
  const memberOf = req.body;
  let meta;
  try {
    meta = memberOfItems.replace(key, memberOf);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(memberOf, meta);
  res.send(memberOf);
}, 'replace')
.pathParam('key', keySchema)
.body(MemberOf, 'The data to replace the memberOf with.')
.response(MemberOf, 'The new memberOf.')
.summary('Replace a memberOf')
.description(dd`
  Replaces an existing memberOf with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const memberOfID = `${MemberOf.name()}/${key}`;
  if (!hasPerm(req.session.uid, permission.usergroups.edit, memberOfID)) res.throw(403, 'Not authorized');
  const patchData = req.body;
  let memberOf;
  try {
    memberOfItems.update(key, patchData);
    memberOf = memberOfItems.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(memberOf);
}, 'update')
.pathParam('key', keySchema)
.body(joi.object().description('The data to update the memberOf with.'))
.response(MemberOf, 'The updated memberOf.')
.summary('Update a memberOf')
.description(dd`
  Patches a memberOf with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  const memberOfID = `${MemberOf.name()}/${key}`;
  if (!hasPerm(req.session.uid, permission.usergroups.delete, memberOfID)) res.throw(403, 'Not authorized');
  try {
    memberOfItems.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
.pathParam('key', keySchema)
.response(null)
.summary('Remove a memberOf')
.description(dd`
  Deletes a memberOf from the database.
`);
