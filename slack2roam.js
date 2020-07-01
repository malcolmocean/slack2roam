#! /usr/bin/env node
const fs = require('fs')
const path = require('path')
const emoji_name_to_unicode = require('./emoji_name_to_unicode')

const usersById = {}
const makeUserMap = function makeUserMap (users) {
  users.map(user => {
    usersById[user.id] = user
  })
}

let options = {
  workspaceName: '',
  timeOfDayFormat: '24h',
  tzOffsetMinutes: 0,
  uPageNameKey: 'name',
}
function setOptions (o) {
  for (let key in o) {
    options[key] = o[key]
  }
}

function formatDateForRoam (date) {
  function nth (d) {
    if (d > 3 && d < 21) return 'th'
    switch (d % 10) {
      case 1:  return "st"
      case 2:  return "nd"
      case 3:  return "rd"
      default: return "th"
    }
  }
  date = new Date(date)
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()]
  const dom = date.getDate()
  return `[[${month} ${dom}${nth(dom)}, ${date.getFullYear()}]]`
}

function formatTimeOfDay (date) {
  const h = date.getHours()
  const m = date.getMinutes()
  const hh = ('0'+h).substr(-2)
  const mm = ('0'+m).substr(-2)
  if (options.timeOfDayFormat == 'ampm') {
    const h12 = h % 12 || '12'
    const ampm = h >= 12 ? 'pm' : 'am'
    return h12 + ':' + mm + ampm
  } else if (options.timeOfDayFormat == '24h') {
    return hh + ':' + mm
  } else { // TODO = smart hour?
    return hh + ':' + mm
  }
}

function tsToTzAdjustedDate (ts) {
  // this doesn't currently play nice with the thing that converts a tz to eg [[January 1st, 2020]]
  // if (options.tzOffsetMinutes) { // defaults to using local timezone
  //   ts += 60*1000*options.tzOffsetMinutes
  // }
  return new Date(ts)
}

// TODO = this function needs lots of work
// currently defaults to username for uPageNameKey, since that's guaranteed unique
function format (text) {
  // console.log("\n\n\n\n========================================")
  // console.log("format input:\n"+ text)
  let string = text

  string = emoji_name_to_unicode(string)

  string = string.replace(/&amp;/g, '&')
  string = string.replace(/&gt;/g, '>')
  string = string.replace(/&lt;/g, '<')
  string = string.replace(/&quot;/g, '"')
  string = string.replace(/&ldquo;/g, '“')
  string = string.replace(/&rdquo;/g, '”')
  string = string.replace(/&[lr]squo;/g, "'")
  string = string.replace(/&ndash;/g, '\u2013')
  string = string.replace(/&mdash;/g, '\u2014')
  string = string.replace(/&hellip;/g, '\u2026')
  string = string.replace(/&nbsp;/g, ' ')
  string = string.replace(/&deg;/g, '\u00b0')

  // these two probably are not adequate at all
  string = string.replace(/ \*/g, ' **').replace(/\* /g, '** ')
  string = string.replace(/ _/g, ' __').replace(/_ /g, '__ ')

  // <@U9JRMJ0H4> is what an at-mention looks like

  string = string.replace(/<@([^>|]*?)>/g, (all, uid) => usersById[uid] ? '@[['+usersById[uid][options.uPageNameKey]+']]' : all)

  // <https://twitter.com/Malcolm_Ocean|@Malcolm_Ocean> is what a link looks like if it has text
  string = string.replace(/<(.*?)\|(.*?)>/g, '[$2]($1)')

  // <url> this is what a link looks like if no link text
  string = string.replace(/<(https?:\/\/.*?)>/g, '$1')

  return string
}

// slack timezones are in seconds with 6 decimal places
// but first & second decimal places tend to be empty
// yet third & fourth have something. eg 1583940932.008300
// so upgrade 008300 to 083000 so it keeps that data
function slackTimeToMillis (s) {
  s = parseFloat(s)
  const secs = Math.floor(s)*1000
  const nano = Math.floor((s%1)*1e6)
  let millis
  if (nano < 100000) {
    millis = Math.round(nano/100)
  } else { // I'm guessing this condition won't happen
    console.log("WHOA WHOA WHOA WHOA \nWHOA WHOA WHOA WHOA \nWHOA WHOA WHOA WHOA \n\n slackTimeToMillis s="+s)
    console.log("WHOA WHOA WHOA WHOA \nWHOA WHOA WHOA WHOA \nWHOA WHOA WHOA WHOA \n\n")
    millis = Math.ceil(nano/1000)
  }
  return secs + millis
  // return Math.floor(s*1000)
}

