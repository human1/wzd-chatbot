'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const START_NO = 'START_NO';
const START_YES = 'START_YES';
const GREETING = 'GREETING';
const OTHER_HELP_YES = 'OTHER_HELP_YES';
const OVER_1M = 'OVER_1M';
const LESS_THAN_1M = 'LESS_THAN_1M';
const FACEBOOK_GRAPH_API_BASE_URL = 'https://graph.facebook.com/v2.6/';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://wizard-dev:wzd-20200908@cluster0.hnr8d.gcp.mongodb.net/wzd-chatbot?retryWrites=true&w=majority';

const
    request = require('request'),
    express = require('express'),
    body_parser = require('body-parser'),
    mongoose = require('mongoose'),
    app = express().use(body_parser.json()); // creates express http server

var db = mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(
    () => console.log('DB Connected!'))
    .catch(err => {
        console.log(`DB Connection Error: ${err.message}`);
    });

var ChatStatus = require("./models/chatstatus");

const host = '0.0.0.0';
const port = process.env.PORT || 1337;

app.listen(port, host, () => console.log('webhook is listening at port: ' + port));

// optionally store this in a database
const users = {}

// an object of state constants. Store id and state closing.
const states = {
    question1: 'qid_1',
    question2: 'qid_2',
    closing: 'closing',
}

// mapping of each state to the next state. Setup sen
const nextStates = {
    [states.question1]: states.question2,
    [states.question2]: states.closing,
}

// mapping of each to state to the message associated with each state
const questionList = {
    [states.question1]: 'How much is your intended home value?',
    [states.question2]: 'What\'s the price of your intended home value?',
    [states.closing]: 'That\'s cool. It\'s nice to meet you!',
}

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || '8cc5b87fa1dca8b34622499f2039dde0';
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

app.post('/webhook', (req, res) => {
    res.status(200).send('EVENT_RECEIVED');
    const body = req.body;
    if (body.object === 'page') {
        if (body.entry && body.entry.length <= 0) {
            return;
        }
        body.entry.forEach((pageEntry) => {
            // Iterate over each messaging event and handle accordingly
            pageEntry.messaging.forEach((event) => {
                // keep track of each user by their senderId
                const senderId = event.sender.id
                if (!users[senderId] || !users[senderId].currentState) {
                    users[senderId] = {};
                    users[senderId].answer = event.message.text;
                    users[senderId].currentState = states.question1;
                } else {
                    // store the answer and update the state
                    users[senderId].answer = event.message.text;
                    users[senderId].currentState = nextStates[users[senderId].currentState];
                }
                // send a message to the user via the Messenger API
                const _question = questionList[users[senderId].currentState];
                if (_question) {
                    sendTextMessage(senderId, _question);
                    // Save to API.
                    collectData(senderId, "", _question, users[senderId].answer, "");
                }
            });
        });
    }
});

function sendTextMessage(sender_psid, message) {
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": { 
            "text": message
        }
    }

    // Send the HTTP request to the Messenger Platform
    request({
        "url": `${FACEBOOK_GRAPH_API_BASE_URL}me/messages`,
        "qs": { "access_token": PAGE_ACCESS_TOKEN || 'EAAFVCXifkIkBAEsOSHyiHYEYg0xmjzQ1S6973ZCZCISwZB8cH4Wuxzko9knRpiZAZCZCq1TtfOOThunj57AYyBVgFFrefr2otlhxCCIv5dpry9U9es7Ry7yQ8svxxaiyVAkVKJMG0Np94RBNB643AbMGeahpLRiMWSHTA68StagQZDZD' },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        console.log("Message Sent Response body:", body);
        if (err) {
            console.error("Unable to send message:", err);
        }
    });
}

function collectData(fbid, username, question, answer, key) {
    const params = {
        "fbid": fbid,
        "username": username,
        "question": question,
        "answer": answer,
        "key": key,
    };

    request.post(
        'https://dev-mainapi.siroloan.com/api/public/v1/chatbot/collect',
        params,
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
            }
        }
    );
}
