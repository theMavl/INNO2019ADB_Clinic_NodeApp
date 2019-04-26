'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const sessionMiddleware = require('@arangodb/foxx/sessions');
const cookieTransport = require('@arangodb/foxx/sessions/transports/cookie');

const permission = require('../util/permissions');
const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');

const Appointment = require('../models/appointment');
const Enumerators = require('../models/enumerators');

const patients = module.context.collection('Patients');
const staff = module.context.collection('Staff');
const appointments = module.context.collection('Appointments');
const perms = module.context.collection('hasPerm');

const keySchema = joi.string().required()
  .description('The key of the appointment');

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

router.tag('appointment');

router.get(restrict(permission.appointments.view), function (req, res) {
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  res.send(appointments.all());
}, 'list')
  .response([Appointment], 'A list of Appointments.')
  .summary('List all Appointments')
  .description(dd`
  Retrieves a list of all Appointments. Permission '${permission.appointments.view}' is required.
`);


router.get('/rejected', function (req, res) {
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.user, permission.appointments.view)) res.throw(403, 'Forbidden');
  res.send(appointments.byExample({ 'status': 'Rejected' }));
}, 'list')
  .response([Appointment], 'A list of rejected Appointments.')
  .summary('List all rejected Appointments')
  .description(dd`
  Retrieves a list of all rejected Appointments. Permission '${permission.appointments.view}' is required.
`);


router.post(restrict(permission.appointments.create), function (req, res) {
  const appointment = req.body;
  const patient = patients.firstExample("_id", req.session.uid);
  if (!patient) res.throw(412, 'Not a patient!');
  let meta;
  try {
    appointment.area = patient.residential_area;
    appointment.payed = false;
    appointment.status = "New";
    appointment.patient = req.session.uid;
    meta = appointments.save(appointment);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  Object.assign(appointment, meta);
  perms.save({ _from: req.session.uid, _to: appointment._id, name: permission.appointments.view });
  perms.save({ _from: req.session.uid, _to: appointment._id, name: permission.appointments.edit });
  perms.save({ _from: req.session.uid, _to: appointment._id, name: permission.appointments.cancel });
  res.status(201);
  res.set('location', req.makeAbsolute(
    req.reverse('detail', { key: appointment._key })
  ));
  res.send({ appointment_id: appointment._key });
}, 'create')
  .body(joi.object({
    symptoms: joi.array().required(),
    description: joi.string().required(),
    date_created: joi.date().required(),
    since_when: joi.date().required(),
    payment_type: joi.string().allow(Enumerators.payment_types),
  }), 'The appointment to create.')
  .response(201, joi.object({
    appointment_id: joi.string().required()
  }), 'The created appointment.')
  .error(HTTP_CONFLICT, 'The appointment already exists.')
  .summary('Create a new appointment')
  .description(dd`
  Creates a new appointment from the request body and
  returns the saved document. Permission '${permission.appointments.create}' is required.
`);




router.get(':key', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.view, appointmentId)) res.throw(403, 'Forbidden');
  let appointment;
  try {
    appointment = appointments.document(key);
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
  Retrieves a appointment by its key. Permission '${permission.appointments.view}' is required.
`);


router.get('/doctor', function (req, res) {
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.view)) res.throw(403, 'Not authorized');
  let appointments;
  try {
    const user = staff.byExample( {'_id': req.session.uid} );
    const doctor_key = user.key;
    appointments = appointments.byExample( {'doctor': doctor_key} );
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    throw e;
  }
  res.send(appointments);
}, 'detail')
    .response([Appointment], 'A list of Appointments of a particular doctor.')
    .summary('Fetch doctor\'s appointments')
    .description(dd`
  Retrieves a list of Appointments of a particular doctor. Permission '${permission.appointments.view}' is required.
`);


router.put(':key', function (req, res) {
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.edit)) res.throw(403, 'Forbidden');
  const key = req.pathParams.key;
  const appointment = req.body;
  let meta;
  try {
    meta = appointments.replace(key, appointment);
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
  returns the new document. Permission '${permission.appointments.edit}' is required.
`);