function slackTimeToUid (ts, channelname) {
  const ts_underscore = (''+ts).replace(/\./g, '_')
  const wn_underscore = options.workspaceName ? options.workspaceName + '_' : ''
  const ch_underscore = channelname ? channelname.replace(/-/g, '__') + '_' : ''
  return 'slack_'+wn_underscore+ch_underscore+ts_underscore
}

// attachments, eg expanded links to sites
function attachmentToString (attachment) {
  let string = ''
  const title = attachment.title || attachment.name
  const name = attachment.name || attachment.text || attachment.title
  const link = attachment.title_link || attachment.original_url
  if (title) {
    string = `[${title}](${link})`
  } else {
    string = link
  }
  if (name !== title) {
    string += ': ' + name
  }

  if (/youtube.com|youtu.be/.test(link)) {
    string = `${name}\n{{[[youtube]]: ${link}}}`
  }
  return string
}
// permalink_public: "https://slack-files.com/T2U9PFM6K-F012XGKA6TZ-a90a53104d",
// permalink: "https://subdomain.slack.com/files/U9JRMJ0H4/F012XGKA6TZ/filename.m4a",

// files, eg slack uploads or links to google drive
// or images pasted into slack
function fileToString (file) {
  let string = ''
  const name = file.name || file.title
  const link = file.external_url || file.title_link || file.original_url || file.url_private
  // file.url_private only shows if user logged into slack
  // TODO = get roam folks to somehow support importing images/files by url...? that's complex
  if (link) {
    string = `[${name}](${link})`
    if (file.mimetype.startsWith('image')) {
      string = `${name} ![](${link})`
    }
    if (file.mimetype.startsWith('audio')) {
      string = `:hiccup [:span "${name}" [:br] [:audio {:controls "1"} [:source {:src "${link}", :type "${file.mimetype}"}]]]`
      // string = `:hiccup ["${name}" :audio {:controls "1"} [:source {:src "${file.url_private || link}", :type "${file.mimetype}"}] "audio embed"]]`
    }
  }
  if (!string && file.mode == 'hidden_by_limit') {
    string = `File hidden_by_limit [${file.id}]`
  }
  if (!string) {
    console.log("========================================")
    console.log("idk how to handle this file", file)
    console.log("========================================")
    string = `[Attachment "${name}" ...unknown url]`
  }
  return string
}

function messageToBlock (message, channelname) {
  if (!message.user && message.is_hidden_by_limit) {return}
  const user = usersById[message.user]
  const block = {
    'uid': slackTimeToUid(message.ts, channelname), // because this is used as a thread-id, for some reason
    'create-time': slackTimeToMillis(message.ts),
  }
  if (user) {
    block.string = `[[${user[options.uPageNameKey]}]] `
    if (user.email) {
      block['create-email'] = user.email
    }
  } else {
    console.log(`Warning: no user found for message "${message.text}"`)
  }
  const createTime = tsToTzAdjustedDate(block['create-time'])
  const createTime_formatted = formatTimeOfDay(createTime)
  block.string += `${createTime_formatted}`
  if (message.edited && message.edited.ts) {
    block['edit-time'] = slackTimeToMillis(message.edited.ts)
    const editTime = tsToTzAdjustedDate(block['edit-time'])
    const editTime_formatted = formatTimeOfDay(editTime)
    // TODO: fix date if date changed
    block.string += ` (edited ${editTime_formatted})`
  }
  block.string += '\n' + format(message.text)

  if (message.attachments && message.attachments.length) {
    block.string += '\n\n' + message.attachments.map(a => attachmentToString(a)).join('\n\n')
    // block.children = block.children.concat(...message.attachments.map(a => ({string: attachmentToString(a)})))
  }
  if (message.files && message.files.length) {
    block.string += '\n\n' + message.files.map(f => fileToString(f)).join('\n\n')
    // block.children = block.children.concat(...message.files.map(f => ({string: fileToString(f)})))
  }
  if (message.thread_ts && message.thread_ts !== message.ts) {
    if (message.thread_ts == 1585103710.000700) {
      console.log('messageToBlock: ' + new Date(block['create-time']) + ' -> ' + block.string)
    }
    return {
      'string': `In reply to ${slackTimeToUid(message.thread_ts, channelname)}`,
      'create-time': block['create-time'],
      'children': [block],
      'replyTo': slackTimeToUid(message.thread_ts, channelname), // used by this script
    }
    // TODO = "not sure what the plan is here"
    // and should it be different depending on whether the original message for thread_ts is in this batch or not?
  }

  // TODO = resolve links to other messages??
  return block
}

