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

app.post('/webhook', (req, res) => {
    res.status(200).send('EVENT_RECEIVED');
    const body = req.body;
    if (body.object === 'page') {
        if (body.entry && body.entry.length <= 0) {
            return;
        }
        body.entry.forEach((pageEntry) => {
            // Iterate over each messaging event and handle accordingly
            pageEntry.messaging.forEach((messagingEvent) => {
                // There have some button action. Need to handle all of them
                if (messagingEvent.postback) {
                    handlePostback(messagingEvent.sender.id, messagingEvent.postback);
                } else if (messagingEvent.message) {
                    if (messagingEvent.message.quick_reply) {
                        handlePostback(messagingEvent.sender.id, messagingEvent.message.quick_reply);
                    } else {
                        handlePostback(messagingEvent.sender.id, { payload: GREETING });
                    }
                } else {
                    console.log('Webhook received unknown messagingEvent: ', messagingEvent);
                }
            });
        });
    }
});

function updateStatus(sender_psid, status, callback) {
    const query = { user_id: sender_psid };
    const update = { status: status };
    const options = { upsert: status === GREETING };

    ChatStatus.findOneAndUpdate(query, update, options).exec((err, cs) => {
        console.log('update status to db: ', cs);
        callback(sender_psid);
    });
}

function callSendAPI(sender_psid, response) {
    console.log('message to be sent: ', response);
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

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

function handlePostback(sender_psid, received_postback) {
    const payload = received_postback.payload;

    console.log('handlePostback');
    console.log(payload);

    // Process based on the user answer
    switch (payload) {
        case START_YES:
            updateStatus(sender_psid, payload, handleStartYesPostback);
            break;
        case START_NO:
            updateStatus(sender_psid, payload, handleStartNoPostback);
            break;
        case GREETING:
            updateStatus(sender_psid, payload, handleGreetingPostback);
            break;
        case OVER_1M:
        case LESS_THAN_1M:
            updateStatus(sender_psid, payload, showAllData);
            break;
        default:
            console.log('Cannot differentiate the payload type');
    }
}

function handleGreetingPostback(sender_psid) {
    request({
        url: `${FACEBOOK_GRAPH_API_BASE_URL}${sender_psid}`,
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
            fields: "first_name"
        },
        method: "GET"
    }, function (error, response, body) {
        var greeting = "";
        if (error) {
            console.log("Error getting user's name: " + error);
        } else {
            var bodyObj = JSON.parse(body);
            const name = bodyObj.first_name;
            greeting = "Hi " + name + "! ";
        }
        const message = greeting + "Can we save your data if needed?";
        const greetingPayload = {
            "text": message,
            "quick_replies": [
                {
                    "content_type": "text",
                    "title": "Yes, I need your help!",
                    "payload": START_YES
                },
                {
                    "content_type": "text",
                    "title": "No, thanks.",
                    "payload": START_NO
                }
            ]
        };
        callSendAPI(sender_psid, greetingPayload);
    });
}

function handleStartYesPostback(sender_psid) {
    const yesPayload = {
        "text": "How much is your intended home value?",
        "quick_replies": [
            {
                "content_type": "text",
                "title": "Over 1M",
                "payload": OVER_1M
            },
            {
                "content_type": "text",
                "title": "Less than 1M ",
                "payload": LESS_THAN_1M
            }
        ]
    };
    callSendAPI(sender_psid, yesPayload);
}

function showAllData(sender_psid) {
    const listData = ChatStatus.findById({})
    const noPayload = {
        "text": listData,
    };
    callSendAPI(sender_psid, noPayload);
}