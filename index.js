'use strict';
const FACEBOOK_GRAPH_API_BASE_URL = 'https://graph.facebook.com/v2.6/';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const START_NO = 'START_NO';
const START_YES = 'START_YES';
const GREETING = 'GREETING';
// const AUSTRALIA_YES = 'AUSTRALIA_YES';
// const AU_LOC_PROVIDED = 'AU_LOC_PROVIDED';
// const PREFERENCE_PROVIDED = 'PREFERENCE_PROVIDED';
// const PREF_CLEANUP = 'PREF_CLEANUP';
// const PREF_REVEGETATION = 'PREF_REVEGETATION';
// const PREF_BIO_SURVEY = 'PREF_BIO_SURVEY';
// const PREF_CANVASSING = 'PREF_CANVASSING';
// const AUSTRALIA_NO = 'AUSTRALIA_NO';
const OTHER_HELP_YES = 'OTHER_HELP_YES';
const OVER_1M = 'OVER_1M';
const LESS_THAN_1M = 'LESS_THAN_1M';
// const GOOGLE_GEOCODING_API = 'https://maps.googleapis.com/maps/api/geocode/json?address=';
// const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://wizard-dev:wzd-20200908@cluster0.hnr8d.gcp.mongodb.net/wzd-chatbot?retryWrites=true&w=majority';

const
    request = require('request'),
    express = require('express'),
    body_parser = require('body-parser'),
    // mongoose = require('mongoose'),
    app = express().use(body_parser.json()); // creates express http server

// var db = mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(
//     () => console.log('DB Connected!'))
//     .catch(err => {
//         console.log(`DB Connection Error: ${err.message}`);
//     });

// var ChatStatus = require("./models/chatstatus");

const host = '0.0.0.0';
const port = process.env.PORT || 1337;

app.listen(port, host, () => console.log('webhook is listening at port: ' + port));

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFICATION_TOKEN;
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    if (req.body.object == "page") {
      // Iterate over each entry
      // There may be multiple entries if batched
      req.body.entry.forEach(function(entry) {
        // Iterate over each messaging event
        entry.messaging.forEach(function(event) {
          if (event.postback) {
            processPostback(event);
          }
        });
      });
  
      res.sendStatus(200);
    }
  });
  
  function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;
  
    if (payload === "Greeting") {
      // Get user's first name from the User Profile API
      // and include it in the greeting
      request({
        url: "https://graph.facebook.com/v2.6/" + senderId,
        qs: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
          fields: "first_name"
        },
        method: "GET"
      }, function(error, response, body) {
        var greeting = "";
        if (error) {
          console.log("Error getting user's name: " +  error);
        } else {
          var bodyObj = JSON.parse(body);
          name = bodyObj.first_name;
          greeting = "Hi " + name + ". ";
        }
        var message = greeting + "My name is SP Movie Bot. I can tell you various details regarding movies. What movie would you like to know about?";
        sendMessage(senderId, {text: message});
      });
    }
  }
  
  // sends message to user
  function sendMessage(recipientId, message) {
    request({
      url: "https://graph.facebook.com/me/messages",
      qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
      method: "POST",
      json: {
        recipient: {id: recipientId},
        message: message,
      }
    }, function(error, response, body) {
      if (error) {
        console.log("Error sending message: " + response.error);
      }
    });
  }