const MAX_SEARCH_LENGTH = 60;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asString = (value) => (typeof value === 'string' ? value : undefined);

const squash = (text) => text.toLowerCase().replace(/\s+/g, '');
const spacedPattern = (word) => [...word].map(escapeRegex).join('\\s*');

const closeness = (value, wanted) => {
    const text = squash(String(value ?? ''));
    if (text === wanted) return 0;
    if (text.startsWith(wanted)) return 1;
    if (text.includes(wanted)) return 2;
    return 3;
};

export default class APIFeatures {
	constructor(query, queryString, options) {
        this.query = query;
        this.queryString = queryString;
        this.options = options;
        this.conditions = { ...query.getFilter() };
        this.page = 1;
        this.limit = options.defaultLimit;
    }

    search() {
        const field = this.options.searchable;
        const text = (asString(this.queryString.search) || '').trim().slice(0, MAX_SEARCH_LENGTH);
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length) {
            this.searchText = squash(text);
            const condition = {
                $and: words.map((word) => ({ [field]: { $regex: spacedPattern(word), $options: 'i' } })),
            };
            Object.assign(this.conditions, condition);
            this.query = this.query.find(condition);
        }
        return this;
    }

    sort() {
        const requested = (asString(this.queryString.sort) || '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => this.options.sortable.includes(s.replace(/^-/, '')));
        const sortBy = requested.length ? requested.join(' ') : this.options.defaultSort;
        this.query = this.query.sort(`${sortBy} -_id`).collation({ locale: 'en', strength: 2 });
        return this;
    }

    paginate() {
        const page = parseInt(asString(this.queryString.page), 10);
        const limit = parseInt(asString(this.queryString.limit), 10);
        this.page = Number.isInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
        this.limit =
            Number.isInteger(limit) && limit > 0
                ? Math.min(limit, this.options.maxLimit)
                : this.options.defaultLimit;
        if (!this.searchText) this.query = this.query.skip((this.page - 1) * this.limit).limit(this.limit);
        return this;
    }

    async results() {
        if (!this.searchText) {
            return Promise.all([this.query, this.query.model.countDocuments(this.conditions)]);
        }
        const field = this.options.searchable;
        const ranked = (await this.query)
            .map((doc) => ({ doc, rank: closeness(doc[field], this.searchText) }))
            .sort((a, b) => a.rank - b.rank)
            .map(({ doc }) => doc);
        const start = (this.page - 1) * this.limit;
        return [ranked.slice(start, start + this.limit), ranked.length];
    }
}
