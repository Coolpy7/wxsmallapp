var Paho = require('../../utils/mqttws31.js')
// var msgpack = require('../../utils/msgpack.js')
var WxParse = require('../../wxParse/wxParse.js');
var app = getApp();
Page({
  data: {
    scrollTop: 1000000000000,
    boxHeihgt: 400,
    inputValue: '',
    messages: '',
    channel: 'coolpy/chatroom',
    online :[],
    initMsg : '<i class="msg info">☼ Welcome ~ </i>\n',
    extraMsgs :[],
  },
  parseHtml : function (text) {
  //html = html.replace(/<a.+?href="(.+?)".*?>(.+?)<\/a>/ig,'[url=$1]$2[/url]');
  text = text.replace(/(https?:\/\/[^\s]+)/g, function (link) {
    return '<a href="' + link + '">网址</a> \n';
  });
  return text;
},
  init: function(){
    if (!app.globalData.client) {
      app.globalData.client = new Paho.MQTT.Client('127.0.0.1', 8083, '/', app.globalData.userInfo.nickName)
    }
  },
  bindKeyInput: function (e) {
    this.setData({
      inputValue: e.detail.value
    })
  },
  sendBtn: function () {
    this.sendMsg(this.data.inputValue)
    this.setData({
      inputValue: ''
    });
  },
  sendMsg: function (msg) {
    var that = this
    app.globalData.client.publish(that.data.channel, JSON.stringify({ cmd: 'msg', uid: app.globalData.userInfo.nickName, msg: msg }), 1, false);
  },
  getMsg: function (data) {
    var that = this;
    var args = JSON.parse(data);
    //Chat
    if (args.cmd === 'msg') {
      if (args.trip == undefined) {
        args.trip = "(No trip)";
      }
      var isMe = '';
      if (args.uid === app.globalData.userInfo.nickName) {
        isMe = ' me';
      }
      // that.data.extraMsgs.push("\n" + "\033[F" + args.trip + " " + args.nick + ": " + args.text);
      that.data.extraMsgs.push('<div class="msg chat' + isMe + '">◦<em class="nick">' + args.uid + ":</em> " + args.msg + '</div>');
      // console.log(args);
    }

    //Messages Process
    switch (args.cmd) {
      case 'warn':
        if (args.msg === "Nickname taken") {
          that.data.extraMsgs.push('<div class="msg info">' + args.msg + '</div>');
          return false;
        }
        // console.log("Your IP is being rate-limited or blocked.");
        break;
      case 'onlineSet':
        for (var i = 0; i < args.nicks.length; i++) {
          if (!that.data.online.includes(args.nicks[i])){
            that.data.online.push(args.nicks[i]);
          }
        }
        that.data.extraMsgs.push("\n" + '<div class="msg info">当前在线（' + that.data.online.length + '）: ' + that.data.online + '</div>');
        break;
      case 'add':
        if (!that.data.online.includes(args.uid)) {
          that.data.online.push(args.uid);
        }
        that.data.extraMsgs.push('<div class="msg info"><em class="nick">' + args.uid + '</em> 进入了大厅</div>');
        break;
      case 'onlineRemove':
        var x = that.data.online.indexOf(args.uid);
        if (x != -1) {
          that.data.online.splice(x, 1);
          that.data.extraMsgs.push('<div class="msg info"><em class="nick">' + args.uid + '</em> 离开了大厅</div>');
        }
        break
      default:
    }
    this.setData({
      messages: that.data.initMsg + that.data.extraMsgs.join('\n')
    });
    this.setData({ scrollTop: that.data.scrollTop + 100 });
    WxParse.wxParse('messages', 'html', this.parseHtml(that.data.messages), this, 5)
  },
  onLoad: function () {
    var that = this;
    that.init();
    wx.getSystemInfo({
      success: function (res) {
        that.setData({
          boxHeihgt: res.windowHeight - 90
        })
      }
    });
    app.globalData.client.onMessageArrived = function (msg) {
      // console.log('收到服务器内容：' + msg.payloadString)
      that.getMsg(msg.payloadString)
    };
    app.globalData.client.onConnectionLost = function (responseObject) {
      if (responseObject.errorCode !== 0) {
        app.globalData.client.publish(that.data.channel, JSON.stringify({ cmd: 'onlineRemove', nick: app.globalData.userInfo.nickName, msg: '' }), 0, false);
        console.log("onConnectionLost:" + responseObject.errorMessage)
      }
    }
  },
  onShow: function () {
    let that = this
    if (!app.globalData.client.isConnected()) {
      app.globalData.client.connect({
        userName: app.globalData.userInfo.nickName,
        password: '',
        useSSL: false,
        cleanSession: false,
        keepAliveInterval: 60,
        onSuccess: function () {
          app.globalData.client.subscribe(that.data.channel, {
            qos: 0
          });
          app.globalData.client.publish(that.data.channel, JSON.stringify({ cmd: 'add', uid: app.globalData.userInfo.nickName, msg: '' }), 0, false);
        }
      });
    }else {
      app.globalData.client.publish(that.data.channel, JSON.stringify({ cmd: 'onlineSet', uid: [app.globalData.userInfo.nickName], msg: '' }), 0, false);
    }
  },
})