'use strict';
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
                    // GREETING - Clicked in button.
                    console.log('--------------- Postback');
                    console.log('Post back: ' + messagingEvent.postback);
                    handlePostback(messagingEvent.sender.id, messagingEvent.postback);
                } else if (messagingEvent.message) {
                    //
                    if (messagingEvent.message.quick_reply) {
                        console.log('--------------- Quick reploy: ');
                        console.log(messagingEvent);

                        handlePostback(messagingEvent.sender.id, messagingEvent.message.quick_reply);
                    } else {
                        console.log('--------------- message: ');
                        console.log(messagingEvent);
                        handleMessage(messagingEvent.sender.id, messagingEvent.message);
                    }
                } else {
                    console.log('Webhook received unknown messagingEvent: ', messagingEvent);
                    handlePostback(sender_psid, { payload: GREETING });
                }
            });
        });
    }
});

function handleMessage(sender_psid, message) {
    console.log('handleMEssage message: ' + sender_psid);
    console.log(message)
    return;

    // const locationAttachment = message && message.attachments && message.attachments.find(a => a.type === 'location');
    // const coordinates = locationAttachment && locationAttachment.payload && locationAttachment.payload.coordinates;

    // if (coordinates && !isNaN(coordinates.lat) && !isNaN(coordinates.long)) {
    //     // User sending location
    //     console.log('********* coordinates');
    //     console.log(coordinates)
    //     console.log('*********');
    //     handleMessageWithLocationCoordinates(sender_psid, coordinates.lat, coordinates.long);
    //     return;
    // } else if (message.nlp && message.nlp.entities && message.nlp.entities.location && message.nlp.entities.location.find(g => g.confidence > 0.8 && g.suggested)) {
    //     //
    //     const locationName = message.nlp.entities.location.find(loc => loc.confidence > 0.8 && loc.suggested);
    //     console.log('********* 2nd locationName');
    //     console.log(locationName)
    //     console.log('*********');
    //     if (locationName.value) {
    //         const locationNameEncoded = encodeURIComponent(locationName.value);
    //         callGeocodingApi(locationNameEncoded, sender_psid, handleConfirmLocation);
    //     }
    //     return;
    // } else if (message.nlp && message.nlp.entities && message.nlp.entities.greetings && message.nlp.entities.greetings.find(g => g.confidence > 0.8 && g.value === 'true')) {
    //     // Message only
    //     console.log('********* GREETING');
    //     console.log()
    //     console.log('*********');
    //     handlePostback(sender_psid, { payload: GREETING });
    //     return;
    // }
}

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
        // case OTHER_HELP_YES:
        //     updateStatus(sender_psid, payload, handleOtherHelpPostback);
        //     break;
        // case AUSTRALIA_YES:
        //     updateStatus(sender_psid, payload, handleAustraliaYesPostback);
        //     break;
        // case AU_LOC_PROVIDED:
        //     updateStatus(sender_psid, payload, askForActivityPreference);
        //     break;
        case GREETING:
            updateStatus(sender_psid, payload, handleGreetingPostback);
            break;
        // case PREF_CLEANUP:
        // case PREF_REVEGETATION:
        case OVER_1M:
        case LESS_THAN_1M:
            updatePreference(sender_psid, payload, handlePreferencePostback);
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

function handleStartNoPostback(sender_psid) {
    const noPayload = {
        "text": "Can we use your data if needed?",
        "quick_replies": [
            {
                "content_type": "text",
                "title": "Yes."
            }
        ]
    };
    callSendAPI(sender_psid, noPayload);
}

// function handleConfirmLocation(sender_psid, geocoding_location, geocoding_formattedAddr) {
//     console.log('Geocoding api result: ', geocoding_location);
//     const query = { $and: [{ 'user_id': sender_psid }, { 'status': AUSTRALIA_YES }] };
//     const update = {
//         $set: { "location.lat": geocoding_location.lat, "location.long": geocoding_location.lng, status: AU_LOC_PROVIDED }
//     };
//     const options = { upsert: false, new: true };

