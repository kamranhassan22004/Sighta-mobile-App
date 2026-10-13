// Isolated controller tests: real Mongoose schemas, in-memory persistence doubles.
// This deliberately never connects to MongoDB or loads .env.
const mongoose = require("mongoose");
const clone = value => structuredClone(value);
const plain = value => value?.toObject ? value.toObject() : value;
const comparable = value => value instanceof Date ? value.getTime() : String(value);
const equal = (a, b) => a == null && b == null || comparable(a) === comparable(b);
const values = (object, path) => {
  const parts = path.split(".");
  let items = [object];
  for (const part of parts) items = items.flatMap(item => {
    if (Array.isArray(item)) return item.map(entry => entry?.[part]);
    return [item?.[part]];
  });
  return items;
};
const matches = (row, query = {}) => Object.entries(query).every(([key, condition]) => {
  if (key === "$or") return condition.some(q => matches(row, q));
  if (key === "$and") return condition.every(q => matches(row, q));
  const found = values(row, key);
  const flattened = found.flat();
  if (condition && typeof condition === "object" && !(condition instanceof Date) &&
      Object.keys(condition).some(k => k.startsWith("$"))) {
    return Object.entries(condition).every(([op, operand]) => {
      if (op === "$elemMatch") return found.some(v => Array.isArray(v) && v.some(entry => matches(entry, operand)));
      if (op === "$ne") return !flattened.some(v => equal(v, operand));
      if (op === "$in") return flattened.some(v => operand.some(o => equal(v, o)));
      if (op === "$nin") return !flattened.some(v => operand.some(o => equal(v, o)));
      if (op === "$exists") return flattened.some(v => v !== undefined) === operand;
      return flattened.some(v => {
        const a = comparable(v), b = comparable(operand);
        return op === "$gte" ? a >= b : op === "$lte" ? a <= b : op === "$gt" ? a > b : a < b;
      });
    });
  }
  return flattened.some(v => equal(v, condition));
});
const normalize = row => JSON.parse(JSON.stringify(plain(row)), (key, value) => {
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value);
  return value;
});

const install = Model => {
  const rows = [];
  const hydrate = row => {
    const document = new Model(clone(row));
    document.save = async () => {
      await document.validate();
      const index = rows.findIndex(r => equal(r._id, document._id));
      rows[index] = normalize(document);
      return document;
    };
    return document;
  };
  const query = (filter, many = false) => {
    let sort, skip = 0, limit = Infinity, lean = false, selection;
    const result = {
      select(value) { selection = value; return this; },
      sort(value) { sort = value; return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      lean() { lean = true; return this; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          let selected = rows.filter(r => matches(r, filter));
          if (sort) {
            const [field, direction] = Object.entries(sort)[0];
            selected.sort((a, b) => (comparable(a[field]) > comparable(b[field]) ? 1 : -1) * direction);
          }
          selected = selected.slice(skip, skip + limit).map(row => {
            const doc = hydrate(row);
            if (selection) for (const field of selection.split(" ")) {
              if (field.startsWith("-")) doc.set(field.slice(1), undefined);
            }
            return lean ? doc.toObject() : doc;
          });
          return many ? selected : selected[0] || null;
        }).then(resolve, reject);
      },
    };
    return result;
  };
  const setPath = (row, path, value, filter, options) => {
    const parts = path.split(".");
    let target = row;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part === "$") {
        target = target.find(entry => matches(entry, filter.invitations?.$elemMatch || { guardian: filter["invitations.guardian"] }));
      } else if (part.startsWith("$[")) {
        const guardian = options.arrayFilters[0]["invitation.guardian"];
        target = target.find(entry => equal(entry.guardian, guardian));
      } else target = target[part] ??= {};
      if (!target) return;
    }
    target[parts.at(-1)] = normalize(value);
  };
  const update = (row, changes, filter, options = {}) => {
    for (const [key, value] of Object.entries(changes.$set || {})) setPath(row, key, value, filter, options);
    for (const key of Object.keys(changes.$unset || {})) delete row[key];
    for (const [key, value] of Object.entries(changes.$push || {})) (row[key] ??= []).push(normalize(value));
    for (const [key, value] of Object.entries(changes.$addToSet || {})) {
      const array = row[key] ??= [];
      if (!array.some(entry => equal(entry, value))) array.push(String(value));
    }
    for (const [key, value] of Object.entries(changes.$pull || {})) row[key] = (row[key] || []).filter(entry => !equal(entry, value));
  };
  Model.find = filter => query(filter, true);
  Model.findOne = filter => query(filter);
  Model.findById = id => query({ _id: id });
  Model.exists = async filter => rows.some(row => matches(row, filter)) ? { _id: "found" } : null;
  Model.countDocuments = async filter => rows.filter(row => matches(row, filter)).length;
  Model.create = async payload => {
    const doc = new Model(payload);
    await doc.validate();
    const row = normalize(doc);
    const duplicate = Model.schema.indexes().some(([fields, options]) => options.unique && rows.some(old =>
      Object.keys(fields).every(field => equal(old[field], row[field]))));
    if (duplicate || (Model.modelName === "Device" && rows.some(r => r.deviceId === row.deviceId))) {
      throw Object.assign(new Error("Duplicate"), { code: 11000 });
    }
    rows.push(row);
    return hydrate(row);
  };
  Model.updateOne = async (filter, changes, options) => {
    const row = rows.find(r => matches(r, filter));
    if (!row) return { matchedCount: 0 };
    update(row, changes, filter, options);
    return { matchedCount: 1 };
  };
  Model.updateMany = async (filter, changes) => {
    for (const row of rows.filter(r => matches(r, filter))) update(row, changes, filter);
  };
  Model.findOneAndUpdate = async (filter, changes, options = {}) => {
    let row = rows.find(r => matches(r, filter));
    if (!row && options.upsert) {
      const created = await Model.create({ ...filter, ...changes.$set });
      row = rows.find(r => equal(r._id, created._id));
    }
    if (!row) return null;
    update(row, changes, filter, options);
    return hydrate(row);
  };
  Model.findByIdAndUpdate = (id, changes) => Model.findOneAndUpdate({ _id: id }, { $set: changes });
  Model.deleteOne = async filter => {
    const index = rows.findIndex(r => matches(r, filter));
    if (index >= 0) rows.splice(index, 1);
  };
  return rows;
};
module.exports = { install, matches };
