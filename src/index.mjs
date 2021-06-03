export default class Table {
  constructor ({ onsave, main, factory } = {}) {
    this._data = new Set()
    this._changed = new Set()
    this._deleted = new Set()
    this._ix = {}
    this.onsave = onsave
    this.factory = factory
    if (main) this.addUniqueIndex('main', main)
  }

  load (source) {
    this._data.clear()
    this._changed.clear()
    this._deleted.clear()
    for (const k in this._ix) this._ix[k].clear()
    for (const row of source) {
      this._data.add(row)
      for (const k in this._ix) this._ix[k].add(row)
    }
  }

  addIndex (k, fn) {
    const ix = (this._ix[k] = new Index(fn))
    for (const row of this._data) ix.add(row)
  }

  addUniqueIndex (k, fn) {
    const ix = (this._ix[k] = new UniqueIndex(fn))
    for (const row of this._data) ix.add(row)
  }

  get (k, data) {
    const ix = this._ix[k]
    if (!ix) throw new Error('No such index: ' + k)
    return ix.get(data)
  }

  upsert (data) {
    if (data[Symbol.iterator]) {
      return [...data].map(d => this.upsert(d))
    }

    if (this._ix.main) {
      const row = this._ix.main.get(data)
      if (row) {
        for (const k in this._ix) this._ix[k].delete(row)
        Object.assign(row, data)
        for (const k in this._ix) this._ix[k].add(row)
        this._changed.add(row)
        return row
      }
    }
    const Factory = this.factory || Object
    const row = new Factory()
    Object.assign(row, data)
    this._data.add(row)
    this._changed.add(row)
    for (const k in this._ix) this._ix[k].add(row)
    return row
  }

  delete (data) {
    if (data[Symbol.iterator]) {
      return [...data].map(d => this.delete(d))
    }

    if (this._ix.main) {
      const row = this._ix.main.get(data)
      if (row) {
        for (const k in this._ix) this._ix[k].delete(row)
        this._data.delete(row)
        this._changed.delete(row)
        this._deleted.add(row)
        return row
      }
    }
  }

  save () {
    const changed = new Set(this._changed)
    const deleted = new Set(this._deleted)
    this._changed.clear()
    this._deleted.clear()
    if (this.onsave) return this.onsave(changed, deleted)
  }

  all () {
    return this._data.values()
  }
}

export class Index {
  constructor (fn) {
    this.fn = fn
    this.map = new Map()
  }

  clear () {
    this.map.clear()
  }

  add (row) {
    const key = this.fn(row)
    const entry = this.map.get(key)
    if (entry) entry.add(row)
    else this.map.set(key, new Set([row]))
  }

  delete (row) {
    const key = this.fn(row)
    const entry = this.map.get(key)
    entry.delete(row)
    if (!entry.size) this.map.delete(key)
  }

  get (data) {
    const key = this.fn(data)
    return this.map.get(key) || new Set()
  }
}

export class UniqueIndex extends Index {
  add (row) {
    const key = this.fn(row)
    this.map.set(key, row)
  }

  delete (row) {
    const key = this.fn(row)
    this.map.delete(key)
  }

  get (data) {
    const key = this.fn(data)
    return this.map.get(key)
  }
}
