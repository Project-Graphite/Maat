export default (obj, ...fields) => {
    const picked = {};
    if (!obj || typeof obj !== 'object') return picked;
    for (const field of fields) {
        if (obj[field] !== undefined) picked[field] = obj[field];
    }
    return picked;
};
