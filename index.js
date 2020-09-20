"use strict";
require('dotenv').config({ path: __dirname + '/config/.env'})
const express = require("express");
const body_parser = require("body-parser");
const app = express().use(body_parser.json());

const host = process.env.HOST;
const port = process.env.PORT;

require("./routes/routes")(app);

app.listen(port, host, () =>
  console.log("webhook is listening at port: " + port)
);

module.exports = app;