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
const permission = require('../util/permissions');
const hasPerm = require('../util/hasPerm');

const Tip = require('../models/tip');

const Tips = module.context.collection('Tips');

const keySchema = joi.string().required()
  .description('The key of the tip');

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

router.tag('tip');

router.get(function (req, res) {
  res.send(Tips.all());
}, 'list')
  .response([Tip], 'A list of Tips.')
  .summary('List all Tips')
  .description(dd`
  Retrieves a list of all Tips.
`);

router.get('/random', function (req, res) {
  res.send(Tips.any());
}, 'list')
  .response([Tip], 'Random Tip.')
  .summary('Return random Tip')
  .description(dd`
  Returns random Tip.
`);


router.post(restrict(permission.tips.create), function (req, res) {
  const tip = req.body;
  let meta;
  try {
    meta = Tips.save(tip);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(tip, meta);
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', { key: tip._key })
  ));
  res.send(tip);
}, 'create')
  .body(Tip, 'The tip to create.')
  .response(201, Tip, 'The created tip.')
  .error(HTTP_CONFLICT, 'The tip already exists.')
  .summary('Create a new tip')
  .description(dd`
  Creates a new tip from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  let tip
  try {
    tip = Tips.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(tip);
}, 'detail')
  .pathParam('key', keySchema)
  .response(Tip, 'The tip.')
  .summary('Fetch a tip')
  .description(dd`
  Retrieves a tip by its key.
`);


router.put(':key', function (req, res) {
  const key = req.pathParams.key;
  const tipID = `${Tips.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.tips.edit, tipID)) res.throw(403, 'Forbidden');
  const tip = req.body;
  let meta;
  try {
    meta = Tips.replace(key, tip);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(tip, meta);
  res.send(tip);
}, 'replace')
  .pathParam('key', keySchema)
  .body(Tip, 'The data to replace the tip with.')
  .response(Tip, 'The new tip.')
  .summary('Replace a tip')
  .description(dd`
  Replaces an existing tip with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const tipID = `${Tips.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.tips.edit, tipID)) res.throw(403, 'Forbidden');
  const patchData = req.body;
  let tip;
  try {
    Tips.update(key, patchData);
    tip = Tips.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(tip);
}, 'update')
  .pathParam('key', keySchema)
  .body(joi.object().description('The data to update the tip with.'))
  .response(Tip, 'The updated tip.')
  .summary('Update a tip')
  .description(dd`
  Patches a tip with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  const tipID = `${Tips.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.tips.delete, tipID)) res.throw(403, 'Forbidden');
  try {
    Tips.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
  .pathParam('key', keySchema)
  .response(null)
  .summary('Remove a tip')
  .description(dd`
  Deletes a tip from the database.
`);
