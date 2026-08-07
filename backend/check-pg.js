const { Client } = require('pg');
const client = new Client('postgresql://barbershop:secretpassword@localhost:5432/barbershop_db');
client.connect()
  .then(() => client.query('SELECT name, email, "passwordHash" FROM "User"'))
  .then(res => {
    console.log(res.rows);
    client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
