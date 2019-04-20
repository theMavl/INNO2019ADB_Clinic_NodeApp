'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const Staff = require('../models/staff');
const auth = require('../util/auth');

const staff_members = module.context.collection('Staff');
const keySchema = joi.string().required()
  .description('The key of the staff');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const sessionMiddleware = require('@arangodb/foxx/sessions');
const cookieTransport = require('@arangodb/foxx/sessions/transports/cookie');

const router = createRouter();
module.exports = router;

router.use(sessionMiddleware({
  storage: module.context.collection('sessions'),
  transport: cookieTransport('keyboardcat')
}));

router.tag('staff');


router.get(function (req, res) {
  res.send(StaffItems.all());
}, 'list')
  .response([Staff], 'A list of StaffItems.')
  .summary('List all StaffItems')
  .description(dd`
  Retrieves a list of all StaffItems.
`);

router.post('/login', function (req, res) {
  let member = {};
  member = staff_members.firstExample({ "_key": req.body.login });
  if (!member)
    member = staff_members.firstExample({ "email": req.body.login });

  const valid = auth.verify(
    member ? member.authData : {},
    req.body.password
  );
  if (!valid) res.throw('unauthorized');
  print("STAFF AUTH "+member._key, +" "+member)
  req.session.uid = member._id;
  req.sessionStorage.save(req.session);
  print(req.session)
  res.send({ sucess: true });
})
  .body(joi.object({
    login: joi.string().required(),
    password: joi.string().required()
  }).required(), 'Credentials')
  .description('Logs a registered staff member in.');

router.post('/signup', function (req, res) {
  const member = req.body;
  try {
    member.authData = auth.create(member.password);
    delete member.password
    const meta = staff_members.save(member);
    Object.assign(member, meta);
  } catch (e) {
    res.throw('bad request', 'Email already exists!', e);
  }
  req.session.uid = member._id;
  req.sessionStorage.save(req.session);
  res.send({ success: true, staff_id: member._key });
})
  .body(joi.object({
    first_name: joi.string().required(),
    last_name: joi.string().required(),
    birth_date: joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
    ssn: joi.string().regex(/^\d{3}-\d{2}-\d{4}$/).required(),
    email: joi.string().email({ minDomainAtoms: 2 }),
    password: joi.string().required(),
    address: joi.object().keys({
      zip: joi.string().required(),
      country: joi.string().required(),
      city: joi.string().required(),
      street: joi.string().required(),
      building: joi.string().required()
    })
  }).required(), 'Credentials')
  .description('Creates a new staff member and logs them in.');

router.post(function (req, res) {
  const staff = req.body;
  let meta;
  try {
    meta = StaffItems.save(staff);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(staff, meta);
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', { key: staff._key })
  ));
  res.send(staff);
}, 'create')
  .body(Staff, 'The staff to create.')
  .response(201, Staff, 'The created staff.')
  .error(HTTP_CONFLICT, 'The staff already exists.')
  .summary('Create a new staff')
  .description(dd`
  Creates a new staff from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  let staff
  try {
    staff = StaffItems.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(staff);
}, 'detail')
  .pathParam('key', keySchema)
  .response(Staff, 'The staff.')
  .summary('Fetch a staff')
  .description(dd`
  Retrieves a staff by its key.
`);


router.put(':key', function (req, res) {
  const key = req.pathParams.key;
  const staff = req.body;
  let meta;
  try {
    meta = StaffItems.replace(key, staff);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(staff, meta);
  res.send(staff);
}, 'replace')
  .pathParam('key', keySchema)
  .body(Staff, 'The data to replace the staff with.')
  .response(Staff, 'The new staff.')
  .summary('Replace a staff')
  .description(dd`
  Replaces an existing staff with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const patchData = req.body;
  let staff;
  try {
    StaffItems.update(key, patchData);
    staff = StaffItems.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(staff);
}, 'update')
  .pathParam('key', keySchema)
  .body(joi.object().description('The data to update the staff with.'))
  .response(Staff, 'The updated staff.')
  .summary('Update a staff')
  .description(dd`
  Patches a staff with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  try {
    StaffItems.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
  .pathParam('key', keySchema)
  .response(null)
  .summary('Remove a staff')
  .description(dd`
  Deletes a staff from the database.
`);
