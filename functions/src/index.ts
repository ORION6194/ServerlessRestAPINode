import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from "body-parser";
import * as Knex from "knex";

admin.initializeApp(functions.config().firebase);


const app = express();
const main = express();

main.enable('trust proxy');

main.use('/api/v1', app);
main.use(bodyParser.urlencoded({extended: false}));
main.use(bodyParser.json());

// // Create a Winston logger that streams to Stackdriver Logging.
// const winston = require('winston');
// const {LoggingWinston} = require('@google-cloud/logging-winston');
// const loggingWinston = new LoggingWinston();
// const logger = winston.createLogger({
//   level: 'info',
//   transports: [new winston.transports.Console(), loggingWinston],
// });

const connect = () => {
  const config = {
    user: process.env.DB_USER, // e.g. 'my-user'
    password: process.env.DB_PASS, // e.g. 'my-user-password'
    database: process.env.DB_NAME, // e.g. 'my-database'
    host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`, // e.g. 'localhost'
  };
  
  // Establish a connection to the database
  const knex = Knex({
    client: 'pg',
    connection: config,
  });
  return knex;
};

/**
 * Retrieve the list of table schemas from the database.
 *
 * @param {object} knex_conn The Knex connection object.
 * @returns {Promise}
 */
const fetchTableSchemas = async (knex_conn: any) => {
  return await knex_conn
    .select('*')
    .from('data_config')
    .orderBy('tenant_name', 'desc')
    .orderBy('table_name', 'desc');
}

/**
 * Retrieve the list of table schemas from the database.
 *
 * @param {object} knex_conn The Knex connection object.
 * @param {string} tenant_name Tenant name value.
 * @param {string} table_name Table name value.
 * @returns {Promise}
 */
const fetchTableSchemaByTenantNameAndTableName = async (knex_conn: any, tenant_name: string, table_name: string) => {
  return await knex_conn
    .select('*')
    .from('data_config')
    .where({
      'tenant_name': tenant_name,
      'table_name': table_name
    })
    .orderBy('tenant_name', 'desc')
    .orderBy('table_name', 'desc');
}

/**
 * Retrieve the list of table schemas from the database.
 *
 * @param {object} knex_conn The Knex connection object.
 * @param {object} config The data_config object.
 * @returns {Promise}
 */
const createConfig = async (knex_conn: any, config: object) => {
  try{
    return await knex_conn('data_config')
      .insert(config);
  } catch (err) {
    throw Error(err);
  }
}

/**
 * Retrieve the list of table schemas from the database.
 *
 * @param {object} knex_conn The Knex connection object.
 * @param {string} tenant_name Tenant name value.
 * @param {string} table_name Table name value.
 * @returns {Promise}
 */
const deleteConfig = async (knex_conn: any, tenant_name: string, table_name: string) => {
  try{
    return await knex_conn('data_config')
      .delete().where({
        tenant_name,
        table_name,
      });
  } catch (err) {
    throw Error(err);
  }
}

app.get('/helloworld', (req, res) => {
  res.send('HelloWorld!');
});

app.delete('/deleteConfig', async (req, res) => {
  const {
    tenant_name,
    table_name,
  } = req.query || {};

  const knex_connection = connect();
  await deleteConfig(knex_connection, tenant_name, table_name);
  
  res.status(200)
    .send('Config deleted successfully!');
});

app.get('/listConfigs', async (req, res) => {
    const knex_connection = connect();
    const schemaList = await fetchTableSchemas(knex_connection);
    res.send(schemaList);
});

app.get('/fetchConfig', async (req, res) => {
  const {
    tenant_name,
    table_name,
  } = req.query || {};
  const knex_connection = connect();
  const schemaList = await fetchTableSchemaByTenantNameAndTableName(knex_connection, tenant_name, table_name);
  res.send(schemaList);
});

app.put('/createConfig', async (req, res) => {
  const config = req.body || {};
  const {
    tenant_name, 
    table_name, 
    table_schema,
  } = config || {};

  if (!tenant_name || !table_name || !table_schema){
    res.status(400)
      .send('Invalid request data received!')
      .end();
    return;
  }

  try {
    const knex_connection = connect();
    await createConfig(knex_connection, config);
  } catch (err) {
    console.log(`Error while attempting to insert new config:${err}`);
    res
      .status(500)
      .send('Unable to insert config; see logs for more details.')
      .end();
    return;
  }
  res.status(200)
    .send('Table Schema config inserted successfully!')
    .end();
});

export const webApi = functions.https.onRequest(main);
