// hi and welcome to the most minimal test ever
const slack2roam = require('./slack2roam')
const users = [{
  id: "U0ABC123",
  name: "malcolmocean",
  real_name: "Malcolm Ocean",
}, {
  id: "U0DEF456",
  name: "conaw",
  real_name: "Conor White-Sullivan",
}]
const channel = {name: 'general'}
const messages = [{
    "type": "message",
    "text": "Hey it's a message in slack",
    "user": "U0ABC123",
    "ts": "1585242429.009300",
}, {
    "type": "message",
    "text": "Wow, here's another it's a message in slack!",
    "user": "U0DEF456",
    "ts": "1585893429.009300",
}]
slack2roam.setOptions({
  uPageNameKey: 'real_name', // defaults to 'name', ie username, since guaranteed unique
})
slack2roam.makeUserMap(users)
const result = slack2roam.slackChannelToRoamPage(channel, messages)
const expected = {
  "title": "general",
  "children": [
    {
      "string": "[[March 26th, 2020]]",
      "children": [
        {
          "uid": "slack_general_1585242429_009300",
          "create-time": 1585242429093,
          "string": "[[Malcolm Ocean]] 13:07\nHey it's a message in slack"
        }
      ]
    },
    {
      "string": "[[April 3rd, 2020]]",
      "children": [
        {
          "uid": "slack_general_1585893429_009300",
          "create-time": 1585893429093,
          "string": "[[Conor White-Sullivan]] 01:57\nWow, here's another it's a message in slack!"
        }
      ]
    }
  ]
}

const assert = require('assert')
try {
  assert.deepEqual(result, expected)
  console.log("result", JSON.stringify(result, 0, 2))
  console.log('\x1b[32m')//, 'green')
  console.log("✓ there's one test and it worked")
  console.log('\x1b[0m')
} catch (err) {
  console.log('\x1b[31m')//, 'Error')
  console.log("✗ there's one test and it just broke\n")
  console.log("Error", err)
  console.log('\x1b[33m' + "result =", JSON.stringify(result, null, 2))
  console.log('\x1b[34m' + "expected =", JSON.stringify(expected, null, 2))
  console.log('\x1b[0m')
}
