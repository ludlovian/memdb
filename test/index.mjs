import { test } from 'uvu'
import * as assert from 'uvu/assert'

import Table from '../src/index.mjs'

test.before(ctx => {
  ctx.Row = class Row {}
  ctx.save = {}
  ctx.t = new Table({
    main: x => x.id,
    factory: ctx.Row,
    onsave (changed, deleted) {
      Object.assign(ctx.save, { changed, deleted })
      return ctx.save.return
    }
  })

  ctx.t.addIndex('foo', x => String(x.foo))

  ctx.getData = () =>
    [
      { id: 1, foo: 'bar' },
      { id: 2, foo: 'baz' },
      { id: 3, foo: 'baz' }
    ].map(row => Object.assign(new ctx.Row(), row))
})

test('load data', ({ t, getData }) => {
  t.load(getData())

  assert.is([...t.all()].length, 3)
})

test('save after load has no changes', ({ t, save }) => {
  t.save()

  assert.is(save.changed.size, 0)
  assert.is(save.deleted.size, 0)
})

test('get from unique index', ({ t, Row }) => {
  const r = t.get({ id: 1 })
  assert.is(r instanceof Row, true)
  assert.equal({ ...r }, { id: 1, foo: 'bar' })
})

test('get from non-unique index', ({ t, Row }) => {
  const rows = Array.from(t.get({ foo: 'baz' }, 'foo'))

  rows.sort((a, b) => a.id - b.id)
  assert.is(rows.length, 2)
  assert.equal(
    rows.map(x => x.id),
    [2, 3]
  )
})

test('update existing row', ({ t, Row }) => {
  t.upsert({ id: 2, quux: true })
  const r = t.upsert({ id: 2, foo: 'bar' })

  assert.is(r instanceof Row, true)
  assert.equal({ ...r }, { id: 2, foo: 'bar', quux: true })
})

test('save identified changed row', ({ t, Row, save }) => {
  save.return = 17
  const r = t.save()
  assert.is(r, 17)
  assert.is(save.changed.size, 1)
  assert.is(save.deleted.size, 0)
  assert.is([...save.changed][0].id, 2)
})

test('non unique index reflects updated row', ({ t }) => {
  const rows = t.get({ foo: 'baz' }, 'foo')

  assert.is(rows.size, 1)
})

test('insert new row', ({ t, Row }) => {
  const r = t.upsert({ id: 4, foo: 'bar' })

  assert.is(r instanceof Row, true)
  assert.equal({ ...r }, { id: 4, foo: 'bar' })
})

test('new row appears in indexes', ({ t, Row }) => {
  let r = t.get({ id: 4 }, 'main')
  assert.is(r instanceof Row, true)
  assert.is(r.id, 4)

  r = t.get({ foo: 'bar' }, 'foo')
  assert.is(r.size, 3)
})

test('inserted row appears in save list', ({ t, save }) => {
  t.save()
  assert.is(save.changed.size, 1)
  assert.is([...save.changed][0].id, 4)
  assert.is(save.deleted.size, 0)
})

test('delete row', ({ t, Row }) => {
  const r = t.delete({ id: 4 })
  assert.is(r instanceof Row, true)
  assert.is(r.id, 4)
})

test('deleted row gone from indexes', ({ t }) => {
  let r = t.get({ id: 4 })
  assert.is(r, undefined)

  r = t.get({ foo: 'bar' }, 'foo')
  assert.is(
    [...r].some(x => x.id === 4),
    false
  )
})

test('save reports deletion', ({ t, save, Row }) => {
  t.save()
  assert.is(save.changed.size, 0)
  assert.is(save.deleted.size, 1)

  const r = [...save.deleted][0]
  assert.is(r instanceof Row, true)
  assert.is(r.id, 4)
})

test('multiple rows at once', ({ t, getData, save }) => {
  t.load(getData())
  t.upsert([
    { id: 1, foo: 'boof' },
    { id: 2, foo: 'boof' },
    { id: 3, foo: 'boof' },
    { id: 4, foo: 'boof' }
  ])

  assert.is(t.get({ foo: 'boof' }, 'foo').size, 4)

  t.delete([{ id: 3 }, { id: 4 }])

  assert.is(t.get({ foo: 'boof' }, 'foo').size, 2)

  t.save()

  assert.is(save.changed.size, 2)
  assert.equal(
    [...save.changed].map(x => x.id),
    [1, 2]
  )

  assert.is(save.deleted.size, 2)
  assert.equal(
    [...save.deleted].map(x => x.id),
    [3, 4]
  )
})

test('add indexes later', ({ t, getData }) => {
  t._ix = {}
  t.load(getData())

  t.addUniqueIndex('main', x => x.id)
  t.addIndex('foo', x => x.foo)

  assert.is(t.get({ id: 1 }).foo, 'bar')
  assert.is(t.get({ foo: 'baz' }, 'foo').size, 2)
})

test('query non existent index', ({ t }) => {
  assert.throws(() => t.get({}, 'biz'))
})

test('query index with no data', ({ t }) => {
  let r = t.get({ id: 5 })
  assert.is(r, undefined)

  r = t.get({ foo: 'quux' }, 'foo')
  assert.is(r.size, 0)
})

test('row creation with no factory', () => {
  const t = new Table({ main: x => x.id })
  const d = { id: 1, foo: 'bar' }
  const r = t.upsert(d)

  assert.is.not(d, r)
  assert.equal(d, r)
})

test.run()
