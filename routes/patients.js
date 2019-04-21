'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');
const Patient = require('../models/patient');
const auth = require('../util/auth');

const patients = module.context.collection('Patients');
const perms = module.context.collection('hasPerm');
const keySchema = joi.string().required()
.description('The key of the patient');

const sessionMiddleware = require('@arangodb/foxx/sessions');
const cookieTransport = require('@arangodb/foxx/sessions/transports/cookie');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;

router.use(sessionMiddleware({
  storage: module.context.collection('sessions'),
  transport: cookieTransport('keyboardcat')
}));

router.tag('patient');

router.post('/login', function (req, res) {
  let patient = {};
  patient = patients.firstExample({ "_key": req.body.login });
  if (!patient)
    patient = patients.firstExample({ "email": req.body.login });

  const valid = auth.verify(
    patient ? patient.authData : {},
    req.body.password
  );
  if (!valid) res.throw('unauthorized');
  req.session.uid = patient._id;
  req.sessionStorage.save(req.session);
  res.send({ sucess: true });
})
  .body(joi.object({
    login: joi.string().required(),
    password: joi.string().required()
  }).required(), 'Credentials')
  .description('Logs a registered patient in.');

router.get(restrict('view_patients'), function (req, res) {
  res.send(patients.toArray().map(patient => {
    delete patient.billing;
    delete patient.medical;
    return patient;
  }));
}, 'list')
.response([Patient], 'A list of patients.')
.summary('List all patients')
.description(dd`
  Retrieves a list of all patients.
`);

router.post('/signup', function (req, res) {
  const patient = req.body;
  try {
    patient.authData = auth.create(patient.password);
    delete patient.password
    const meta = patients.save(patient);
    Object.assign(patient, meta);
  } catch (e) {
    res.throw('bad request', 'Email already exists!', e);
  }
  req.session.uid = patient._id;
  req.sessionStorage.save(req.session);
  res.send({ success: true, patient_id: patient._key });
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
  .description('Creates a patient and logs him in.');


router.post(restrict('add_patients'), function (req, res) {
  const patient = req.body;
  // if (!hasPerm(req.user, 'access_patients_billing')) delete patient.billing;
  // if (!hasPerm(req.user, 'access_patients_medical')) delete patient.medical;
  let meta;
  try {
    meta = patients.save(patient);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(patient, meta);
  perms.save({_from: req.user._id, _to: patient._id, name: 'change_patients'});
  perms.save({_from: req.user._id, _to: patient._id, name: 'remove_patients'});
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', {key: patient._key})
  ));
  res.send(patient);
}, 'create')
.body(Patient, 'The patient to create.')
.response(201, Patient, 'The created patient.')
.error(HTTP_CONFLICT, 'The patient already exists.')
.summary('Create a new patient')
.description(dd`
  Creates a new patient from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  const patientId = `${patients.name()}/${key}`;
  if (!hasPerm(req.user, 'view_patients', patientId)) res.throw(403, 'Not authorized');
  let patient
  try {
    patient = patients.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  if (!hasPerm(req.user, 'access_patients_billing', patientId)) delete patient.billing;
  if (!hasPerm(req.user, 'access_patients_medical', patientId)) delete patient.medical;
  res.send(patient);
}, 'detail')
.pathParam('key', keySchema)
.response(Patient, 'The patient.')
.summary('Fetch a patient')
.description(dd`
  Retrieves a patient by its key.
`);


router.put(':key', function (req, res) {
  const key = req.pathParams.key;
  const patientId = `${patients.name()}/${key}`;
  if (!hasPerm(req.user, 'change_patients', patientId)) res.throw(403, 'Not authorized');
  const canAccessBilling = hasPerm(req.user, 'access_patients_billing', patientId);
  const canAccessMedical = hasPerm(req.user, 'access_patients_medical', patientId);
  const patient = req.body;
  let meta;
  try {
    const old = patients.document(key);
    if (!canAccessBilling) patient.billing = old.billing;
    if (!canAccessMedical) patient.medical = old.medical;
    meta = patients.replace(key, patient);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(patient, meta);
  if (!canAccessBilling) delete patient.billing;
  if (!canAccessMedical) delete patient.medical;
  res.send(patient);
}, 'replace')
.pathParam('key', keySchema)
.body(Patient, 'The data to replace the patient with.')
.response(Patient, 'The new patient.')
.summary('Replace a patient')
.description(dd`
  Replaces an existing patient with the request body and
  returns the new document.
`);


router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const patientId = `${patients.name()}/${key}`;
  if (!hasPerm(req.user, 'change_patients', patientId)) res.throw(403, 'Not authorized');
  const canAccessBilling = hasPerm(req.user, 'access_patients_billing', patientId);
  const canAccessMedical = hasPerm(req.user, 'access_patients_medical', patientId);
  const patchData = req.body;
  let patient;
  try {
    if (!canAccessBilling) delete patchData.billing;
    if (!canAccessMedical) delete patchData.medical;
    patients.update(key, patchData);
    patient = patients.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  if (!canAccessBilling) delete patient.billing;
  if (!canAccessMedical) delete patient.medical;
  res.send(patient);
}, 'update')
.pathParam('key', keySchema)
.body(joi.object().description('The data to update the patient with.'))
.response(Patient, 'The updated patient.')
.summary('Update a patient')
.description(dd`
  Patches a patient with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  const patientId = `${patients.name()}/${key}`;
  if (!hasPerm(req.user, 'remove_patients', patientId)) res.throw(403, 'Not authorized');
  for (const perm of perms.inEdges(patientId)) {
    perms.remove(perm);
  }
  try {
    patients.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
.pathParam('key', keySchema)
.response(null)
.summary('Remove a patient')
.description(dd`
  Deletes a patient from the database.
`);
