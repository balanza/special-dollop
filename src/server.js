const app = require('./app');
const { server: { port } } = require('./config');

init();

async function init() {
  try {
    app.listen(port, () => {
      console.log('Express App Listening on Port 3001');
    });
  } catch (error) {
    console.error(`An error occurred: ${JSON.stringify(error)}`);
    process.exit(1);
  }
}
