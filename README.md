# memdb
Indexed in-memory JSON database

## API

### Table

The sole default export, this class represents a collection of JSON objects.

#### constructor
`t = new Table({ onsave, main, factory })`

Creates a new table. Optionally, you can supply the `onsave` callback,
a primary uniqe index and/or a factory for new rows.

#### .factory

The factory class for creating new items

#### .addIndex(name, fn)

Adds an index of a given name. An index is basically a function that will
take a given row and return a string (or other immutable primitive).

General indexs are not unique - so many rows can generate the same key.

#### .addUniqueIndex(name, fn)

Adds a unique index. The `row => key` function should produce a unique
answer for each row. The primary index should be called `main`.

#### .load(source)

Loads data into the database from an iterable source

#### .upsert(row|rows)

Inserts, or updates, a row or rows, returning the actual database row(s)
inserted or updated.

To update rows, you must already have defined a unique index called `main`.

#### .delete(row|rows)

Deletes a row or rows, return the row(s) removed. As with `upsert` this
relies on a unique `main` index.

#### .save()

Saves the database. If you have supplied `onsave`, then it will call that
providing the following two parameters:

- `changed` a Set of the rows which have changed and need to be serialised
- `deleted` a Set of the rows which should be deleted

#### .get(data, [indexName])

Queries the index to return the row[s] matching the data. If not given, it
uses the `main` (primary) index.

Unique indexes will return a single row, or undefined. Non-unique ones
will return a set.

#### .all()

An iterable of all the rows in the table.
