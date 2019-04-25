'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const errors = require('@arangodb').errors;
const createRouter = require('@arangodb/foxx/router');
const sessionMiddleware = require('@arangodb/foxx/sessions');
const cookieTransport = require('@arangodb/foxx/sessions/transports/cookie');
const db = require('@arangodb').db;
const aql = require('@arangodb').aql;

const auth = require('../util/auth');
const restrict = require('../util/restrict');
const hasPerm = require('../util/hasPerm');
const permission = require('../util/permissions');

const Staff = require('../models/staff');
const Enumerators = require('../models/enumerators');

const staff_members = module.context.collection('Staff');

const keySchema = joi.string().required()
    .description('The key of the staff');

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

router.tag('staff');

router.get(restrict(permission.staff.view), function (req, res) {
    const members = db._query(aql`FOR s IN ${staff_members} RETURN { 
        first_name: s.first_name, 
        last_name: s.last_name,
        birth_date: s.birth_date, 
        ssn: s.ssn,
        email: s.email,
        address: s.address,
        designation: s.designation,
        doctor_designation: s.doctor_designation
    }`)
    res.send(members);
}, 'list')
    .response([joi.object({
        first_name: joi.string().required(),
        last_name: joi.string().required(),
        birth_date: joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
        ssn: joi.string().regex(/^\d{3}-\d{2}-\d{4}$/).required(),
        email: joi.string().email({ minDomainAtoms: 2 }),
        address: joi.object().keys({
            zip: joi.string().required(),
            country: joi.string().required(),
            city: joi.string().required(),
            street: joi.string().required(),
            building: joi.string().required()
        }),
        designation: joi.string().valid(Enumerators.staff_designations),
        doctor_designation: joi.string().valid(Enumerators.doctor_designations)
    })], 'A list of StaffItems.')
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
    print("STAFF AUTH " + member._key, +" " + member)
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

router.post('/login_sqa', function (req, res) {
    let member = {};
    member = staff_members.firstExample({ "_key": req.body.login });
    if (!member)
        member = staff_members.firstExample({ "email": req.body.login });
    let ans = member.security_question.answer;

    // print question
    let ques = member.security_question.question;
    console.log(ques);

    const valid = (ans === req.body.answer);

    if (!valid) res.throw('unauthorized');
    print("STAFF AUTH " + member._key, +" " + member)
    req.session.uid = member._id;
    req.sessionStorage.save(req.session);
    print(req.session)
    res.send({ sucess: true });
})
    .body(joi.object({
        login: joi.string().required(),
        answer: joi.string().required()
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
        }),
        security_question: joi.object().keys({
            question: joi.string().required(),
            answer: joi.string().required()
        })
    }).required(), 'Credentials')
    .description('Creates a new staff member and logs them in.');

router.post(function (req, res) {
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.user, permission.staff.create)) res.throw(403, 'Forbidden');
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
    const staffId = `${staff_members.name()}/${key}`;
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.user, permission.staff.view, staffId)) res.throw(403, 'Forbidden');
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
    const staffId = `${staff_members.name()}/${key}`;
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.user, permission.staff.edit, staffId)) res.throw(403, 'Forbidden');
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
    const staffId = `${staff_members.name()}/${key}`;
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.user, permission.staff.edit, staffId)) res.throw(403, 'Forbidden');
    const super_admin = hasPerm(req.user._id, 'all');
    const patchData = req.body;
    let member;
    try {
        if (super_admin) {
            patchData.authData = auth.create(member.password);
        } else {
            delete patchData.authData;
        }
        delete patchData.password;
        staff_members.update(key, patchData);
        member = staff_members.document(key);
    } catch (e) {
        if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
            throw httpError(HTTP_NOT_FOUND, e.message);
        }
        if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
            throw httpError(HTTP_CONFLICT, e.message);
        }
        throw e;
    }
    if (!super_admin) {
        delete member.perms;
        delete member.authData;
    }
    res.send(member);
}, 'update')
    .pathParam('key', keySchema)
    .body(joi.object().description('The data to update the member with.'))
    .response(Staff, 'The updated member.')
    .summary('Update a member')
    .description(dd`
  Patches a member with the request body and
  returns the updated document.
`);

router.delete(':key', function (req, res) {
    const key = req.pathParams.key;
    const staffId = `${staff_members.name()}/${key}`;
    if (!req.session.uid) res.throw(401, 'Unauthorized');
    if (!hasPerm(req.user, permission.staff.delete, staffId)) res.throw(403, 'Forbidden');
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

