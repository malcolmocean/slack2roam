// shoutout to Aaron Parecki
// https://github.com/aaronpk/Slack-IRC-Gateway/blob/541cc464e60e6146c305afd5efc521f6553f690c/emoji.js
const punycode = require('punycode')
const emoji_data = require('./emoji_pretty.json')
const emoji_re = /\:([a-zA-Z0-9\-_\+]+)\:(?:\:([a-zA-Z0-9\-_\+]+)\:)?/g
module.exports = function (text) {
  var new_text = text
  while (match = emoji_re.exec(text)) {
    const ed = emoji_data.find(el => el.short_name == match[1])
    if (ed) {
      let points = ed.unified.split("-")
      points = points.map(p => parseInt(p, 16))
      new_text = new_text.replace(match[0], punycode.ucs2.encode(points))
    }
  }
  return new_text
}

// TODO = the emoji_pretty.json file needs to be cleaned up (it has a ton of unneeded data)
// TODO = the emoji_pretty.json file needs to be updated (it's only from 2017)
// TODO = grab source code from Complice that is a slightly better search above (gets alt names)
