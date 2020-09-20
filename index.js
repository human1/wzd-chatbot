"use strict";
require('dotenv').config({ path: __dirname + '/config/.env'})

const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  app = express().use(body_parser.json());

require("./controllers/webhook");

const host = process.env.HOST;
const port = process.env.PORT;

app.listen(port, host, () =>
  console.log("webhook is listening at port: " + port)
);


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

const keys = {
    [states.question1]: 'propertyValue',
    [states.question2]: 'propertyValue',
}

// mapping of each to state to the message associated with each state
const questionList = {
    [states.question1]: 'How much is your intended home value?',
    [states.question2]: 'What\'s the price of your intended home value?',
    [states.closing]: 'That\'s cool. It\'s nice to meet you!',
}

app.get('/', async (req, res) => {
	const healthcheck = {
		uptime: process.uptime(),
		message: 'OK',
		timestamp: Date.now()
	};
	try {
		res.send(healthcheck);
	} catch (e) {
		healthcheck.message = e;
		res.status(503).send();
	}
});

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
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
                const _key = keys[users[senderId].currentState];
                if (_question) {
                    // Process with BE
                    connectWithBackend(senderId, _question, _key);
                }
            });
        });
    }
});

function sendTextMessage(sender_psid, message) {
    console.log('-- Process sendTextMessage()');
    const request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": {
            "text": message
        }
    }
    console.log(request_body)

    // Send the HTTP request to the Messenger Platform
    request({
        "url": `${FACEBOOK_GRAPH_API_BASE_URL}me/messages`,
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        console.log("Message Sent Response body:", body);
        if (err) {
            console.error("Unable to send message:", err);
        }
    });
}

function connectWithBackend(fbid, _question, _key) {
    console.log('Process login/connect with BE');
    if ("dev" === MODE) {
        //  No need to collect data
        console.log('Mode: dev');
        sendTextMessage(fbid, _question);
    } else {
        request({
            "url": `https://dev-mainapi.siroloan.com/api/public/v1/chatbot/user/${fbid}`,
            "method": "GET",
        }, (err, res, body) => {
            sendTextMessage(fbid, _question);
            collectData(fbid, "", _question, users[fbid].answer, _key);
            if (err) {
                console.error("Unable to Connect with BE:", err);
            }
        });
    }
}

function collectData(fbid, username, question, answer, key) {
    console.log('Process collect data');
    const request_body = {
        "fbid": fbid,
        "username": username,
        "question": question,
        "answer": answer,
        "key": key,
    };
    console.log(request_body);

    // Send the HTTP request to the Messenger Platform
    request({
        "url": 'https://dev-mainapi.siroloan.com/api/public/v1/chatbot/collect',
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        console.log("Collected data:", body);
        if (err) {
            console.error("Unable to collect:", err);
        }
    });
}