router.patch(':key', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointment.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.edit)) res.throw(403, 'Forbidden');
  let meta;
  try {
    const appointment = appointments.firstExample({'_key': key});
    const doctor = staff.firstExample({'_key': req.body.doctor});
    if ((!doctor) || (!doctor.designation) || doctor.designation != "Doctor") res.throw(412, 'Not a doctor! '+req.body.doctor);
    appointment.doctor = doctor._id;
    appointment.assigned_datetime = req.body.datetime;
    appointment.status = "Assigned";
    meta = appointments.replace(key, appointment);
    Object.assign(appointment, meta);
    perms.removeByExample({ _from: appointment.patient, _to: appointment._id, name: permission.appointments.edit });
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send({ success: true });
}, 'replace')
  .pathParam('key', keySchema)
  .body(joi.object().description('The data to update the appointment with.'))
  .response(Appointment, 'The updated appointment.')
  .summary('Update a appointment')
  .description(dd`
  Patches a appointment with the request body and
  returns the updated document. Permission '${permission.appointments.edit}' is required.
`);


router.patch(':key/approve', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.approve_reject, appointmentId)) res.throw(403, 'Not authorized');
  const data = req.body;
  let appointment;
  try {
    appointment = appointments.document(key);
    appointment.status = data.status;
    if (data.reject_reason) {
      appointment.reject_reason = data.reject_reason;
    }
    appointments.update(key, appointment);
    appointment = appointments.document(key);
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
      status: joi.string().valid('Approved').required(),
      reject_reason: joi.string()
    }).required(), 'Appointment data')
    .summary('Approve an appointment')
    .description(dd`
  Approve an appointment by a doctor. Permission '${permission.appointments.approve_reject}' is required.
`);


router.patch(':key/reject', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.approve_reject, appointmentId)) res.throw(403, 'Not authorized');
  const data = req.body;
  let appointment;
  try {
    appointment = appointments.document(key);
    appointment.status = data.status;
    if (data.reject_reason) {
      appointment.reject_reason = data.reject_reason;
    }
    appointments.update(key, appointment);
    appointment = appointments.document(key);
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
      status: joi.string().valid('Rejected').required(),
      reject_reason: joi.string()
    }).required(), 'Appointment data')
    .summary('Reject an appointment')
    .description(dd`
  Reject an appointment by a doctor. Permission '${permission.appointments.approve_reject}' is required.
`);


router.patch(':key/assign', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.assign, appointmentId)) res.throw(403, 'Forbidden');
  const data = req.body;
  let appointment;
  try {
    appointment = appointments.document(key);
    appointment.status = 'Assigned';
    appointment.doctor = data.doctor;
    appointment.appointment_date = data.datetime;
    appointments.update(key, appointment);
    appointment = appointments.document(key);
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
  Assign the appointment to a given doctor. Permission '${permission.appointments.assign}' is required.
`);


router.patch(':key/cancel', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.cancel, appointmentId)) res.throw(403, 'Forbidden');
  let appointment;
  const data = req.body;
  try {
    appointment = appointments.document(key);
    appointment.status = "Cancelled";
    appointment.cancel_reason = req.body.reason;
    // TODO: Remove from timetable
    appointments.update(key, appointment);
    appointment = appointments.document(key);
    perms.removeByExample({ _from: appointment.patient, _to: appointment._id, name: permission.appointments.edit });
    perms.removeByExample({ _from: appointment.patient, _to: appointment._id, name: permission.appointments.cancel });
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send({success: true});
}, 'update')
  .pathParam('key', keySchema)
  .body(joi.object({
    reason: joi.string().required()
  }).description('Reason for cancelling the appointment.'))
  .summary('Cancel an appointment')
  .description(dd`
  Patches a appointment with the request body and
  returns the updated document. Permission '${permission.appointments.cancel}' is required.
`);


router.delete(':key', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.delete, appointmentId)) res.throw(403, 'Forbidden');
  try {
    appointments.remove(key);
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
  Deletes a appointment from the database. Permission '${permission.appointments.delete}' is required.
`);


router.patch(':key/pay', function (req, res) {
  const key = req.pathParams.key;
  const appointmentId = `${appointments.name()}/${key}`;
  if (!req.session.uid) res.throw(401, 'Unauthorized');
  if (!hasPerm(req.session.uid, permission.appointments.edit, appointmentId)) res.throw(403, 'Forbidden');
  let appointment;
  const data = req.body;
  try {
    appointment = appointments.document(key);
    appointment.payed = true;
    appointments.update(key, appointment);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message);
    }
    if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
      throw httpError(HTTP_CONFLICT, e.message);
    }
    throw e;
  }
  res.send({success: true});
}, 'update')
  .pathParam('key', keySchema)
  .summary('Pay for an appointment')
  .description(dd`
  End-point for payment operation. Permission '${permission.appointments.edit}' is required.
`);