//     ChatStatus.findOneAndUpdate(query, update, options, (err, cs) => {
//         console.log('handleConfirmLocation update location:', cs);
//         if (err) {
//             console.log('handleConfirmLocation Error in updating coordinates:', err);
//         } else if (cs) {
//             const response = {
//                 "attachment": {
//                     "type": "template",
//                     "payload": {
//                         "template_type": "button",
//                         "text": `${geocoding_formattedAddr}. Is it your address?`,
//                         "buttons": [
//                             {
//                                 "type": "postback",
//                                 "payload": AU_LOC_PROVIDED,
//                                 "title": "Yes"
//                             },
//                             {
//                                 "type": "postback",
//                                 "payload": AUSTRALIA_YES,
//                                 "title": "No"
//                             }
//                         ]
//                     }
//                 }
//             };
//             callSendAPI(sender_psid, response);
//         }
//     });
// }

// function handleMessageWithLocationCoordinates(sender_psid, coordinates_lat, coordinates_long) {
//     const query = {
//         $and: [
//             { 'user_id': sender_psid },
//             { 'status': AUSTRALIA_YES }
//         ]
//     };
//     const update = {
//         $set: { "location.lat": coordinates_lat, "location.long": coordinates_long, status: AU_LOC_PROVIDED }
//     };
//     const options = { upsert: false, new: true };

//     ChatStatus.findOneAndUpdate(query, update, options, (err, cs) => {
//         console.log('handleMessage update coordinates:', cs);
//         if (err) {
//             console.log('Error in updating coordinates:', err);
//         } else if (cs) {
//             askForActivityPreference(sender_psid);
//         }
//     });
// }

// function askForActivityPreference(sender_psid) {
//     const response = {
//         "attachment": {
//             "type": "template",
//             "payload": {
//                 "template_type": "list",
//                 "top_element_style": "compact",
//                 "elements": [
//                     {
//                         "title": "Environmental Cleanup",
//                         "subtitle": "Clean environment",
//                         "image_url": "http://www.wwf.org.au/Images/UserUploadedImages/416/img-bait-reef-coral-bleaching-rubble-1000px.jpg",
//                         "buttons": [
//                             {
//                                 type: "postback",
//                                 title: "Go Environmental Cleanup",
//                                 payload: PREF_CLEANUP
//                             }
//                         ]
//                     }, {
//                         "title": "Revegetation",
//                         "subtitle": "Revegetation",
//                         "image_url": "http://www.wwf.org.au//Images/UserUploadedImages/416/img-planet-globe-on-moss-forest-1000px.jpg",
//                         "buttons": [
//                             {
//                                 type: "postback",
//                                 title: "Go Revegetation",
//                                 payload: PREF_REVEGETATION
//                             }
//                         ]
//                     }, {
//                         "title": "Bio Survey",
//                         "subtitle": "Bio Survey",
//                         "image_url": "http://www.wwf.org.au/Images/UserUploadedImages/416/img-koala-in-tree-1000px.jpg",
//                         "buttons": [
//                             {
//                                 type: "postback",
//                                 title: "Go Bio Survey",
//                                 payload: PREF_BIO_SURVEY
//                             }
//                         ]
//                     }, {
//                         "title": "Canvassing",
//                         "subtitle": "Canvassing",
//                         "image_url": "http://www.wwf.org.au/Images/UserUploadedImages/416/img-hackathon-winners-2017-1000px.jpg",
//                         "buttons": [
//                             {
//                                 type: "postback",
//                                 title: "Go Canvassing",
//                                 payload: PREF_CANVASSING
//                             }
//                         ]
//                     }
//                 ]
//             }
//         }
//     };
//     callSendAPI(sender_psid, response);
// }

// function handleOtherHelpPostback(sender_psid) {
//     const campaigns = {
//         "attachment": {
//             "type": "template",
//             "payload": {
//                 "template_type": "generic",
//                 "elements": [
//                     {
//                         "title": "We need your help",
//                         "image_url": "http://awsassets.panda.org/img/original/wwf_infographic_tropical_deforestation.jpg",
//                         "subtitle": "to save our natural world",
//                         "buttons": [
//                             {
//                                 "type": "web_url",
//                                 "url": "https://donate.wwf.org.au/campaigns/rhinoappeal/",
//                                 "title": "Javan Rhino Appeal"
//                             }, {
//                                 "type": "web_url",
//                                 "url": "https://donate.wwf.org.au/campaigns/donate/#AD",
//                                 "title": "Adopt an Animal"
//                             }, {
//                                 "type": "web_url",
//                                 "url": "https://donate.wwf.org.au/campaigns/wildcards/",
//                                 "title": "Send a wildcard"
//                             }
//                         ]
//                     }
//                 ]
//             }
//         }
//     };
//     callSendAPI(sender_psid, campaigns);
// }

