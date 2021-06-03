# memdb
Indexed in-memory JSON database

## API

### Table

A named export, this class represents a collection of JSON objects.

#### constructor
`t = new Table({ onsave, indexes { name: index } })`

Creates a new table. Optionally you can supply hooks, factory and indexes here rather than adding later.

#### .factory

Set to a factory class for creating new items

#### .addIndex(name, index)

Adds an index to the table

#### .load(source)

Loads data into the database from an iterable source

#### .loadAsync(source)

Loads data into the database from an asynciterable source

#### .upsert(row|rows)

Inserts, or updates, a row or rows.

To update rows, you must already have defined a unique index called `main`.

#### .delete(row|rows)

Deletes a row or rows

#### .save()

Saves the database. If you have supplied `onsave`, then it will call that
providing the following two parameters:

- `changed` an iterable of the rows which have changed and need to be serialised
- `deleted` an iterable of the rows which should be deleted

### Index

A class to create an index

The heart of an index is a function that maps a row to a string key.

#### constructor
`const ix = new Index(fn)`

#### .get(partialRow) => [Rows]


### UniqueIndex

A subclass of `Index` that only returns a single row for each key.
