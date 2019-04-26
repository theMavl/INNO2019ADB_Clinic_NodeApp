'use strict';
const db = require('@arangodb').db;
const documentCollections = [
  "sessions",
  "Appointments",
  "HomeRemedies",
  "LeaveApply",
  "Patients",
  "Staff",
  "Tips",
  "Visitors",
  "Addresses",
  "Users",
  "Usergroups"
];
const edgeCollections = [
  "hasPerm",
  "memberOf",
  "isAppointed"
];

for (const localName of documentCollections) {
  const qualifiedName = module.context.collectionName(localName);
  if (!db._collection(qualifiedName)) {
    db._createDocumentCollection(qualifiedName);
  } else if (module.context.isProduction) {
    console.debug(`collection ${qualifiedName} already exists. Leaving it untouched.`)
  }
}

for (const localName of edgeCollections) {
  const qualifiedName = module.context.collectionName(localName);
  if (!db._collection(qualifiedName)) {
    db._createEdgeCollection(qualifiedName);
  } else if (module.context.isProduction) {
    console.debug(`collection ${qualifiedName} already exists. Leaving it untouched.`)
  }
}

const staff = module.context.collection('Staff');
const memberOf = module.context.collection('memberOf');
const usergroups = module.context.collection('Usergroups');
const patients = module.context.collection('Patients');
const appointments = module.context.collection('Appointments');
const tips = module.context.collection('Tips');
const leave_apply = module.context.collection('LeaveApply');

patients.ensureIndex({
  type: 'hash',
  fields: ['email'],
  unique: true
});

patients.ensureIndex({
  type: 'hash',
  fields: ['first_name', 'last_name']
});

patients.ensureIndex({ 
  type: "geo", 
  fields: [ "residential_area" ] 
});

staff.ensureIndex({
  type: 'hash',
  fields: ['email'],
  unique: true
});

staff.ensureIndex({
  type: 'hash',
  fields: ['first_name', 'last_name']
});

usergroups.ensureIndex({
  type: 'hash',
  fields: ['name'],
  unique: true
});

appointments.ensureIndex({ 
  type: 'geo', 
  fields: ['area'] 
});

appointments.ensureIndex({ 
  type: 'skiplist', 
  fields: ['since_when', 'date_created'] 
});

tips.ensureIndex({ 
  type: 'fulltext', 
  fields: ['name'], 
  minLength: 3 
});

leave_apply.ensureIndex({
  type: 'hash',
  fields: ['member'],
  unique: false
})

const auth = require('../util/auth');
try {
  const admin = { email: "admin", perms: ["all"] };
  admin.authData = auth.create("clinicc");
  const meta = staff.save(admin);

  Object.assign(admin, meta);
  print("Admin creator: done");
} catch (e) {
  print("Admin creator: " + e);
}

const group_overseer = { name: "overseer", perms: ["view_patients"] };
const group_patient = { name: "patient", perms: ["view_doctors", "add_appointments"] };
const group_doctor = { name: "doctor", perms: ["approve_reject_appointments", "view_appointments"] };
const overseer = { email: "overseer" };

try {
  const meta_pa = usergroups.save(group_patient);
  Object.assign(group_patient, meta_pa);
  print("Patient Group creator: done");

  const meta_go = usergroups.save(group_overseer);
  Object.assign(group_overseer, meta_go);
  print("Overseer Group creator: done");

  const meta_do = usergroups.save(group_doctor);
  Object.assign(group_doctor, meta_do);
  print("Doctor Group creator: done");
} catch (e) {
  print("Doctor Group creator: " + e);
}
try {
  overseer.authData = auth.create("clinicc");
  const meta_o = staff.save(overseer);
  Object.assign(overseer, meta_o);
  print("Overseer creator: done");
} catch (e) {
  print("Overseer creator: " + e);
}

try {
  memberOf.save({ _from: overseer._id, _to: group_overseer._id });
  print("Overseer linker: done");
} catch (e) {
  print("Overseer linker: " + e);
}