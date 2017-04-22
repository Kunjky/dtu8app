//npm packages
'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();


const token = process.env.FB_VERIFY_TOKEN;
const access_token = process.env.FB_ACCESS_TOKEN;
app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/',function (req, res){
  res.send('Hello i\'m messbot');
})

app.get('/webhook/', function(req, res){
  if(req.query['hub.verify_token'] === token){
    res.send(req.query['hub.challenge']);
  }
  res.send('no entry');
})

// Receive POST method

app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if(event.postback){
          receivedPostback(event);
        } else if (event) {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });
    res.sendStatus(200);
  }
});

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.postback;

  console.log("Received postback for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var payload = event.postback.payload;

  var inRoom = isInRoom(senderID);
  var InQueue = isInQueue(senderID);

  if(payload === 'HELP_PAYLOAD'){
      var help = 'Sử dụng các lệnh sau:\n@tim - Để tìm người tám\n@bye - Để kết thúc\nNếu chờ lâu quá (hơn 15\') thì gõ @bye rồi bắt đầu tìm kiếm lại nhé\nLưu ý: Sử dụng ngôn ngữ phù hợp với văn hóa.Have a nice day ^_^!';
      sendTextMessage(senderID, help);
      return;
  }
  // check id is in room and queue or not ?
  if(!inRoom && !InQueue){
    if(payload === 'JOIN_PAYLOAD'){
      addQueue(senderID);
    }else if(payload === 'START_PAYLOAD'){
        var greeting = 'ﾍ(￣▽￣*)ﾉ ♪♪ Welcome!\nChào mừng đến với DTU tám, tui sẽ kết nối bạn với một người ngẫu nhiên bằng cách gõ: @tim\nĐể kết thúc cuộc trò chuyện gõ: @bye';
        sendTextMessage(senderID, greeting);
    }
  }else if(InQueue){
      sendTemplateText(senderID, 'Tui vẫn đang tìm...','Kiên nhẫn chút nào! Nếu lâu quá thì gõ @bye và tìm lại nhé');
  }
}


function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var attachments = message.attachments;

  // check id is in room and queue or not ?
  var inRoom = isInRoom(senderID);
  var InQueue = isInQueue(senderID);
  if(!inRoom && !InQueue){
    if(messageText === '@tim'){
      addQueue(senderID);
    }
  }else if(inRoom){
    var userIndex = chatRooms.indexOf(senderID);
    if(userIndex % 2 === 0){
      var partnerIndex = userIndex + 1;
    }else{
      var partnerIndex = userIndex - 1;
    }
    var partnerId = chatRooms[partnerIndex];

    if(messageText === '@bye'){
        outRoom(userIndex, partnerIndex);
    }else{
      comunicate(partnerId, messageText, attachments);
    }
  }else if(InQueue){
    var userIndex = queue.indexOf(senderID);
    if(messageText === '@bye'){
      outQueue(userIndex);
    }else{
      sendTemplateText(senderID, 'Tui vẫn đang tìm...','Kiên nhẫn chút nào! Nếu lâu quá thì gõ @bye và tìm lại nhé');
    }
  }
}


function comunicate(partnerId, messageText, attachments){
  if (messageText) {
    sendTextMessage(partnerId, messageText);
  } else if (attachments) {
      var attachment = attachments[0];
      sendAttachment(partnerId, attachment);
  }
}

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function sendAttachment(recipientId, attachment) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: attachment.type,
        payload: {
          url: attachment.payload.url
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendButton(recipientId, text) {
  var messageData = {
  recipient:{
    id:recipientId
  },
  message:{
    attachment:{
      type:"template",
      payload:{
        template_type:"button",
        text: text+"\nẤn nút phía dưới để bắt đầu hội thoại mới. Đừng quên like page để cập nhật tin tức về DTU8 nha!\n          ﾍ(￣▽￣*)ﾉ ♪♪",
        buttons:[
            {
              type:"postback",
              title:"Tiếp tục thả thính",
              payload:"JOIN_PAYLOAD"
            },
            {
              type:"web_url",
              url:"https://www.facebook.com/dtu.tam/",
              title:"DTU8's Page"
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendTemplateEnd(recipientId, title, subtitle) {
  var messageData = {
  recipient:{
    id: recipientId
  },
  message:{
    attachment:{
      type:"template",
      payload:{
        template_type:"generic",
        elements:[
           {
            title: title,
            subtitle: subtitle,
            buttons:[
              {
                type:"postback",
                title:"Tiếp tục thả thính",
                payload:"JOIN_PAYLOAD"
              },{
                type:"web_url",
                url:"https://www.facebook.com/dtu.tam/",
                title:"DTU8's Page"
              }
            ]
          }
        ]
      }
    }
  }
};

  callSendAPI(messageData);
}

function sendTemplateText(recipientId, title, subtitle) {
  var messageData = {
  recipient:{
    id: recipientId
  },
  message:{
    attachment:{
      type:"template",
      payload:{
        template_type:"generic",
        elements:[
           {
            title: title,
            subtitle: subtitle,
          }
        ]
      }
    }
  }
};

  callSendAPI(messageData);
}

function sendActions(recipientId) {
  var messageData = {
    recipient:{
  	   id: recipientId
     },
     sender_action:"typing_on"
   };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.FB_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}

var queue = [];
var chatRooms = [];
function addQueue(userId){
  queue.push(userId);
  if(queue.length >= 2){
    var userA = queue.pop();
    var userB = queue.pop();
    joinRoom(userA, userB);
    console.log('queue hien tai: '+queue);
    return;
  }
  sendTemplateText(userId, 'Tui đang tìm...','Đợi tý! (~￣▽￣)~');

  console.log('queue hien tai: '+queue);
}

function joinRoom(userA, userB){
  chatRooms.push(userA, userB);
  sendTemplateText(userA, 'Đã tìm thấy đối tượng','Thả thính đi nào ♥♥♥\nGõ @bye để kết thúc\n(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧');
  sendTemplateText(userB, 'Đã tìm thấy đối tượng','Thả thính đi nào ♥♥♥\nGõ @bye để kết thúc\n(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧');
  console.log('da add 2 user,room hien tai: '+chatRooms);
}

function outRoom(indexA,indexB){
  sendTemplateEnd(chatRooms[indexA],'Bạn đã ngưng thả thính','Like page để cập nhật tin tức về DTU8 nha!\nﾍ(￣▽￣*)ﾉ ♪♪');
  sendTemplateEnd(chatRooms[indexB],'Đối phương đã ngưng thả thính','Like page để cập nhật tin tức về DTU8 nha!\nﾍ(￣▽￣*)ﾉ ♪♪');
  if(indexA>indexB)
    chatRooms.splice(indexB,2);
  else
    chatRooms.splice(indexA,2);

  console.log('da remove 2 user ra khoi room, room hien tai: '+chatRooms);
}

function outQueue(index){
  sendTemplateEnd(queue[index],'Đã thoát khỏi hàng chờ','Like page để cập nhật tin tức về DTU8 nha!\nﾍ(￣▽￣*)ﾉ ♪♪');
  queue.splice(index,1);
}

function isInRoom(userId){
  return chatRooms.indexOf(userId) !== -1;
}

function isInQueue(userId){
  return queue.indexOf(userId) !== -1;
}
app.listen(app.get('port'), function(){
  console.log('running on port', app.get('port'));
})
