const express = require("express");
const wh = require("../controllers/webhook");

module.exports = function (app) {
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      next();
    });
    app.use(express.json());
    app.use("/", wh);
};
  