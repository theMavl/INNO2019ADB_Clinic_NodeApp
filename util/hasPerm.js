'use strict';
const db = require('@arangodb').db;
const aql = require('@arangodb').aql;
const hasPerm = module.context.collection('hasPerm');
const memberOf = module.context.collection('memberOf');
const patients = module.context.collection('Patients');
const staff = module.context.collection('Staff');

module.exports = function (user_id, name, objectId) {
  let user = patients.firstExample("_id", user_id);
  if (!user)
    user = staff.firstExample("_id", user_id);

  print(user_id, user);
  if (!user) return false;

  print(user.perms);
  if (user.perms)
    if (user.perms.includes(name) || user.perms.includes("all")) return true;
  if (objectId && hasPerm.firstExample({
    _from: user._id,
    _to: objectId,
    name
  })) return true;
  const groupHasPerm = db._query(aql`
    FOR group IN 1..100 OUTBOUND ${user._id} ${memberOf}
    FILTER ${name} IN group.perms
    LIMIT 1
    RETURN true
  `).next() || false;
  if (groupHasPerm || !objectId) return groupHasPerm;
  return db._query(aql`
    LET groupIds = (
      FOR group IN 1..100 OUTBOUND ${user._id} ${memberOf}
      RETURN group._id
    )
    FOR perm IN ${hasPerm}
    FILTER perm.name == ${name}
    && perm._from IN groupIds
    && perm._to == ${objectId}
    LIMIT 1
    RETURN true
  `).next() || false;
};
