var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var ChatStatusSchema = new Schema({
  user_id: { type: String, unique: true },
  question: String,
  content: String,
  preference: String
});

module.exports = mongoose.model("ChatStatus", ChatStatusSchema);