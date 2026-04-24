import Database from 'better-sqlite3';
const db = new Database('database.sqlite');
db.prepare("DELETE FROM batches WHERE name = 'New Batch'").run();
db.prepare("DELETE FROM routines WHERE time = '00:00'").run();
db.prepare("DELETE FROM downloads WHERE subject = 'New Subject'").run();
db.prepare("DELETE FROM fees WHERE subject = 'New Subject'").run();
console.log('Cleanup done');