// function handleAustraliaYesPostback(sender_psid) {
//     const askForLocationPayload = {
//         "text": "Where about do you live?",
//         "quick_replies": [
//             {
//                 "content_type": "location"
//             }
//         ]
//     };
//     callSendAPI(sender_psid, askForLocationPayload);
// }

// function handlePreferencePostback(sender_psid, chatStatus) {
//     console.log('handlePreferencePostback params: ', chatStatus);
//     if (chatStatus && !isNaN(chatStatus.location.lat) && !isNaN(chatStatus.location.long)) {
//         request({
//             "url": `${FACEBOOK_GRAPH_API_BASE_URL}search?type=page&q=NonProfit+Australia&fields=name,id,category,location,picture`,
//             "qs": { "access_token": PAGE_ACCESS_TOKEN },
//             "method": "GET"
//         }, (err, res, body) => {
//             if (err) {
//                 console.error("Unable to search Facebook API:" + err);
//             } else {
//                 console.log("Facebook API result:", body);
//                 let bodyJson = JSON.parse(body);
//                 let elements = bodyJson.data.filter(d => {
//                     if (isNaN(d.location && d.location.latitude) || isNaN(d.location && d.location.longitude)) {
//                         return false;
//                     }
//                     return d.location.latitude < chatStatus.location.lat + 0.1 && d.location.latitude > chatStatus.location.lat - 0.1
//                         && d.location.longitude < chatStatus.location.long + 0.1 && d.location.longitude > chatStatus.location.long - 0.1
//                 }).slice(0, 3).map(org => {
//                     let element = {
//                         "title": org.name,
//                         "buttons": [{
//                             "type": "web_url",
//                             "url": `https://www.facebook.com/${org.id}`,
//                             "title": org.name,
//                         }]
//                     };
//                     if (org.category) {
//                         element["subtitle"] = org.category;
//                     }

//                     if (org.picture && org.picture.data && org.picture.data.url) {
//                         element["image_url"] = org.picture.data.url;
//                     }
//                     console.log("Facebook API element:", element);
//                     return element;
//                 });
//                 console.log("Facebook API elements:", elements);
//                 const organizationPayload = {
//                     "attachment": {
//                         "type": "template",
//                         "payload": {
//                             "template_type": "list",
//                             "top_element_style": "compact",
//                             "elements": elements
//                         }
//                     }
//                 };
//                 callSendAPI(sender_psid, organizationPayload);
//             }
//         });
//     }
// }


// function updatePreference(sender_psid, perference, callback) {
//     const query = { user_id: sender_psid };
//     const update = { status: 'PREFERENCE_PROVIDED', preference: perference };
//     const options = { upsert: false, new: true };

//     ChatStatus.findOneAndUpdate(query, update, options).exec((err, cs) => {
//         console.log('update perference to db: ', cs);
//         callback(sender_psid, cs);
//     });
// }

// function callGeocodingApi(address, sender_psid, callback) {
//     console.log('before calling geocoding api with address:', address);
//     request({
//         "url": `${GOOGLE_GEOCODING_API}${address}&key=${GOOGLE_GEOCODING_API_KEY}`,
//         "method": "GET"
//     }, (err, res, body) => {
//         console.log('after calling geocoding api with result:', body);
//         if (err) {
//             console.error("Unable to retrieve location from Google API:", err);
//         } else {
//             const bodyObj = JSON.parse(body);
//             if (bodyObj.status === 'OK') {
//                 if (bodyObj.results && bodyObj.results[0] && bodyObj.results[0].geometry && bodyObj.results[0].geometry.location) {
//                     callback(sender_psid, bodyObj.results[0].geometry.location, bodyObj.results[0].formatted_address);
//                 }
//             } else {
//                 console.error("Unable to retrieve location (status non-OK):", bodyObj);
//             }
//         }
//     });
// }