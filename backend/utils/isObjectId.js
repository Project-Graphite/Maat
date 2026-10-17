const OBJECT_ID = /^[a-f0-9]{24}$/i;

export default (value) => typeof value === 'string' && OBJECT_ID.test(value);
