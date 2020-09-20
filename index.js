"use strict";
require('dotenv').config({ path: require('find-config')('.env') });
require("./controllers/webhook");

const host = process.env.HOST;
const port = process.env.PORT;

app.listen(port, host, () =>
  console.log("webhook is listening at port: " + port)
);


