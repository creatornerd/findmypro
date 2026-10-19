// Local dev entry point. The API itself lives in api/index.js (also what Vercel runs),
// so there is a single copy of every route.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('../api/index.js');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`FindMyPro server running on port ${PORT}`);
});
