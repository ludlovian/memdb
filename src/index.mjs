import equal from '@ludlovian/equal'
import Debug from '@ludlovian/debug'

const assert = (ok, msg) => {
  if (!ok) throw new Error(msg)
}
const { assign, keys, entries, fromEntries } = Object
const debug = Debug('memdb:table')

export default class Table {
  static #types = { default: {} }

  // column defs
  #columns
  #key
  #sort

  // data and trackers
  #all
  #index
  #untouched
  #added
  #changed
  #deleted
  #needSort

  // ----------------------------------------------------
  //
  // Construction
  //

  constructor (defs) {
    assert(defs, 'Must supply table definition')
    assert(typeof defs.cols === 'string', 'No columns supplied')
    assert(typeof defs.key === 'string', 'No key supplied')

    this.#columns = this.#parseColumns(defs.cols)
    this.#key = this.#parseKey(defs.key)
    this.#sort = this.#makeSortFn(this.#key)
    debug('Table cols: %o key: %s', this.#columns, this.#key)

    this.clear()
  }

  // ----------------------------------------------------
  //
  // Public API
  //

  get cols () {
    return keys(this.#columns)
  }

  get key () {
    return [...this.#key]
  }

  //
  // Clear
  //
  // Clears the table and resets all change tracking
  //

  clear () {
    this.#all = new Set()
    this.#index = new Map()
    this.resetChanges()
  }

  //
  // Reset
  //
  // Resets change tracking
  //

  resetChanges () {
    this.#untouched = new Set(this.#all)
    this.#added = new Set()
    this.#changed = new Set()
    this.#deleted = new Set()
  }

  //
  // add
  //
  // Adds a row
  //

  add (data) {
    const row = new Row(data, this, keys(this.#columns), this.#key)
    this.#all.add(row)
    this.#added.add(row)
    this.#addToIndex(row)
    this.#needSort = true
    return row
  }

  //
  // update
  //
  // Updates a row with data
  //

  update (row, data) {
    assert(row instanceof Row, 'Not a Row')
    assert(this.#all.has(row), 'Not a current row')
    if (equal({ ...row }, { ...row, ...data })) return row
    assign(row, data)
    this.#untouched.delete(row)
    if (!this.#added.has(row)) this.#changed.add(row)
    return row
  }

  //
  // delete
  //
  // Deletes a row
  //

  delete_ (row) {
    assert(row instanceof Row, 'Not a Row')
    assert(this.#all.has(row), 'Not a current row')
    this.#all.delete(row)
    this.#deleted.add(row)
    this.#added.delete(row)
    this.#changed.delete(row)
    this.#untouched.delete(row)
    this.#removeFromIndex(row)
    return null
  }

  //
  // find
  //
  // Finds a row, if we have it, or null if not
  //
  find (keyData) {
    return this.#seek(keyData)
  }

  //
  // get
  //
  // Like, find but adds a new row for this key if we
  // do not have it
  //
  get_ (keyData) {
    const row = this.find(keyData)
    return row ?? this.add(keyData)
  }

  //
  // data
  //
  // Returns all the data
  //
  get data () {
    if (this.#needSort) {
      this.#all = new Set([...this.#all].sort(this.#sort))
      this.#needSort = false
    }
    return [...this.#all]
  }

  //
  // changes
  //
  // Returns { added, changed, deleted, untouched }
  //
  get changes () {
    return {
      added: new Set(this.#added),
      changed: new Set(this.#changed),
      deleted: new Set(this.#deleted),
      untouched: new Set(this.#untouched)
    }
  }

  //
  // Serializes
  //
  // serliazies to an array of POJOs applying any 'serialize'
  // function to the properties/columns
  //
  serialize () {
    debug('saved %d rows', this.#all.size)
    return this.data.map(row => this.#serialize(row))
  }

  // deserialize (ie load) from a list of POJOs, applying
  // any type conversion

  load (data) {
    this.clear()
    data.forEach(obj => this.add(this.#deserialize(obj)))
    debug('loaded from %d rows', data.length)
    this.resetChanges()
  }

  //
  // Type registration
  //

  static registerType (name, { serialize, deserialize } = {}) {
    Table.#types[name] = { serialize, deserialize }
    debug('New type registered: $s', name)
  }

  // ----------------------------------------------------
  //
  // Internal helpers
  //

  // ----------------------------------------------------
  //
  // Construction
  //
  #parseColumns (colString) {
    return fromEntries(
      colString
        .split(/[ ,]/)
        .filter(Boolean)
        .map(colDef => {
          if (!colDef.includes(':')) colDef += ':default'
          const [name, type] = colDef.split(':')
          assert(type in Table.#types, `Unknown type: ${type}`)
          return [name, type]
        })
    )
  }

  #parseKey (keyString) {
    const key = keyString.split(/[ ,]/).filter(Boolean)
    key.forEach(col => assert(col in this.#columns, `No such column: ${col}`))
    assert(key.length, 'Key must have at least one column')
    return key
  }

  #makeSortFn (key) {
    return (a, b) => {
      for (const col of key) {
        const va = a[col]
        const vb = b[col]
        if (va < vb) return -1
        if (va > vb) return 1
        // we can never end the loop if the primary key log is working...
        /* c8 ignore start */
      }
      return 0
      /* c8 ignore stop */
    }
  }

  // ----------------------------------------------------
  //
  // Index
  //

  #seek (keyData) {
    let nKey = this.#key.length
    let ix = this.#index
    let row = null
    for (const col of this.#key) {
      assert(col in keyData, 'Key not supplied: ' + col)
      const key = keyData[col]
      if (--nKey) {
        ix = ix.get(key)
        if (!ix) break
      } else {
        row = ix.get(key) ?? null
      }
    }
    return row
  }

  #addToIndex (data) {
    let ix = this.#index
    let nKey = this.#key.length
    for (const col of this.#key) {
      assert(col in data, 'Key not supplied: ' + col)
      const key = data[col]
      if (--nKey) {
        ix = ix.get(key) ?? ix.set(key, new Map()).get(key)
      } else {
        if (ix.has(key)) {
          assert(false, `Duplicate key: ${JSON.stringify(data)}`)
        }
        ix.set(key, data)
      }
    }
  }

  #removeFromIndex (keyData) {
    let nKey = this.#key.length
    let ix = this.#index
    let removed = false
    for (const col of this.#key) {
      // should never happen
      assert(col in keyData, 'Key not supplied: ' + col)
      const key = keyData[col]
      if (--nKey) {
        ix = ix.get(key)
        // can only happen if we haev previously stored
        // an invalid primary key
        /* c8 ignore start */
        if (!ix) break
        /* c8 ignore stop */
      } else {
        removed = ix.delete(key)
      }
    }
    return removed
  }

  // ----------------------------------------------------
  //
  // Serialize
  //

  #serialize (row) {
    const obj = {}
    for (const [col, type] of entries(this.#columns)) {
      const fn = Table.#types[type].serialize
      obj[col] = fn ? fn(row[col]) : row[col]
    }
    return obj
  }

  #deserialize (obj) {
    const data = {}
    for (const [col, type] of entries(this.#columns)) {
      const fn = Table.#types[type].deserialize
      data[col] = fn ? fn(obj[col]) : obj[col]
    }
    return data
  }
}

class Row {
  #table
  constructor (data, table, cols, keys) {
    this.#table = table
    const defs = {}
    const enumerable = true
    cols.forEach(col => {
      defs[col] = { enumerable, value: data[col], writable: true }
    })
    keys.forEach(col => {
      assert(col in data, 'Missing key: ' + col)
      defs[col].writable = false
    })
    Object.defineProperties(this, defs)
    Object.preventExtensions(this)
  }

  set_ (data) {
    return this.#table.update(this, data)
  }

  delete_ () {
    return this.#table.delete(this)
  }
}

function fixPrototype (p) {
  for (const fn of ['get', 'set', 'delete']) {
    const fn_ = fn + '_'
    if (fn_ in p) p[fn] = p[fn_]
  }
}
fixPrototype(Table.prototype)
fixPrototype(Row.prototype)
