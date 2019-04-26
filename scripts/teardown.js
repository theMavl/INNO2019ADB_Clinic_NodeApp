'use strict';
const db = require('@arangodb').db;
const collections = [
  "sessions",
  "Appointments",
  "isAppointed",
  "HomeRemedies",
  "LeaveApply",
  "Patients",
  "Staff",
  "Tips",
  "Visitors",
  "Usergroups",
  "hasPerm",
  "memberOf"
];

for (const localName of collections) {
  const qualifiedName = module.context.collectionName(localName);
  db._drop(qualifiedName);
}
