import { suite, test } from 'node:test'
import assert from 'node:assert/strict'

import Table from '@ludlovian/memdb'

suite('Table', () => {
  const cols = 'k1,k2,foo'
  const key = 'k1,k2'
  test('table creation', () => {
    const t = new Table({ cols, key })
    assert.deepStrictEqual(t.cols, ['k1', 'k2', 'foo'])
    assert.deepStrictEqual(t.key, ['k1', 'k2'])
  })

  test('add delete update via table', () => {
    const t = new Table({ cols, key })

    const r = t.add({ k1: 1, k2: 2, foo: 'bar' })
    assert.deepStrictEqual({ ...r }, { k1: 1, k2: 2, foo: 'bar' })

    t.update(r, { foo: 'baz' })
    assert.deepStrictEqual({ ...r }, { k1: 1, k2: 2, foo: 'baz' })

    t.delete(r)
  })

  test('find a row', () => {
    const t = new Table({ cols, key })

    const r1 = t.add({ k1: 1, k2: 2, foo: 'bar' })

    const r2 = t.find({ k1: 1, k2: 2 })
    assert.strictEqual(r1, r2)

    const r3 = t.find({ k1: 1, k2: 3 })
    assert.strictEqual(r3, null)

    const r4 = t.find({ k1: 2, k2: 2 })
    assert.strictEqual(r4, null)
  })

  test('update using get and row methods', () => {
    const t = new Table({ cols, key })

    let r = t.get({ k1: 1, k2: 2 }).set({ foo: 'bar' })
    assert.deepStrictEqual({ ...r }, { k1: 1, k2: 2, foo: 'bar' })

    r = r.set({ foo: 'baz' })
    assert.deepStrictEqual({ ...r }, { k1: 1, k2: 2, foo: 'baz' })

    r = r.delete()
    assert.strictEqual(r, null)
    assert.strictEqual(t.find({ k1: 1, k2: 2 }), null)
  })

  test('changes recorded', () => {
    const t = new Table({ cols, key })

    const r = t.get({ k1: 1, k2: 2 }).set({ foo: 'bar' })

    let changes = t.changes
    assert(changes.added.has(r))
    assert(changes.changed.size === 0)
    assert(changes.deleted.size === 0)
    assert(changes.untouched.size === 0)

    t.resetChanges()

    // NOOP change
    r.set({ foo: 'bar' })
    changes = t.changes
    assert(changes.added.size === 0)
    assert(changes.changed.size === 0)
    assert(changes.deleted.size === 0)
    assert(changes.untouched.has(r))

    // change
    r.set({ foo: 'baz' })
    changes = t.changes
    assert(changes.added.size === 0)
    assert(changes.changed.has(r))
    assert(changes.deleted.size === 0)
    assert(changes.untouched.size === 0)

    // delete
    r.delete()
    changes = t.changes
    assert(changes.added.size === 0)
    assert(changes.changed.size === 0)
    assert(changes.deleted.has(r))
    assert(changes.untouched.size === 0)
  })

  test('data sorts', () => {
    const t = new Table({ cols, key })

    const r1 = t.get({ k1: 2, k2: 2 }).set({ foo: 'bar' })
    const r2 = t.get({ k1: 1, k2: 2 }).set({ foo: 'baz' })
    const r3 = t.get({ k1: 2, k2: 3 }).set({ foo: 'boz' })

    const data = t.data
    assert.deepStrictEqual(data, [r2, r1, r3])
  })

  test('type & serialize', () => {
    Table.registerType('foo', {
      serialize: x => 'foo' + x,
      deserialize: x => x.slice(3)
    })

    const t = new Table({ cols: 'id, data:foo', key: 'id' })
    t.add({ id: 1, data: 'bar' })
    const data = t.serialize()
    assert.deepStrictEqual(data, [{ id: 1, data: 'foobar' }])

    t.load(data)
    assert.strictEqual(t.find({ id: 1 }).data, 'bar')
  })

  suite('errors', () => {
    test('construction', () => {
      assert.throws(() => new Table(), /Must supply table definition/)

      assert.throws(() => new Table({ key }), /No columns supplied/)

      assert.throws(
        () => new Table({ cols: cols + ',bar:baz', key }),
        /Unknown type: baz/
      )

      assert.throws(() => new Table({ cols }), /No key supplied/)

      assert.throws(
        () => new Table({ cols, key: 'baz' }),
        /No such column: baz/
      )

      assert.throws(
        () => new Table({ cols, key: '' }),
        /Key must have at least one column/
      )
    })

    test('update errors', () => {
      const t = new Table({ cols, key })
      const r = t.add({ k1: 1, k2: 2, foo: 'bar' })

      assert.throws(() => t.update({}, {}), /Not a Row/)

      assert.throws(() => t.delete({}), /Not a Row/)

      r.delete()

      assert.throws(() => t.update(r, {}), /Not a current row/)
    })
    test('primary key errors', () => {
      const t = new Table({ cols, key })
      t.add({ k1: 1, k2: 2, foo: 'bar' })

      assert.throws(() => t.find({ k1: 1 }), /Key not supplied: k2/)

      assert.throws(() => t.add({ k1: 1, k2: 2 }), /Duplicate key:/)
    })
  })
})
