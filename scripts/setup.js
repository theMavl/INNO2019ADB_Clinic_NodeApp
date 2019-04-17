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
  "users",
  "usergroups"
];
const edgeCollections = [
  "hasPerm",
  "memberOf",
  "patient_profile",
  "staff_profile"
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

const users = module.context.collection('users');
users.ensureIndex({
  type: 'hash',
  fields: ['username'],
  unique: true
});
