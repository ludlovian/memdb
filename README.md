# memdb
Indexed in-memory JSON table

## Table

The default export

### new Table({ cols, key })

Creates a new table with the cols and key supplied.

`cols` is a comma-delimited list of columns, or `name:type`s

`key` is a comma-delimited subset of the columns

### Table.registerType(name, { serialize, deserialize })

Registers a new data type with option (de-)serialize functions

### .clear()

Empties the table

### .resetChanges()

Resets the change tracking

### .add(data) => Row

Adds a row of data, returning the wrapped `Row`

### table.update(row, change) => Row
### row.update(change) => Row

Updates the row with the change. You cannot update the primary key

### table.delete(row) => null
### row.delete() => null

Deletes the row

### .find(key) => Row|null

Finds the row if we have it

### .get(key) => Row

Finds the row, or adds a new one

### .data => [Row]

The current array of rows, sorted in key order

### .changes => { added, changed, deleted, untouched }

The changes made since the last `.resetChanges` or `.load`

### .serialize() => [objects]

Converts the data to serialized POJOs

### .load([objects])

Loads from serialized data.
