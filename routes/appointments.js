'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const Appointment = require('../models/appointment');
const perms = module.context.collection('hasPerm');
const permission = require('../util/permissions');
const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');

const Appointments = module.context.collection('Appointments');
const Doctors = module.context.collection('Staff');
const keySchema = joi.string().required()
  .description('The key of the appointment');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const router = createRouter();
module.exports = router;


router.tag('appointment');


router.get(restrict(permission.appointments.view), function (req, res) {
  res.send(Appointments.all());
}, 'list')
  .response([Appointment], 'A list of Appointments.')
  .summary('List all Appointments')
  .description(dd`
  Retrieves a list of all Appointments.
`);


router.get('/rejected', function (req, res) {
  if (!hasPerm(req.user, permission.appointments.view)) res.throw(403, 'Not authorized');
  res.send(Appointments.byExample( {'status': 'Rejected'} ));
}, 'list')
    .response([Appointment], 'A list of rejected Appointments.')
    .summary('List all rejected Appointments')
    .description(dd`
  Retrieves a list of all rejected Appointments.
`);


router.post(restrict(permission.appointments.create), function (req, res) {
  const appointment = req.body;
  const patient = patients.firstExample("_id", user_id);
  if (!patient) res.throw(403, 'Not a patient!');
  let meta;
  try {
    appointment.area = patient.residential_area;
    meta = Appointments.save(appointment);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(appointment, meta);
  perms.save({ _from: req.user._id, _to: appointment._id, name: permission.appointments.view });
  perms.save({ _from: req.user._id, _to: appointment._id, name: permission.appointments.edit });
  perms.save({ _from: req.user._id, _to: appointment._id, name: permission.appointments.delete });
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', { key: appointment._key })
  ));
  res.send(appointment);
}, 'create')
  .body(Appointment, 'The appointment to create.')
  .response(201, Appointment, 'The created appointment.')
  .error(HTTP_CONFLICT, 'The appointment already exists.')
  .summary('Create a new appointment')
  .description(dd`
  Creates a new appointment from the request body and
  returns the saved document.
`);


router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${Appointments.name()}/${key}`;
  if (!hasPerm(req.user, permission.appointments.view, appointmentId)) res.throw(403, 'Not authorized');
  let appointment;
  try {
    appointment = Appointments.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(appointment);
}, 'detail')
  .pathParam('key', keySchema)
  .response(Appointment, 'The appointment.')
  .summary('Fetch a appointment')
  .description(dd`
  Retrieves a appointment by its key.
`);


router.get(':key/doctor', function (req, res) {
  const doctor_key = req.pathParams.key;
  const doctorId = `${Doctors.name()}/${doctor_key}`;
  if (!hasPerm(doctorId, permission.appointments.view)) res.throw(403, 'Not authorized');
  let appointments;
  try {
    appointments = Appointments.byExample( {'doctor': doctor_key} );
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(appointments);
}, 'detail')
    .pathParam('key', keySchema)
    .response([Appointment], 'A list of Appointments of a particular doctor.')
    .summary('Fetch doctor\'s appointments')
    .description(dd`
  Retrieves a appointment by its key.
`);


router.put(':key', function (req, res) {
  if (!hasPerm(req.user, permission.appointments.edit)) res.throw(403, 'Not authorized');
  const key = req.pathParams.key;
  const appointment = req.body;
  let meta;
  try {
    meta = Appointments.replace(key, appointment);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(appointment, meta);
  res.send(appointment);
}, 'replace')
  .pathParam('key', keySchema)
  .body(Appointment, 'The data to replace the appointment with.')
  .response(Appointment, 'The new appointment.')
  .summary('Replace a appointment')
  .description(dd`
  Replaces an existing appointment with the request body and
  returns the new document.
`);

router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${Appointments.name()}/${key}`;
  if (!hasPerm(req.user, permission.appointments.edit, appointmentId)) res.throw(403, 'Not authorized');
  const patchData = req.body;
  let appointment;
  try {
    Appointments.update(key, patchData);
    appointment = Appointments.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(appointment);
}, 'update')
  .pathParam('key', keySchema)
  .body(joi.object().description('The data to update the appointment with.'))
  .response(Appointment, 'The updated appointment.')
  .summary('Update a appointment')
  .description(dd`
  Patches a appointment with the request body and
  returns the updated document.
`);


router.patch(':key/approve-reject', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${Appointments.name()}/${key}`;
  if (!hasPerm(req.user, permission.appointments.approve_reject, appointmentId)) res.throw(403, 'Not authorized');
  const data = req.body;
  let appointment;
  try {
    appointment = Appointments.document(key);
    appointment.status = data.status;
    if (data.reject_reason) {
      appointment.reject_reason = data.reject_reason;
    }
    Appointments.update(key, appointment);
    appointment = Appointments.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(appointment);
}, 'replace')
    .pathParam('key', keySchema)
    .body(joi.object({
      status: joi.string().valid('Approved', 'Rejected').required(),
      reject_reason: joi.string()
    }).required(), 'Appointment data')
    .summary('Assign an appointment')
    .description(dd`
  Assign the appointment to a given doctor
`);


router.patch(':key/assign', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${Appointments.name()}/${key}`;
  if (!hasPerm(req.user, permission.appointments.edit, appointmentId)) res.throw(403, 'Not authorized');
  const data = req.body;
  let appointment;
  try {
    appointment = Appointments.document(key);
    appointment.status = 'Assigned';
    appointment.doctor = data.doctor;
    appointment.appointment_date = data.datetime;
    Appointments.update(key, appointment);
    appointment = Appointments.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(appointment);
}, 'replace')
    .pathParam('key', keySchema)
    .body(joi.object({
      doctor: joi.string().required(),
      datetime: joi.date().required()
    }).required(), 'Appointment data')
    .summary('Assign an appointment')
    .description(dd`
  Assign the appointment to a given doctor
`);


router.patch(':key/cancel', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${Appointments.name()}/${key}`;
  if (!hasPerm(req.user, permission.appointments.edit, appointmentId)) res.throw(403, 'Not authorized');
  let appointment;
  const data = req.body;
  try {
    appointment = Appointments.document(key);
    appointment.status = data.status;
    if (data.cancel_reason) {
      appointment.cancel_reason = data.cancel_reason;
    }
    Appointments.update(key, appointment);
    appointment = Appointments.document(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send(appointment);
}, 'update')
    .pathParam('key', keySchema)
    .body(joi.object({
      status: joi.string().valid('Cancelled').required(),
      cancel_reason: joi.string()
    }).description('The data to update the appointment with.'))
    .response(Appointment, 'The cancelled appointment.')
    .summary('Cancel an appointment')
    .description(dd`
  Patches a appointment with the request body and
  returns the updated document.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${Appointments.name()}/${key}`;
  if (!hasPerm(req.user, permission.appointments.delete, appointmentId)) res.throw(403, 'Not authorized');
  try {
    Appointments.remove(key);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
}, 'delete')
  .pathParam('key', keySchema)
  .response(null)
  .summary('Remove a appointment')
  .description(dd`
  Deletes a appointment from the database.
`);
