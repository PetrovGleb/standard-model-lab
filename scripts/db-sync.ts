/* Creates or updates every table from the Sequelize models (sync without migrations) and prints what exists. Run with pnpm db:sync. */
import {
  createDatabaseConnection,
  readDatabaseConfigFromEnvironment,
} from '@standard-model/contracts/db';

const config = readDatabaseConfigFromEnvironment(process.env);
const connection = createDatabaseConnection(config);

try {
  await connection.authenticate();
  await connection.sync({ alter: true });
  const tableNames = Object.values(connection.models).map((model) => model.getTableName());
  console.log(
    `Synced ${config.database}@${config.host}:${String(config.port)} tables: ${tableNames.join(', ')}`,
  );
} finally {
  await connection.close();
}