function mergeThreads (blocks) {
  const messagesById = {}
  const oldThreadsById = {}
  blocks.map(b => b.uid && (messagesById[b.uid] = b))
  blocks = blocks.filter(b => {
    if (b.replyTo) {
      if (messagesById[b.replyTo]) {
        if (!messagesById[b.replyTo].children) {
          messagesById[b.replyTo].children = []
        }
        messagesById[b.replyTo].children.push(b.children[0])
      } else if (oldThreadsById[b.replyTo]) {
        oldThreadsById[b.replyTo].children.push(b.children[0])
      } else {
        oldThreadsById[b.replyTo] = b
        return true
      }
      return false
    }
    return true
  })
  return blocks
}

function splitByDate (blocks) {
  const dateBlocksByDate = {}
  const dateBlocks = []

  blocks.map(block => {
    let date = tsToTzAdjustedDate(block['create-time'])
    const roamDate = formatDateForRoam(date)
    if (!dateBlocksByDate[roamDate]) {
      dateBlocksByDate[roamDate] = {
        string: roamDate,
        children: [],
      }
      dateBlocks.push(dateBlocksByDate[roamDate])
    }
    dateBlocksByDate[roamDate].children.push(block)
  })
  // also do I want to insert the time of day into these messages?
  return dateBlocks
}

function slackChannelToRoamPage (channel, messages) {
  const page = {
    'title': channel.name,
  }
  page.children = messages.map(message => messageToBlock(message, channel.name)).filter(Boolean)
  page.children = mergeThreads(page.children)
  page.children = splitByDate(page.children)
  return page
}

async function importChannel (rootPath, channelName) {
  const dir = await fs.promises.readdir(path.join(rootPath, channelName))
  let messages = []
  for (let filename of dir) {
    const json = await readFileToJson(path.join(rootPath, channelName, filename))
    messages = messages.concat(json)
  }
  if (messages.length > 1 && messages[0].ts > messages[1].ts) {
    messages.reverse()
  }
  return messages
}

async function readFileToJson (_path) {
  // return fs.promises.readFile(_path)
  return JSON.parse(await fs.promises.readFile(_path))
}

async function writeJsonToFile (_path, json) {
  console.log("writing JSON to " + _path)
  return fs.promises.writeFile(_path, JSON.stringify(json, 0, 2))
  // return fs.promises.writeFile(_path, JSON.stringify(json))
}

async function slack2roam_cli () {
  const argv = require('minimist')(process.argv.slice(2))
  if (argv.options) {
    setOptions(JSON.parse(argv.options))
    console.log("options", options)
  }
  // const command = argv._[0]
  // const extra = argv._[1]
  const dirname = argv.dirname || process.cwd()
  const users = await readFileToJson(path.join(dirname, 'users.json'))
  console.log(users.length + ' users loaded from users.json')
  makeUserMap(users)
  const channels = await readFileToJson(path.join(dirname, 'channels.json'))
  // console.log("channels", channels)
  const messagesAllChannels = await Promise.all(channels.map(async channel => {
    const messages = await importChannel(dirname, channel.name) // Malcolm says: maybe wants to be channel.name_normalized; they were all the same in my data
    return {channel, messages}
  }))

  const roamPages = messagesAllChannels.map(({channel, messages}) => {
    return slackChannelToRoamPage(channel, messages)
  })

  console.log("roamPages", roamPages)

  if (argv.o || argv.output) {
    // LATER: confirm overwrite if exists
    await writeJsonToFile(argv.o || argv.output, roamPages)
  } else {
    console.log('roamPages', JSON.stringify(roamPages, null, 2))
  }
}

if (require.main === module) { // called directly
  slack2roam_cli()
  .catch(err => {
    console.log('\x1b[31m')//, 'Error')
    console.log(err)
    console.log('\x1b[0m')
  })
} else {
  exports.makeUserMap = makeUserMap
  exports.slackChannelToRoamPage = slackChannelToRoamPage
  exports.setOptions = setOptions
}
